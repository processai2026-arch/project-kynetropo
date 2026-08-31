<?php
declare(strict_types=1);

/**
 * Admin Quote Request Controller
 * GET  /admin/quote-requests              — list
 * GET  /admin/quote-requests/{id}         — single
 * PUT  /admin/quote-requests/{id}         — update status / admin notes / quoted price / valid_until (sends email via Mailer)
 * POST /admin/quote-requests/{id}/accept  — record customer acceptance (who/when)
 * POST /admin/quote-requests/{id}/decline — record customer decline (who/when/reason)
 * POST /admin/quote-requests/{id}/convert-to-order — turn an accepted quote into a sales order
 */
class AdminQuoteController
{
    /** Current tenant's company name from settings, with a neutral fallback. */
    private static function companyName(): string
    {
        try {
            $row = Database::fetch(
                "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_name' LIMIT 1",
                [Database::tenantId()]
            );
            if (!empty($row['setting_value'])) {
                return $row['setting_value'];
            }
        } catch (\Throwable $e) {
            // fall through to default
        }
        return 'Your Company';
    }

    /** Current tenant's company support email from settings, with a neutral fallback. */
    private static function companyEmail(): string
    {
        try {
            $row = Database::fetch(
                "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_email' LIMIT 1",
                [Database::tenantId()]
            );
            if (!empty($row['setting_value'])) {
                return $row['setting_value'];
            }
        } catch (\Throwable $e) {
            // fall through to default
        }
        return 'noreply@kynetropo.com';
    }

    /** DB status → UI status */
    private static function toUiStatus(string $raw): string
    {
        return match ($raw) {
            'contacted'          => 'Contacted',
            'sent'               => 'Contacted', // legacy value
            'quoted'             => 'Quoted',
            'closed'             => 'Closed',
            default              => 'New',
        };
    }

    /** UI status → DB status */
    private static function toDbStatus(string $ui): string
    {
        return match ($ui) {
            'Contacted' => 'contacted',
            'Quoted'    => 'quoted',
            'Closed'    => 'closed',
            default     => 'pending',
        };
    }

    /**
     * Parse savings calculator data out of the free-text message column.
     * Format: "Customer uses 100 kg of LPG at ₹85/kg (₹8500/month).
     *          They need 283 kg/month of Biomass Pellets (≈ ₹3967/month), saving ₹4533/month."
     */
    private static function parseMessage(string $msg): array
    {
        $n = fn(string $s): float => (float)preg_replace('/[^\d.]/', '', $s);

        // current_fuel  — "100 kg of LPG"
        $currentFuel = null;
        if (preg_match('/\d+\s*kg\s+of\s+([A-Za-z0-9\s]+?)\s+at\s+/u', $msg, $m)) {
            $currentFuel = trim($m[1]);
        }

        // current_cost  — first "₹NNNN/month)" occurrence
        $currentCost = null;
        if (preg_match('/₹([\d,]+(?:\.\d+)?)\/month\)/u', $msg, $m)) {
            $currentCost = $n($m[1]);
        }

        // quantity_per_month  — "283 kg/month of"
        $quantityPerMonth = null;
        if (preg_match('/([\d,]+)\s*kg\/month\s+of/u', $msg, $m)) {
            $quantityPerMonth = $n($m[1]);
        }

        // product  — "kg/month of Biomass Pellets ("
        $product = null;
        if (preg_match('/kg\/month\s+of\s+(.+?)\s*\(/u', $msg, $m)) {
            $product = trim($m[1]);
        }

        // biomass_cost  — "≈ ₹NNNN/month)"
        $biomassCost = null;
        if (preg_match('/[≈~]\s*₹([\d,]+(?:\.\d+)?)\/month\)/u', $msg, $m)) {
            $biomassCost = $n($m[1]);
        }

        // monthly_savings  — "saving ₹NNNN/month"
        $monthlySavings = null;
        if (preg_match('/saving\s+₹([\d,]+(?:\.\d+)?)\/month/u', $msg, $m)) {
            $monthlySavings = $n($m[1]);
        }

        $annualSavings = $monthlySavings !== null ? round($monthlySavings * 12, 2) : null;

        return compact('currentFuel', 'currentCost', 'quantityPerMonth', 'product', 'biomassCost', 'monthlySavings', 'annualSavings');
    }

    private static function normalizeRow(array $row): array
    {
        $row['status']       = self::toUiStatus($row['status'] ?? '');
        $row['admin_notes']  = $row['admin_notes']  ?? '';
        $row['quoted_price'] = $row['quoted_price'] ?? '';

        // Acceptance / decline / validity / delivery tracking (P1/P2 gap closure)
        $row['valid_until']           = $row['valid_until']           ?? null;
        $row['accepted_at']           = $row['accepted_at']           ?? null;
        $row['accepted_by']           = isset($row['accepted_by']) && $row['accepted_by'] !== null ? (int)$row['accepted_by'] : null;
        $row['declined_at']           = $row['declined_at']           ?? null;
        $row['decline_reason']        = $row['decline_reason']        ?? '';
        $row['decided_by_name']       = $row['decided_by_name']       ?? '';
        $row['email_sent_at']         = $row['email_sent_at']         ?? null;
        $row['email_delivery_status'] = $row['email_delivery_status'] ?? null;
        $row['sales_document_id']     = isset($row['sales_document_id']) && $row['sales_document_id'] !== null ? (int)$row['sales_document_id'] : null;
        $row['converted_order_id']    = isset($row['converted_order_id']) && $row['converted_order_id'] !== null ? (int)$row['converted_order_id'] : null;
        $row['decision'] = $row['accepted_at'] ? 'accepted' : ($row['declined_at'] ? 'declined' : 'pending');

        foreach (['quantity_per_month','current_cost','biomass_cost','monthly_savings','annual_savings'] as $f) {
            $row[$f] = isset($row[$f]) && $row[$f] !== null ? (float)$row[$f] : null;
        }

        // If the new columns are empty, fall back to parsing the message
        $needsFallback = empty($row['current_fuel']) && $row['quantity_per_month'] === null;
        if ($needsFallback && !empty($row['message'])) {
            $parsed = self::parseMessage((string)$row['message']);
            $row['product']           = $row['product']           ?: ($parsed['product']           ?? '');
            $row['current_fuel']      = $row['current_fuel']      ?: ($parsed['currentFuel']       ?? '');
            $row['quantity_per_month'] = $row['quantity_per_month'] ?? $parsed['quantityPerMonth'];
            $row['current_cost']      = $row['current_cost']      ?? $parsed['currentCost'];
            $row['biomass_cost']      = $row['biomass_cost']      ?? $parsed['biomassCost'];
            $row['monthly_savings']   = $row['monthly_savings']   ?? $parsed['monthlySavings'];
            $row['annual_savings']    = $row['annual_savings']    ?? $parsed['annualSavings'];
        }

        $row['product']      = $row['product']      ?? '';
        $row['current_fuel'] = $row['current_fuel'] ?? '';

        return $row;
    }

    private static function quoteEmailBody(array $quote, string $quotedPrice, string $adminNotes, ?string $validUntil = null): string
    {
        $tenantCompanyName = self::companyName();
        $tenantSupportEmail = self::companyEmail();
        $name    = htmlspecialchars($quote['name'] ?? '');
        $product = htmlspecialchars($quote['product'] ?? 'Biomass Pellets');
        $price   = htmlspecialchars($quotedPrice);

        $fmt = fn($n) => ($n !== null && $n !== '') ? '₹' . number_format((float)$n, 0) : '—';

        $savingsRows = '';
        if (!empty($quote['current_fuel'])) {
            $fuel = htmlspecialchars($quote['current_fuel']);
            $savingsRows = "
              <tr><td style='padding:6px 0;color:#6b7280;'>Current Fuel</td><td style='padding:6px 0;font-weight:600;'>{$fuel}</td></tr>
              <tr><td style='padding:6px 0;color:#6b7280;'>Current Monthly Cost</td><td style='padding:6px 0;'>{$fmt($quote['current_cost'])}/month</td></tr>
              <tr><td style='padding:6px 0;color:#6b7280;'>With Biomass Pellets</td><td style='padding:6px 0;'>{$fmt($quote['biomass_cost'])}/month</td></tr>
              <tr><td style='padding:6px 0;color:#059669;font-weight:600;'>Monthly Savings</td><td style='padding:6px 0;color:#059669;font-weight:600;'>{$fmt($quote['monthly_savings'])}/month</td></tr>
              <tr><td style='padding:6px 0;color:#059669;font-weight:600;'>Annual Savings</td><td style='padding:6px 0;color:#059669;font-weight:600;'>{$fmt($quote['annual_savings'])}/year</td></tr>";
        }

        $savingsBlock = $savingsRows ? "
            <table width='100%' cellpadding='0' cellspacing='0' style='background:#f9fafb;border-radius:8px;padding:16px 20px;font-size:14px;margin:16px 0;'>
              {$savingsRows}
            </table>" : '';

        $notesBlock = !empty($adminNotes) ? "
            <div style='background:#f9fafb;border-radius:8px;padding:16px 20px;margin:16px 0;font-size:14px;'>
              <p style='margin:0 0 6px;font-weight:600;color:#374151;'>Additional Notes</p>
              <p style='margin:0;color:#4b5563;'>" . nl2br(htmlspecialchars($adminNotes)) . "</p>
            </div>" : '';

        $validUntilBlock = !empty($validUntil) ? "
            <p style='margin:0 0 16px;color:#b45309;font-size:13px;background:#fffbeb;border-radius:6px;padding:8px 12px;'>
              This quote is valid until <strong>" . htmlspecialchars(date('d M Y', strtotime($validUntil))) . "</strong>.
            </p>" : '';

        return <<<HTML
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                <tr>
                  <td style="background:#16a34a;padding:28px 36px;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;">{$tenantCompanyName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 36px;">
                    <h2 style="margin:0 0 8px;color:#111827;font-size:18px;">Your Custom Quote is Ready</h2>
                    <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">Dear {$name},<br><br>Thank you for your interest in our biomass solutions. We have reviewed your request and are pleased to provide you with a custom quote.</p>

                    <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;">
                      <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">{$product}</p>
                      <p style="margin:0;font-size:26px;font-weight:700;color:#15803d;">{$price}</p>
                    </div>

                    {$savingsBlock}
                    {$validUntilBlock}
                    {$notesBlock}

                    <p style="margin:20px 0 4px;color:#4b5563;font-size:14px;">To place an order or ask any questions, reply to this email or contact us at <a href="mailto:{$tenantSupportEmail}" style="color:#16a34a;">{$tenantSupportEmail}</a>.</p>
                    <p style="margin:0;color:#4b5563;font-size:14px;">Best regards,<br>The {$tenantCompanyName} Team</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; {$tenantCompanyName} &middot; This is an automated message, please do not reply directly.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        HTML;
    }

    public function index(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(100, max(1, (int)$request->query('limit', 50)));

        $where  = ['tenant_id = ?'];
        $params = [Database::tenantId()];

        $uiStatus = $request->query('status');
        if ($uiStatus && in_array($uiStatus, ['New', 'Contacted', 'Quoted', 'Closed'], true)) {
            $where[]  = 'status = ?';
            $params[] = self::toDbStatus($uiStatus);
        }

        $search = $request->query('search');
        if ($search && trim($search) !== '') {
            $like     = '%' . trim($search) . '%';
            $where[]  = '(name LIKE ? OR phone LIKE ? OR email LIKE ? OR quote_number LIKE ?)';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM quotes WHERE $whereClause", $params);
        $offset = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT quote_id, user_id, quote_number, name, email, phone, message,
                    product, quantity_per_month, current_fuel, current_cost,
                    biomass_cost, monthly_savings, annual_savings,
                    admin_notes, quoted_price, valid_until,
                    accepted_at, accepted_by, declined_at, decline_reason, decided_by_name,
                    email_sent_at, email_delivery_status, sales_document_id, converted_order_id,
                    status, created_at
             FROM quotes
             WHERE $whereClause
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        $rows = array_map([self::class, 'normalizeRow'], $rows);

        Response::paginated($rows, [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    public function show(Request $request): void
    {
        $quoteId = (int)$request->param('id');
        if ($quoteId <= 0) {
            Response::error('Invalid quote ID', 400);
        }

        $row = Database::fetch(
            "SELECT quote_id, user_id, quote_number, name, email, phone, message,
                    product, quantity_per_month, current_fuel, current_cost,
                    biomass_cost, monthly_savings, annual_savings,
                    admin_notes, quoted_price, valid_until,
                    accepted_at, accepted_by, declined_at, decline_reason, decided_by_name,
                    email_sent_at, email_delivery_status, sales_document_id, converted_order_id,
                    status, created_at
             FROM quotes WHERE quote_id = ? AND tenant_id = ? LIMIT 1",
            [$quoteId, Database::tenantId()]
        );

        if (!$row) {
            Response::error('Quote request not found', 404);
        }

        Response::success(self::normalizeRow($row), 'Quote details retrieved');
    }

    public function update(Request $request): void
    {
        $quoteId = (int)$request->param('id');
        if ($quoteId <= 0) {
            Response::error('Invalid quote ID', 400);
        }

        $quote = Database::fetch(
            'SELECT quote_id, user_id, quote_number, name, email, phone, message, product,
                    quantity_per_month, quoted_price, status, valid_until, sales_document_id
             FROM quotes WHERE quote_id = ? AND tenant_id = ? LIMIT 1',
            [$quoteId, Database::tenantId()]
        );
        if (!$quote) {
            Response::error('Quote request not found', 404);
        }

        $uiStatus = (string)$request->input('status', 'New');
        if (!in_array($uiStatus, ['New', 'Contacted', 'Quoted', 'Closed'], true)) {
            Response::error('Invalid status. Allowed: New, Contacted, Quoted, Closed', 422);
        }

        $dbStatus    = self::toDbStatus($uiStatus);
        $adminNotes  = trim((string)$request->input('admin_notes',  ''));
        $quotedPrice = trim((string)$request->input('quoted_price', ''));

        // Quote validity (valid_until) — optional date, defaults to 30 days out when first quoted
        $validUntilInput = $request->input('valid_until');
        $validUntil = $quote['valid_until'] ?? null;
        if ($validUntilInput !== null && trim((string)$validUntilInput) !== '') {
            $ts = strtotime((string)$validUntilInput);
            if ($ts === false) {
                Response::error('Invalid valid_until date', 422);
            }
            $validUntil = date('Y-m-d', $ts);
        } elseif ($uiStatus === 'Quoted' && empty($validUntil)) {
            $validUntil = date('Y-m-d', strtotime('+30 days'));
        }

        Database::execute(
            'UPDATE quotes SET status = ?, admin_notes = ?, quoted_price = ?, valid_until = ? WHERE quote_id = ? AND tenant_id = ?',
            [$dbStatus, $adminNotes, $quotedPrice, $validUntil, $quoteId, Database::tenantId()]
        );

        // Send email when status is Quoted and a price is provided — routed through the
        // configured Mailer so delivery actually happens (and the result is recorded),
        // instead of flipping a status and suppress-calling the bare mail() function.
        $emailSent = false;
        if ($uiStatus === 'Quoted' && !empty($quotedPrice) && !empty($quote['email'])) {
            // Enrich quote with parsed calculator data for email template
            $parsed = self::parseMessage((string)($quote['message'] ?? ''));
            $quoteForEmail = array_merge([
                'product'           => $parsed['product']           ?? '',
                'current_fuel'      => $parsed['currentFuel']       ?? '',
                'current_cost'      => $parsed['currentCost']       ?? null,
                'biomass_cost'      => $parsed['biomassCost']       ?? null,
                'monthly_savings'   => $parsed['monthlySavings']    ?? null,
                'annual_savings'    => $parsed['annualSavings']     ?? null,
            ], $quote);

            $tenantCompanyName = self::companyName();
            $subject = "Your Custom Quote from {$tenantCompanyName}";
            $body    = self::quoteEmailBody($quoteForEmail, $quotedPrice, $adminNotes, $validUntil);

            $emailSent = Mailer::send($quote['email'], $subject, $body);

            Database::execute(
                'UPDATE quotes SET email_sent_at = NOW(), email_delivery_status = ? WHERE quote_id = ? AND tenant_id = ?',
                [$emailSent ? 'sent' : 'failed', $quoteId, Database::tenantId()]
            );

            // Link the inbound request to a structured quotation document so the two
            // quote representations (free-form request vs. sales_documents quotation)
            // stay connected instead of diverging.
            try {
                $this->syncSalesDocument($quoteId, $quote, $quotedPrice, $validUntil, $request);
            } catch (\Throwable $e) {
                error_log('[AdminQuoteController::update] sales document sync failed: ' . $e->getMessage());
            }
        }

        Response::success(
            [
                'quote_id'    => $quoteId,
                'status'      => $uiStatus,
                'valid_until' => $validUntil,
                'email_sent'  => $emailSent,
            ],
            $emailSent ? 'Quote sent to customer via email'
                : ($uiStatus === 'Quoted' && !empty($quotedPrice) ? 'Quote saved — email delivery failed' : 'Quote request updated')
        );
    }

    // ─── POST /admin/quote-requests/{id}/accept — record customer acceptance ──
    public function accept(Request $request): void
    {
        $quoteId = (int)$request->param('id');
        $quote   = $this->findOrFail($quoteId);

        if (!empty($quote['converted_order_id'])) {
            Response::error('Quote has already been converted to an order', 409);
        }

        $decidedByName = trim((string)$request->input('decided_by_name', '')) ?: $quote['name'];

        Database::execute(
            'UPDATE quotes
             SET status = "closed", accepted_at = NOW(), accepted_by = ?, decided_by_name = ?,
                 declined_at = NULL, decline_reason = NULL
             WHERE quote_id = ? AND tenant_id = ?',
            [$this->actorId($request) ?: null, $decidedByName, $quoteId, Database::tenantId()]
        );

        // Mirror the acceptance onto the linked structured quotation, if any.
        if (!empty($quote['sales_document_id'])) {
            $doc = SalesDocument::raw((int)$quote['sales_document_id']);
            if ($doc && in_array($doc['status'], ['draft', 'sent'], true)) {
                SalesDocument::transition((int)$quote['sales_document_id'], 'accepted');
            }
        }

        Response::success(self::normalizeRow($this->findOrFail($quoteId)), 'Quote marked as accepted by customer');
    }

    // ─── POST /admin/quote-requests/{id}/decline — record customer decline ────
    public function decline(Request $request): void
    {
        $quoteId = (int)$request->param('id');
        $quote   = $this->findOrFail($quoteId);

        if (!empty($quote['converted_order_id'])) {
            Response::error('Quote has already been converted to an order', 409);
        }

        $reason        = trim((string)$request->input('reason', ''));
        $decidedByName = trim((string)$request->input('decided_by_name', '')) ?: $quote['name'];

        Database::execute(
            'UPDATE quotes
             SET status = "closed", declined_at = NOW(), decline_reason = ?, decided_by_name = ?,
                 accepted_at = NULL, accepted_by = NULL
             WHERE quote_id = ? AND tenant_id = ?',
            [$reason ?: null, $decidedByName, $quoteId, Database::tenantId()]
        );

        if (!empty($quote['sales_document_id'])) {
            $doc = SalesDocument::raw((int)$quote['sales_document_id']);
            if ($doc && in_array($doc['status'], ['draft', 'sent'], true)) {
                SalesDocument::transition((int)$quote['sales_document_id'], 'rejected');
            }
        }

        Response::success(self::normalizeRow($this->findOrFail($quoteId)), 'Quote marked as declined by customer');
    }

    // ─── POST /admin/quote-requests/{id}/convert-to-order — accepted quote -> sales order ─
    public function convertToOrder(Request $request): void
    {
        $quoteId = (int)$request->param('id');
        $quote   = $this->findOrFail($quoteId);

        if (empty($quote['accepted_at'])) {
            Response::error('Only an accepted quote can be converted to an order', 409);
        }
        if (!empty($quote['converted_order_id'])) {
            Response::error('Quote has already been converted to an order: #' . $quote['converted_order_id'], 409);
        }

        // Resolve the customer to an existing user record (quote_id has a user_id from submission).
        $userId = (int)($quote['user_id'] ?? 0);
        if ($userId <= 0) {
            Response::error('Quote has no linked customer account; cannot create an order', 422);
        }
        $user = Database::fetch('SELECT user_id, address, city, state, pincode FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, Database::tenantId()]);
        if (!$user) {
            Response::error('Linked customer account not found', 404);
        }

        // Build order line items — prefer the structured quotation's line items when one
        // is linked; otherwise fall back to a single line item built from the free-form
        // quoted_price / product captured on the inbound request.
        $items = [];
        if (!empty($quote['sales_document_id'])) {
            $docItems = SalesDocument::items((int)$quote['sales_document_id']);
            foreach ($docItems as $di) {
                if (empty($di['product_id'])) {
                    continue; // orders require a real product_id; skip free-text lines
                }
                $items[] = [
                    'product_id' => (int)$di['product_id'],
                    'config_id'  => null,
                    'quantity'   => max(1, (int)round((float)$di['quantity'])),
                    'unit_price' => (float)$di['unit_price'],
                    'size'       => null,
                    'purpose'    => null,
                    'sub_purpose'=> null,
                ];
            }
        }

        if (empty($items)) {
            // Free-form fallback: try to match the quote's product name to a product record.
            $productId = null;
            if (!empty($quote['product'])) {
                $match = Database::fetch(
                    'SELECT product_id FROM products WHERE tenant_id = ? AND product_name LIKE ? AND is_available = 1 LIMIT 1',
                    [Database::tenantId(), '%' . $quote['product'] . '%']
                );
                $productId = $match['product_id'] ?? null;
            }
            if (!$productId) {
                Response::error('Could not determine a product for this quote. Link a structured quotation with line items first.', 422);
            }
            $unitPrice = (float)preg_replace('/[^\d.]/', '', (string)($quote['quoted_price'] ?? '0'));
            $quantity  = (int)round((float)($quote['quantity_per_month'] ?? 1)) ?: 1;
            $items[] = [
                'product_id' => (int)$productId,
                'config_id'  => null,
                'quantity'   => $quantity,
                'unit_price' => $unitPrice ?: 0,
                'size'       => null,
                'purpose'    => null,
                'sub_purpose'=> null,
            ];
        }

        $meta = [
            'payment_method'   => null,
            'delivery_address' => $user['address']  ?? null,
            'delivery_city'    => $user['city']     ?? null,
            'delivery_state'   => $user['state']    ?? null,
            'delivery_pincode' => $user['pincode']  ?? null,
            'notes'            => 'Created from quote ' . ($quote['quote_number'] ?? ('#' . $quoteId)),
        ];

        try {
            $orderId = Order::create($userId, $items, $meta);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }

        Database::execute(
            'UPDATE quotes SET converted_order_id = ?, status = "closed" WHERE quote_id = ? AND tenant_id = ?',
            [$orderId, $quoteId, Database::tenantId()]
        );

        if (!empty($quote['sales_document_id'])) {
            $doc = SalesDocument::raw((int)$quote['sales_document_id']);
            if ($doc && $doc['status'] === 'accepted') {
                SalesDocument::transition((int)$quote['sales_document_id'], 'converted');
            }
        }

        Response::success(
            ['quote_id' => $quoteId, 'order_id' => $orderId, 'order' => Order::findById($orderId)],
            'Quote converted to order successfully',
            201
        );
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private function findOrFail(int $quoteId): array
    {
        if ($quoteId <= 0) {
            Response::error('Invalid quote ID', 400);
        }
        $row = Database::fetch(
            "SELECT quote_id, user_id, quote_number, name, email, phone, message,
                    product, quantity_per_month, current_fuel, current_cost,
                    biomass_cost, monthly_savings, annual_savings,
                    admin_notes, quoted_price, valid_until,
                    accepted_at, accepted_by, declined_at, decline_reason, decided_by_name,
                    email_sent_at, email_delivery_status, sales_document_id, converted_order_id,
                    status, created_at
             FROM quotes WHERE quote_id = ? AND tenant_id = ? LIMIT 1",
            [$quoteId, Database::tenantId()]
        );
        if (!$row) {
            Response::error('Quote request not found', 404);
        }

        return $row;
    }

    private function actorId(Request $request): int
    {
        return isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
    }

    /**
     * Create (once) or refresh a structured `sales_documents` quotation linked to this
     * inbound quote request, so the two representations don't diverge (gap analysis:
     * "the inbound request flow ... does not create or link a structured sales document").
     */
    private function syncSalesDocument(int $quoteId, array $quote, string $quotedPrice, ?string $validUntil, Request $request): void
    {
        $unitPrice = (float)preg_replace('/[^\d.]/', '', $quotedPrice);
        if ($unitPrice <= 0) {
            return; // nothing meaningful to quote yet
        }
        $quantity = (float)($quote['quantity_per_month'] ?? 0) ?: 1.0;
        $product  = trim((string)($quote['product'] ?? '')) ?: 'Biomass Pellets';

        $items = [[
            'product_id' => null,
            'description' => $product,
            'hsn_code' => null,
            'quantity' => $quantity,
            'unit' => 'kg',
            'unit_price' => $unitPrice,
            'gst_rate' => 0,
            'sort_order' => 1,
        ]];

        $existingDocId = (int)($quote['sales_document_id'] ?? 0);
        if ($existingDocId > 0) {
            $existingDoc = SalesDocument::raw($existingDocId);
            if ($existingDoc && in_array($existingDoc['status'], ['draft'], true)) {
                SalesDocument::updateEditable($existingDocId, [
                    'valid_until' => $validUntil,
                ], $items);
                SalesDocument::transition($existingDocId, 'sent');
                return;
            }
            if ($existingDoc) {
                return; // already sent/accepted/etc — leave it alone
            }
        }

        $data = [
            'document_type'   => 'quotation',
            'document_number' => NumberSequence::next('QTN'),
            'source_quote_id' => $quoteId,
            'source_document_id' => null,
            'user_id'         => $quote['user_id'] ?? null,
            'customer_name'   => $quote['name'] ?? '',
            'customer_email'  => $quote['email'] ?? '',
            'customer_phone'  => $quote['phone'] ?? '',
            'customer_gstin'  => null,
            'customer_state'  => null,
            'customer_address'=> null,
            'customer_city'   => null,
            'customer_pincode'=> null,
            'customer_country'=> null,
            'seller_state'    => 'Tamil Nadu',
            'document_date'   => date('Y-m-d'),
            'valid_until'     => $validUntil,
            'due_date'        => null,
            'payment_terms'   => null,
            'place_of_supply' => null,
            'ship_to'         => null,
            'subject'         => 'Quote request ' . ($quote['quote_number'] ?? ('#' . $quoteId)),
            'terms'           => null,
            'notes'           => $quote['message'] ?? null,
            'created_by'      => $this->actorId($request) ?: null,
        ];

        $docId = SalesDocument::create($data, $items);
        SalesDocument::transition($docId, 'sent');

        Database::execute(
            'UPDATE quotes SET sales_document_id = ? WHERE quote_id = ? AND tenant_id = ?',
            [$docId, $quoteId, Database::tenantId()]
        );
    }
}
