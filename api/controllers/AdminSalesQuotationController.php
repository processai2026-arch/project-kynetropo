<?php
declare(strict_types=1);

/**
 * Quotations sent to a lead — the loop between the meeting and onboarding.
 *
 * POST   /admin/sales/leads/{id}/quotations     — send one (v1), or send again after a rejection
 * POST   /admin/sales/quotations/{id}/answer    — rejected (with why) or accepted
 * DELETE /admin/sales/quotations/{id}           — take back the latest round, entered by mistake
 *
 * Sending moves the lead to "proposal" and its customer (if it has one) to
 * "Quotation Sent"; accepting moves the lead to onboarding and the customer to
 * "Quotation Accepted". Both only ever move forward: a lead or client already
 * further along is left where it is.
 */
class AdminSalesQuotationController
{
    /** Lead statuses that come before a quotation. */
    private const BEFORE_QUOTE = ['new', 'contacted', 'qualified', 'meeting_scheduled'];

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.edit');
        $leadId = (int)$request->param('id');
        $lead   = $this->lead($request, $leadId);

        $latest = SalesQuotation::latest($leadId);
        if ($latest && $latest['status'] === 'sent') {
            Response::error("Quotation v{$latest['version']} is still waiting for an answer — mark it rejected or accepted first", 422);
        }
        if ($latest && $latest['status'] === 'accepted') {
            Response::error("Quotation v{$latest['version']} was already accepted", 422);
        }

        $amount = $this->amount($request->input('amount'));
        $sentOn = $this->date($request->input('sent_on'), 'sent');
        $notes  = trim((string)$request->input('notes', ''));
        $version = $latest ? (int)$latest['version'] + 1 : 1;
        $userId  = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        $id = SalesQuotation::create($leadId, $version, $amount, $sentOn, $notes, $userId);

        $title = ($version === 1 ? 'Quotation sent' : "Quotation v{$version} sent again")
            . ($amount !== null ? ' — ₹' . number_format($amount, 0, '.', ',') : '');
        SalesActivity::log($leadId, 'quotation_sent', $title, $request->user, $notes, 'quotation', $id);

        if (in_array((string)$lead['status'], self::BEFORE_QUOTE, true)) {
            SalesLead::update($leadId, ['status' => 'proposal']);
        }
        $this->moveClient($lead, 'Quotation Sent', $title, $request->user);
        SalesLead::touchActivity($leadId, null);

        Response::success(SalesQuotation::forLead($leadId), $title, 201);
    }

    public function answer(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.edit');
        $row = SalesQuotation::find((int)$request->param('id'));
        if (!$row) {
            Response::error('Quotation not found', 404);
        }
        $leadId = (int)$row['lead_id'];
        $lead   = $this->lead($request, $leadId);

        if ($row['status'] !== 'sent') {
            Response::error("Quotation v{$row['version']} was already {$row['status']}", 422);
        }
        $answer = (string)$request->input('answer', '');
        if (!in_array($answer, SalesQuotation::ANSWERS, true)) {
            Response::error('Answer must be rejected or accepted', 422);
        }
        $note = trim((string)$request->input('note', ''));
        if ($answer === 'rejected' && $note === '') {
            Response::error('Say why it was rejected — price, scope, timing…', 422);
        }
        $on = $this->date($request->input('answered_on'), 'answered');

        SalesQuotation::answer((int)$row['id'], $answer, $on, $note);

        $title = "Quotation v{$row['version']} " . $answer;
        SalesActivity::log($leadId, 'quotation_' . $answer, ucfirst($title), $request->user, $note, 'quotation', (int)$row['id']);

        if ($answer === 'accepted') {
            if (in_array((string)$lead['status'], [...self::BEFORE_QUOTE, 'proposal'], true)) {
                SalesLead::update($leadId, ['status' => 'onboarding']);
                SalesActivity::log($leadId, 'lead_onboarding', 'Moved to onboarding — quotation accepted', $request->user);
            }
            $this->moveClient($lead, 'Quotation Accepted', ucfirst($title), $request->user);
        }
        SalesLead::touchActivity($leadId, null);

        Response::success(SalesQuotation::forLead($leadId), ucfirst($title));
    }

    public function destroy(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.edit');
        $row = SalesQuotation::find((int)$request->param('id'));
        if (!$row) {
            Response::error('Quotation not found', 404);
        }
        $leadId = (int)$row['lead_id'];
        $this->lead($request, $leadId);

        // Only the last round: removing one from the middle would leave the story with a hole.
        $latest = SalesQuotation::latest($leadId);
        if (!$latest || (int)$latest['id'] !== (int)$row['id']) {
            Response::error('Only the latest quotation can be removed', 422);
        }
        SalesQuotation::remove((int)$row['id']);
        SalesActivity::log($leadId, 'quotation_removed', "Quotation v{$row['version']} removed", $request->user, '', 'quotation', (int)$row['id']);

        Response::success(SalesQuotation::forLead($leadId), 'Quotation removed');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function lead(Request $request, int $leadId): array
    {
        $lead = SalesLead::findRaw($leadId);
        if (!$lead) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $lead);
        return $lead;
    }

    private function amount($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_numeric($value) || (float)$value < 0) {
            Response::error('Amount must be a number', 422);
        }
        return round((float)$value, 2);
    }

    private function date($value, string $what): string
    {
        $value = trim((string)$value);
        if ($value === '') {
            return date('Y-m-d');
        }
        $d = DateTime::createFromFormat('Y-m-d', $value);
        if (!$d || $d->format('Y-m-d') !== $value) {
            Response::error("The date it was $what on is not a valid date", 422);
        }
        if ($value > date('Y-m-d')) {
            Response::error("The date it was $what on cannot be in the future", 422);
        }
        return $value;
    }

    /**
     * Moves the lead's customer forward to $stage — never back. A client keyed
     * in before quotations were tracked may be far past this point already.
     */
    private function moveClient(array $lead, string $stage, string $why, ?array $actor): void
    {
        $clientId = (int)($lead['converted_client_id'] ?? 0);
        if ($clientId <= 0) {
            return;
        }
        $tenantId = Database::tenantId();
        $client   = Database::fetch('SELECT id, stage FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1', [$clientId, $tenantId]);
        if (!$client) {
            return;
        }
        $stages = AdminOpsClientController::STAGES;
        $now    = array_search((string)$client['stage'], $stages, true);
        $target = array_search($stage, $stages, true);
        if ($target === false || ($now !== false && $now >= $target)) {
            return;
        }
        Database::update('ops_clients', ['stage' => $stage], ['id' => $clientId, 'tenant_id' => $tenantId]);
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'client',
            'entity_id'   => $clientId,
            'action'      => 'stage_changed',
            'description' => "Stage advanced to {$stage} — {$why}",
            'done_by'     => (string)($actor['name'] ?? ''),
        ]);
    }
}
