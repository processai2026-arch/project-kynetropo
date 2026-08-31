<?php
declare(strict_types=1);

/**
 * AdminBillingController — tenant-facing subscription/billing (control plane).
 *
 *   GET  /admin/billing            → current plan, status, trial/renewal info.
 *   POST /admin/billing/subscribe  → start/upgrade a paid plan (Razorpay order).
 *   POST /admin/billing/change-plan → schedule/apply a plan change.
 *   POST /admin/billing/cancel      → schedule/apply cancellation.
 *   POST /admin/billing/resume      → schedule/apply resumption.
 *   GET  /admin/billing/history     → tenant payment and invoice history.
 *   GET  /platform/billing/metrics  → platform MRR/ARR/churn metrics.
 *   POST /billing/webhook          → Razorpay webhook (PUBLIC, signature-verified)
 *                                    flips subscription/tenant to active on payment.
 *
 * Config-driven: with no RAZORPAY_* keys, BILLING_ENABLED is false and subscribe
 * returns a clear "not configured" message (signups stay on free trial). Add the
 * keys to .env to turn real charging on — no code change.
 */
class AdminBillingController
{
    /** GET /admin/billing — subscription status for the current tenant. */
    public function show(Request $request): void
    {
        $tid    = TenantContext::requireId();
        $this->applyDueLifecycle($tid);
        $tenant = PlatformDB::fetch('SELECT status, plan_id FROM tenants WHERE tenant_id = ? LIMIT 1', [$tid]);
        $sub    = PlatformDB::fetch(
            'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY subscription_id DESC LIMIT 1',
            [$tid]
        );
        $plan = $sub ? PlatformDB::fetch('SELECT * FROM plans WHERE plan_id = ? LIMIT 1', [(int)$sub['plan_id']]) : null;

        $daysLeft = null;
        if ($sub && ($sub['status'] === 'trialing') && !empty($sub['trial_ends_at'])) {
            $daysLeft = max(0, (int)ceil((strtotime($sub['trial_ends_at']) - time()) / 86400));
        }

        Response::success([
            'billing_enabled'  => BILLING_ENABLED,
            'razorpay_key_id'  => BILLING_ENABLED ? RAZORPAY_KEY_ID : null,
            'tenant_status'    => $tenant['status'] ?? null,
            'subscription'     => $sub ? [
                'subscription_id' => (int)$sub['subscription_id'],
                'status'        => $sub['status'],
                'billing_cycle' => $sub['billing_cycle'],
                'trial_ends_at' => $sub['trial_ends_at'],
                'current_start' => $sub['current_start'],
                'current_end'   => $sub['current_end'],
                'cancel_at_end' => (bool)$sub['cancel_at_end'],
                'trial_days_left' => $daysLeft,
            ] : null,
            'plan'             => $plan ? [
                'code'          => $plan['code'],
                'name'          => $plan['name'],
                'price_monthly' => (float)$plan['price_monthly'],
                'price_yearly'  => (float)$plan['price_yearly'],
                'currency'      => $plan['currency'],
            ] : null,
            'all_plans'        => PlatformDB::fetchAll(
                'SELECT code, name, price_monthly, price_yearly, currency FROM plans WHERE is_active = 1 ORDER BY sort_order ASC'
            ),
            'scheduled_change' => PlatformDB::fetch(
                "SELECT e.event_id,e.action,e.reason,e.effective_at,e.billing_cycle,p.code AS plan_code,p.name AS plan_name
                 FROM subscription_lifecycle_events e
                 LEFT JOIN plans p ON p.plan_id=e.to_plan_id
                 WHERE e.tenant_id=? AND e.status='scheduled' ORDER BY e.effective_at ASC,e.event_id ASC LIMIT 1",
                [$tid]
            ),
        ]);
    }

    /** POST /admin/billing/change-plan — change now or schedule a future plan change. */
    public function changePlan(Request $request): void
    {
        $tid = TenantContext::requireId();
        $planCode = trim((string)$request->input('plan_code', ''));
        $reason = $this->requiredReason($request);
        $effectiveAt = $this->effectiveAt($request);
        $cycle = $request->input('billing_cycle', 'monthly') === 'yearly' ? 'yearly' : 'monthly';
        $plan = PlatformDB::fetch('SELECT plan_id,code,name FROM plans WHERE code=? AND is_active=1 LIMIT 1', [$planCode]);
        if (!$plan) Response::error('Unknown plan', 422);

        $sub = $this->currentSubscription($tid);
        if ((int)$sub['plan_id'] === (int)$plan['plan_id'] && $sub['billing_cycle'] === $cycle) {
            Response::error('That plan and billing cycle are already selected', 409);
        }
        $eventId = $this->createLifecycleEvent($tid, $sub, 'change_plan', $reason, $effectiveAt, (int)$plan['plan_id'], $cycle, $sub['status']);
        $applied = $this->applyIfDue($eventId, $effectiveAt);
        Response::success(['event_id' => $eventId, 'status' => $applied ? 'applied' : 'scheduled', 'effective_at' => $effectiveAt], $applied ? 'Plan changed' : 'Plan change scheduled');
    }

    /** POST /admin/billing/cancel — cancel now or on a requested future date. */
    public function cancel(Request $request): void
    {
        $tid = TenantContext::requireId();
        $reason = $this->requiredReason($request);
        $effectiveAt = $this->effectiveAt($request);
        $sub = $this->currentSubscription($tid);
        if ($sub['status'] === 'cancelled') Response::error('Subscription is already cancelled', 409);

        $eventId = $this->createLifecycleEvent($tid, $sub, 'cancel', $reason, $effectiveAt, (int)$sub['plan_id'], $sub['billing_cycle'], 'cancelled');
        PlatformDB::execute('UPDATE subscriptions SET cancel_at_end=1,updated_at=NOW() WHERE subscription_id=?', [(int)$sub['subscription_id']]);
        $applied = $this->applyIfDue($eventId, $effectiveAt);
        Response::success(['event_id' => $eventId, 'status' => $applied ? 'applied' : 'scheduled', 'effective_at' => $effectiveAt], $applied ? 'Subscription cancelled' : 'Cancellation scheduled');
    }

    /** POST /admin/billing/resume — resume now or on a requested future date. */
    public function resume(Request $request): void
    {
        $tid = TenantContext::requireId();
        $reason = $this->requiredReason($request);
        $effectiveAt = $this->effectiveAt($request);
        $sub = $this->currentSubscription($tid);
        $pendingCancel = PlatformDB::fetch(
            "SELECT event_id FROM subscription_lifecycle_events WHERE tenant_id=? AND action='cancel' AND status='scheduled' LIMIT 1",
            [$tid]
        );
        if ($sub['status'] === 'active' && !$pendingCancel) Response::error('Subscription is already active', 409);

        if ($pendingCancel) {
            PlatformDB::execute(
                "UPDATE subscription_lifecycle_events SET status='superseded',updated_at=NOW() WHERE tenant_id=? AND action='cancel' AND status='scheduled'",
                [$tid]
            );
            PlatformDB::execute('UPDATE subscriptions SET cancel_at_end=0,updated_at=NOW() WHERE subscription_id=?', [(int)$sub['subscription_id']]);
        }
        $eventId = $this->createLifecycleEvent($tid, $sub, 'resume', $reason, $effectiveAt, (int)$sub['plan_id'], $sub['billing_cycle'], 'active');
        $applied = $this->applyIfDue($eventId, $effectiveAt);
        Response::success(['event_id' => $eventId, 'status' => $applied ? 'applied' : 'scheduled', 'effective_at' => $effectiveAt], $applied ? 'Subscription resumed' : 'Resumption scheduled');
    }

    /** GET /admin/billing/history — control-plane invoice/payment/lifecycle history for this tenant. */
    public function history(Request $request): void
    {
        $tid = TenantContext::requireId();
        $this->applyDueLifecycle($tid);
        $limit = max(1, min(100, (int)$request->query('limit', 50)));
        Response::success([
            'payments' => PlatformDB::fetchAll(
                "SELECT payment_id,billing_invoice_id,gateway,gateway_ref,amount,currency,status,paid_at,created_at
                 FROM billing_payments WHERE tenant_id=? ORDER BY created_at DESC,payment_id DESC LIMIT {$limit}",
                [$tid]
            ),
            'invoices' => PlatformDB::fetchAll(
                "SELECT billing_invoice_id,number,amount,tax,total,currency,status,period_start,period_end,due_at,paid_at,created_at
                 FROM billing_invoices WHERE tenant_id=? ORDER BY created_at DESC,billing_invoice_id DESC LIMIT {$limit}",
                [$tid]
            ),
            'lifecycle' => PlatformDB::fetchAll(
                "SELECT e.event_id,e.action,e.from_status,e.to_status,e.billing_cycle,e.reason,e.effective_at,e.applied_at,e.status,
                        fp.name AS from_plan,tp.name AS to_plan
                 FROM subscription_lifecycle_events e
                 LEFT JOIN plans fp ON fp.plan_id=e.from_plan_id LEFT JOIN plans tp ON tp.plan_id=e.to_plan_id
                 WHERE e.tenant_id=? ORDER BY e.created_at DESC,e.event_id DESC LIMIT {$limit}",
                [$tid]
            ),
        ]);
    }

    /** GET /platform/billing/metrics — cross-tenant control-plane billing metrics. */
    public function metrics(Request $request): void
    {
        $this->applyDueLifecycle(null);
        $recurring = PlatformDB::fetch(
            "SELECT COUNT(*) AS active_subscriptions,
                    COALESCE(SUM(CASE WHEN s.billing_cycle='yearly' THEN p.price_yearly/12 ELSE p.price_monthly END),0) AS mrr
             FROM subscriptions s JOIN plans p ON p.plan_id=s.plan_id WHERE s.status='active'"
        );
        $cancelled = PlatformDB::fetch(
            "SELECT COUNT(*) AS c FROM subscriptions WHERE status='cancelled' AND updated_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)"
        );
        $payments = PlatformDB::fetch(
            "SELECT COALESCE(SUM(amount),0) AS captured_30d FROM billing_payments
             WHERE status IN ('captured','paid') AND created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)"
        );
        $active = (int)($recurring['active_subscriptions'] ?? 0);
        $churned = (int)($cancelled['c'] ?? 0);
        $openingBase = $active + $churned;
        $mrr = round((float)($recurring['mrr'] ?? 0), 2);
        Response::success([
            'mrr' => $mrr,
            'arr' => round($mrr * 12, 2),
            'active_subscriptions' => $active,
            'churn_rate' => $openingBase > 0 ? round(($churned / $openingBase) * 100, 2) : 0.0,
            'churned_30d' => $churned,
            'captured_payments_30d' => round((float)($payments['captured_30d'] ?? 0), 2),
            'currency' => 'INR',
            'period_days' => 30,
        ]);
    }

    /** POST /admin/billing/subscribe — create a Razorpay order for a plan. */
    public function subscribe(Request $request): void
    {
        if (!BILLING_ENABLED) {
            Response::error('Online payments are not configured yet. Please contact billing.', 503);
        }
        $tid      = TenantContext::requireId();
        $planCode = trim((string)$request->input('plan_code', ''));
        $cycle    = $request->input('billing_cycle', 'monthly') === 'yearly' ? 'yearly' : 'monthly';

        $plan = PlatformDB::fetch('SELECT * FROM plans WHERE code = ? AND is_active = 1 LIMIT 1', [$planCode]);
        if (!$plan) Response::error('Unknown plan', 422);

        $amount = (float)($cycle === 'yearly' ? $plan['price_yearly'] : $plan['price_monthly']);
        if ($amount <= 0) {
            // Free plan — activate immediately, no payment needed.
            $this->activate($tid, (int)$plan['plan_id'], $cycle, null, null);
            Response::success(['activated' => true], 'Plan activated');
        }

        $order = $this->razorpay('POST', '/orders', [
            'amount'   => (int)round($amount * 100),       // paise
            'currency' => $plan['currency'] ?: 'INR',
            'receipt'  => 'sub_' . $tid . '_' . time(),
            'notes'    => ['tenant_id' => (string)$tid, 'plan_id' => (string)$plan['plan_id'], 'cycle' => $cycle],
        ]);
        if (!isset($order['id'])) {
            error_log('[Billing] order create failed: ' . json_encode($order));
            Response::error('Could not start checkout. Try again.', 502);
        }
        $updated = PlatformDB::execute(
            'UPDATE subscriptions SET gateway_order_id=?, gateway_expected_amount=?, gateway_currency=?, updated_at=NOW()
             WHERE subscription_id=(SELECT subscription_id FROM (SELECT subscription_id FROM subscriptions WHERE tenant_id=? ORDER BY subscription_id DESC LIMIT 1) s)',
            [(string)$order['id'], (int)$order['amount'], strtoupper((string)$order['currency']), $tid]
        );
        if ($updated === 0) {
            error_log("[Billing] checkout order {$order['id']} created but subscription is missing for tenant {$tid}");
            Response::error('Subscription record is unavailable. Contact billing support.', 409);
        }

        $user = $request->user ?? [];
        Response::success([
            'order_id' => $order['id'],
            'amount'   => $order['amount'],
            'currency' => $order['currency'],
            'key_id'   => RAZORPAY_KEY_ID,
            'name'     => $plan['name'],
            'prefill'  => ['email' => $user['email'] ?? '', 'name' => $user['name'] ?? '', 'contact' => $user['phone'] ?? ''],
        ]);
    }

    /** POST /billing/webhook — Razorpay calls this (public, HMAC-verified). */
    public function webhook(Request $request): void
    {
        $raw = file_get_contents('php://input') ?: '';
        $sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
        if (RAZORPAY_WEBHOOK_SECRET === '' || $sig === ''
            || !hash_equals(hash_hmac('sha256', $raw, RAZORPAY_WEBHOOK_SECRET), $sig)) {
            Response::error('Invalid signature', 400);
        }

        $event = json_decode($raw, true);
        if (!is_array($event)) {
            Response::error('Invalid JSON payload', 400);
        }
        $type = (string)($event['event'] ?? '');
        $eventId = trim((string)($request->header('X-RAZORPAY-EVENT-ID') ?? $event['id'] ?? ''));
        if ($eventId === '') {
            Response::error('Webhook event ID is required', 422);
        }
        $payment = $event['payload']['payment']['entity'] ?? [];
        $order = $event['payload']['order']['entity'] ?? [];
        $notes = is_array($payment['notes'] ?? null) ? $payment['notes'] : (is_array($order['notes'] ?? null) ? $order['notes'] : []);
        $tid = (int)($notes['tenant_id'] ?? 0);

        try {
            $eventRowId = PlatformDB::insert(
                'INSERT INTO billing_webhook_events
                 (tenant_id,gateway,gateway_event_id,event_type,gateway_order_id,gateway_payment_id,status,raw_event,created_at)
                 VALUES (?,"razorpay",?,?,?,?,"processing",?,NOW())',
                [$tid, $eventId, $type, $payment['order_id'] ?? $order['id'] ?? null, $payment['id'] ?? null, $raw]
            );
        } catch (PDOException $e) {
            if ((string)$e->getCode() === '23000') {
                Response::success(['received' => true, 'duplicate' => true]);
            }
            throw $e;
        }

        if (!in_array($type, ['payment.captured', 'order.paid'], true)) {
            $this->finishEvent($eventRowId, 'ignored', 'Event type does not activate subscriptions');
            Response::success(['received' => true, 'ignored' => true]);
        }
        if ($tid <= 0) {
            $this->finishEvent($eventRowId, 'failed', 'Missing tenant_id note');
            Response::success(['received' => true, 'ignored' => true]);
        }

        $subscription = PlatformDB::fetch(
            'SELECT * FROM subscriptions WHERE tenant_id=? ORDER BY subscription_id DESC LIMIT 1',
            [$tid]
        );
        if (!$subscription) {
            error_log("[Billing] webhook {$eventId}: no subscription for tenant {$tid}; safe no-op");
            $this->finishEvent($eventRowId, 'ignored', 'Subscription row missing');
            Response::success(['received' => true, 'ignored' => true]);
        }

        $gatewayOrderId = (string)($payment['order_id'] ?? $order['id'] ?? '');
        $amount = (int)($payment['amount'] ?? $order['amount_paid'] ?? 0);
        $currency = strtoupper((string)($payment['currency'] ?? $order['currency'] ?? ''));
        $expectedOrder = (string)($subscription['gateway_order_id'] ?? '');
        $expectedAmount = (int)($subscription['gateway_expected_amount'] ?? 0);
        $expectedCurrency = strtoupper((string)($subscription['gateway_currency'] ?? ''));
        if ($gatewayOrderId === '' || $expectedOrder === '' || !hash_equals($expectedOrder, $gatewayOrderId)
            || $amount !== $expectedAmount || $currency === '' || $currency !== $expectedCurrency) {
            $reason = "Order/amount/currency mismatch for tenant {$tid}";
            error_log("[Billing] webhook {$eventId}: {$reason}");
            $this->finishEvent($eventRowId, 'failed', $reason);
            Response::success(['received' => true, 'ignored' => true]);
        }
        $alreadyActivated = PlatformDB::fetch(
            'SELECT webhook_event_id FROM billing_webhook_events
             WHERE gateway="razorpay" AND gateway_order_id=? AND status="processed" AND webhook_event_id<>? LIMIT 1',
            [$gatewayOrderId, $eventRowId]
        );
        if ($alreadyActivated) {
            $this->finishEvent($eventRowId, 'ignored', 'Gateway order already processed');
            Response::success(['received' => true, 'duplicate_order' => true]);
        }

        $paymentId = isset($payment['id']) ? (string)$payment['id'] : null;
        if ($paymentId && PlatformDB::fetch('SELECT gateway_ref FROM billing_payments WHERE gateway="razorpay" AND gateway_ref=? LIMIT 1', [$paymentId])) {
            $this->finishEvent($eventRowId, 'ignored', 'Payment already processed');
            Response::success(['received' => true, 'duplicate_payment' => true]);
        }
        $planId = (int)$subscription['plan_id'];
        $cycle = ($subscription['billing_cycle'] ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly';
        $this->activate($tid, $planId, $cycle, $paymentId, $amount / 100);
        $this->finishEvent($eventRowId, 'processed', null);
        Response::success(['received' => true]);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private function currentSubscription(int $tid): array
    {
        $this->applyDueLifecycle($tid);
        $sub = PlatformDB::fetch('SELECT * FROM subscriptions WHERE tenant_id=? ORDER BY subscription_id DESC LIMIT 1', [$tid]);
        if (!$sub) Response::error('Subscription not found', 404);
        return $sub;
    }

    private function requiredReason(Request $request): string
    {
        $reason = trim((string)$request->input('reason', ''));
        if ($reason === '' || mb_strlen($reason) > 500) Response::error('Reason is required and must be 500 characters or fewer', 422);
        return $reason;
    }

    private function effectiveAt(Request $request): string
    {
        $raw = trim((string)$request->input('effective_date', ''));
        if ($raw === '') return date('Y-m-d H:i:s');
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $raw);
        if (!$date || $date->format('Y-m-d') !== $raw) Response::error('effective_date must be YYYY-MM-DD', 422);
        return $date->format('Y-m-d 00:00:00');
    }

    private function createLifecycleEvent(int $tid, array $sub, string $action, string $reason, string $effectiveAt, int $toPlanId, string $cycle, string $toStatus): int
    {
        return PlatformDB::insert(
            "INSERT INTO subscription_lifecycle_events
             (tenant_id,subscription_id,action,from_plan_id,to_plan_id,from_status,to_status,billing_cycle,reason,effective_at,status,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,'scheduled',NOW(),NOW())",
            [$tid, (int)$sub['subscription_id'], $action, (int)$sub['plan_id'], $toPlanId, $sub['status'], $toStatus, $cycle, $reason, $effectiveAt]
        );
    }

    private function applyIfDue(int $eventId, string $effectiveAt): bool
    {
        if (strtotime($effectiveAt) > time()) return false;
        $this->applyLifecycleEvent($eventId);
        return true;
    }

    /** Apply due events for one tenant, or platform-wide when tenantId is null. */
    private function applyDueLifecycle(?int $tenantId): void
    {
        $where = $tenantId === null ? '' : ' AND tenant_id=?';
        $rows = PlatformDB::fetchAll(
            "SELECT event_id FROM subscription_lifecycle_events WHERE status='scheduled' AND effective_at<=NOW(){$where} ORDER BY effective_at,event_id LIMIT 500",
            $tenantId === null ? [] : [$tenantId]
        );
        foreach ($rows as $row) $this->applyLifecycleEvent((int)$row['event_id']);
    }

    private function applyLifecycleEvent(int $eventId): void
    {
        $pdo = PlatformDB::getInstance();
        $pdo->beginTransaction();
        try {
            $event = PlatformDB::fetch('SELECT * FROM subscription_lifecycle_events WHERE event_id=? FOR UPDATE', [$eventId]);
            if (!$event || $event['status'] !== 'scheduled' || strtotime((string)$event['effective_at']) > time()) {
                $pdo->commit();
                return;
            }
            $sub = PlatformDB::fetch('SELECT * FROM subscriptions WHERE subscription_id=? AND tenant_id=? FOR UPDATE', [(int)$event['subscription_id'], (int)$event['tenant_id']]);
            if (!$sub) throw new RuntimeException('Lifecycle subscription no longer exists');

            if ($event['action'] === 'change_plan') {
                PlatformDB::execute('UPDATE subscriptions SET plan_id=?,billing_cycle=?,updated_at=NOW() WHERE subscription_id=?', [(int)$event['to_plan_id'], $event['billing_cycle'], (int)$sub['subscription_id']]);
                PlatformDB::execute('UPDATE tenants SET plan_id=?,updated_at=NOW() WHERE tenant_id=?', [(int)$event['to_plan_id'], (int)$event['tenant_id']]);
            } elseif ($event['action'] === 'cancel') {
                PlatformDB::execute("UPDATE subscriptions SET status='cancelled',cancel_at_end=0,updated_at=NOW() WHERE subscription_id=?", [(int)$sub['subscription_id']]);
                PlatformDB::execute("UPDATE tenants SET status='cancelled',updated_at=NOW() WHERE tenant_id=?", [(int)$event['tenant_id']]);
            } elseif ($event['action'] === 'resume') {
                PlatformDB::execute("UPDATE subscriptions SET status='active',cancel_at_end=0,updated_at=NOW() WHERE subscription_id=?", [(int)$sub['subscription_id']]);
                PlatformDB::execute("UPDATE tenants SET status='active',updated_at=NOW() WHERE tenant_id=?", [(int)$event['tenant_id']]);
            }
            PlatformDB::execute("UPDATE subscription_lifecycle_events SET status='applied',applied_at=NOW(),updated_at=NOW() WHERE event_id=?", [$eventId]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /** Mark a subscription/tenant active and extend the period; record payment. */
    private function activate(int $tid, int $planId, string $cycle, ?string $paymentId, ?float $amount): void
    {
        $interval = $cycle === 'yearly' ? 'INTERVAL 1 YEAR' : 'INTERVAL 1 MONTH';
        PlatformDB::execute(
            "UPDATE subscriptions
             SET plan_id = ?, status = 'active', billing_cycle = ?, current_start = NOW(),
                 current_end = DATE_ADD(NOW(), $interval), gateway = 'razorpay', updated_at = NOW()
             WHERE tenant_id = ?",
            [$planId, $cycle, $tid]
        );
        PlatformDB::execute(
            "UPDATE tenants SET status = 'active', plan_id = ?, updated_at = NOW() WHERE tenant_id = ?",
            [$planId, $tid]
        );
        if ($paymentId) {
            PlatformDB::insert(
                "INSERT INTO billing_payments (tenant_id, gateway, gateway_ref, amount, status, raw_event, created_at)
                 VALUES (?, 'razorpay', ?, ?, 'captured', ?, NOW())",
                [$tid, $paymentId, $amount ?? 0, json_encode(['payment_id' => $paymentId])]
            );
        }
    }

    private function finishEvent(int $eventRowId, string $status, ?string $reason): void
    {
        PlatformDB::execute(
            'UPDATE billing_webhook_events SET status=?,failure_reason=?,processed_at=NOW() WHERE webhook_event_id=?',
            [$status, $reason, $eventRowId]
        );
    }

    /** Minimal Razorpay REST call (Basic auth = key_id:key_secret). */
    private function razorpay(string $method, string $path, array $body): array
    {
        $ch = curl_init('https://api.razorpay.com/v1' . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_USERPWD        => RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $res = curl_exec($ch);
        if ($res === false) { $err = curl_error($ch); curl_close($ch); error_log('[Billing] curl: ' . $err); return []; }
        curl_close($ch);
        return json_decode((string)$res, true) ?: [];
    }
}
