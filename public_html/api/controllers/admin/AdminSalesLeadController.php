<?php
declare(strict_types=1);

/**
 * Sales Leads Controller
 *
 *   GET    /admin/sales/leads                  — list/filter (record-scoped)
 *   GET    /admin/sales/leads/{id}             — detail + timeline + calls/meetings/follow-ups
 *   POST   /admin/sales/leads                  — create
 *   PUT    /admin/sales/leads/{id}             — update
 *   PUT    /admin/sales/leads/{id}/temperature — hot / warm / cold
 *   PUT    /admin/sales/leads/{id}/assign      — assign to a sales user
 *   POST   /admin/sales/leads/{id}/convert     — onboarding -> customer (ops_clients)
 *   DELETE /admin/sales/leads/{id}             — delete
 *
 * Every action re-checks permission AND record access on the server; the
 * frontend's visibility rules are never trusted.
 */
class AdminSalesLeadController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.view');

        $scope  = SalesPermissions::leadScope($request->user);
        $result = SalesLead::all([
            'search'        => $request->query('search'),
            'temperature'   => $request->query('temperature'),
            'status'        => $request->query('status'),
            'assigned_to'   => $request->query('assigned_to'),
            'source'        => $request->query('source'),
            'followup_from' => $request->query('followup_from'),
            'followup_to'   => $request->query('followup_to'),
            'meeting_from'  => $request->query('meeting_from'),
            'created_from'  => $request->query('created_from'),
            'created_to'    => $request->query('created_to'),
        ], $scope, (int)$request->query('page', 1), (int)$request->query('limit', 100));

        Response::paginated($result['rows'], $result['pagination']);
    }

    public function show(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.view');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $raw);

        $lead = SalesLead::find($id);
        $lead['calls']      = SalesCall::forLead($id);
        $lead['followups']  = SalesFollowup::forLead($id);
        $lead['meetings']   = SalesMeeting::forLead($id);
        $lead['timeline']   = SalesActivity::forLead($id);

        Response::success($lead);
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.create');

        $name = trim((string)$request->input('name', ''));
        if (mb_strlen($name) < 2) {
            Response::error('Lead name is required', 422);
        }

        $email = trim((string)$request->input('email', ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address', 422);
        }

        $temperature = $this->validTemperature($request->input('temperature', 'warm'));
        $status      = $this->validStatus($request->input('status', 'new'));

        // Only someone who may assign leads can hand one to another user;
        // everyone else creates leads owned by themselves.
        $assignedTo = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
        if ($request->input('assigned_to') !== null && SalesPermissions::has($request->user, 'sales.leads.assign')) {
            $assignedTo = !empty($request->input('assigned_to')) ? (int)$request->input('assigned_to') : null;
            $this->assertSalesUser($assignedTo);
        }

        $id = SalesLead::create([
            'name'           => $name,
            'company'        => trim((string)$request->input('company', '')),
            'contact_person' => trim((string)$request->input('contact_person', '')),
            'phone'          => trim((string)$request->input('phone', '')),
            'email'          => $email,
            'source'         => trim((string)$request->input('source', '')),
            'assigned_to'    => $assignedTo,
            'status'         => $status,
            'temperature'    => $temperature,
            'notes'          => $request->input('notes'),
        ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

        SalesActivity::log($id, 'lead_created', 'Lead created', $request->user, $name);

        Response::success(SalesLead::find($id), 'Lead created', 201);
    }

    public function update(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.edit');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $raw);

        $data = [];
        foreach (['name', 'company', 'contact_person', 'phone', 'source', 'notes'] as $col) {
            if ($request->input($col) !== null) {
                $data[$col] = $request->input($col);
            }
        }

        if ($request->input('email') !== null) {
            $email = trim((string)$request->input('email'));
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Response::error('Invalid email address', 422);
            }
            $data['email'] = $email;
        }
        if ($request->input('status') !== null) {
            $data['status'] = $this->validStatus($request->input('status'));
        }
        if ($request->input('temperature') !== null) {
            $data['temperature'] = $this->validTemperature($request->input('temperature'));
        }
        // Reassignment goes through the dedicated, permission-gated endpoint.
        if ($request->input('assigned_to') !== null) {
            SalesPermissions::enforce($request->user, 'sales.leads.assign');
            $assignedTo = !empty($request->input('assigned_to')) ? (int)$request->input('assigned_to') : null;
            $this->assertSalesUser($assignedTo);
            $data['assigned_to'] = $assignedTo;
        }

        if (!$data) {
            Response::error('Nothing to update', 400);
        }

        SalesLead::update($id, $data);

        if (isset($data['temperature']) && $data['temperature'] !== $raw['temperature']) {
            SalesActivity::log(
                $id, 'temperature_changed',
                'Temperature changed to ' . strtoupper($data['temperature']),
                $request->user,
                'From ' . strtoupper((string)$raw['temperature'])
            );
        } else {
            SalesActivity::log($id, 'lead_updated', 'Lead details updated', $request->user);
        }

        Response::success(SalesLead::find($id), 'Lead updated');
    }

    /** PUT /admin/sales/leads/{id}/temperature — quick HOT/WARM/COLD change. */
    public function changeTemperature(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.edit');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $raw);

        $temperature = $this->validTemperature($request->input('temperature'));
        SalesLead::update($id, ['temperature' => $temperature]);

        if ($temperature !== $raw['temperature']) {
            SalesActivity::log(
                $id, 'temperature_changed',
                'Temperature changed to ' . strtoupper($temperature),
                $request->user,
                'From ' . strtoupper((string)$raw['temperature'])
            );
        }

        Response::success(SalesLead::find($id), 'Temperature updated');
    }

    /** PUT /admin/sales/leads/{id}/assign — admin-only reassignment. */
    public function assign(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.assign');

        $id = (int)$request->param('id');
        if (!SalesLead::findRaw($id)) {
            Response::error('Lead not found', 404);
        }

        $assignedTo = !empty($request->input('assigned_to')) ? (int)$request->input('assigned_to') : null;
        $this->assertSalesUser($assignedTo);

        SalesLead::update($id, ['assigned_to' => $assignedTo]);

        $name = 'Unassigned';
        if ($assignedTo) {
            $row  = Database::fetch('SELECT name FROM users WHERE user_id = ? LIMIT 1', [$assignedTo]);
            $name = (string)($row['name'] ?? ('User #' . $assignedTo));
        }
        SalesActivity::log($id, 'lead_assigned', 'Lead assigned to ' . $name, $request->user);

        Response::success(SalesLead::find($id), 'Lead assigned');
    }

    /**
     * POST /admin/sales/leads/{id}/convert
     *
     * Onboarding → customer. Creates the customer record inside the EXISTING
     * project/DRP system (`ops_clients`) and stores the reference on the lead.
     * The sales history is preserved — nothing is deleted, and the lead stays
     * queryable with status = 'converted'.
     */
    public function convert(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.convert');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        if (!empty($raw['converted_client_id'])) {
            Response::error('Lead is already converted', 409);
        }

        $tenantId = Database::tenantId();

        // Reuse an existing ops client when one already matches on phone/email,
        // rather than creating a duplicate customer in the project system.
        $existing = null;
        if (!empty($raw['phone'])) {
            $existing = Database::fetch(
                'SELECT id FROM ops_clients WHERE tenant_id = ? AND phone = ? LIMIT 1',
                [$tenantId, $raw['phone']]
            );
        }
        if (!$existing && !empty($raw['email'])) {
            $existing = Database::fetch(
                'SELECT id FROM ops_clients WHERE tenant_id = ? AND email = ? LIMIT 1',
                [$tenantId, $raw['email']]
            );
        }

        if ($existing) {
            $clientId = (int)$existing['id'];
        } else {
            $clientId = Database::insert('ops_clients', [
                'tenant_id' => $tenantId,
                'name'      => $raw['company'] !== '' ? $raw['company'] : $raw['name'],
                'phone'     => (string)$raw['phone'],
                'email'     => (string)$raw['email'],
                'source'    => $raw['source'] !== '' ? $raw['source'] : 'sales_lead',
                'owner'     => (string)($request->user['name'] ?? ''),
                'health'    => 'green',
                'stage'     => 'Onboarding',
                'notes'     => trim("Converted from sales lead {$raw['lead_code']}.\n" . (string)$raw['notes']),
            ]);
        }

        SalesLead::markConverted($id, $clientId, null);

        SalesActivity::log(
            $id, 'lead_converted',
            'Converted to customer',
            $request->user,
            'Customer record #' . $clientId . ' in the project/DRP system',
            'ops_client',
            $clientId
        );

        // Mirror onto the ops activity log so the project system's own timeline
        // shows where this client came from.
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'client',
            'entity_id'   => $clientId,
            'action'      => 'created_from_sales_lead',
            'description' => 'Converted from sales lead ' . $raw['lead_code'] . ' (' . $raw['name'] . ')',
            'done_by'     => (string)($request->user['name'] ?? ''),
        ]);

        Response::success([
            'lead_id'   => $id,
            'client_id' => $clientId,
            'reused_existing_client' => $existing !== null,
        ], 'Lead converted to customer', 201);
    }

    /** POST /admin/sales/leads/{id}/onboarding — move into the onboarding stage. */
    public function startOnboarding(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.convert');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        if ($raw['status'] === 'converted') {
            Response::error('Lead is already converted', 409);
        }

        SalesLead::update($id, ['status' => 'onboarding']);
        SalesActivity::log($id, 'lead_onboarding', 'Moved to onboarding', $request->user, (string)$request->input('notes', ''));

        Response::success(SalesLead::find($id), 'Lead moved to onboarding');
    }

    public function destroy(Request $request): void
    {
        // Deleting sales history is an administrative action, not a sales one.
        SalesPermissions::enforce($request->user, 'sales.leads.assign');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        if (!empty($raw['converted_client_id'])) {
            Response::error('A converted lead cannot be deleted — its sales history is referenced by the customer record', 409);
        }

        SalesLead::delete($id);
        Response::success(null, 'Lead deleted');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function validTemperature(mixed $value): string
    {
        $value = strtolower(trim((string)$value));
        if (!in_array($value, SalesLead::TEMPERATURES, true)) {
            Response::error('Invalid temperature. Allowed: ' . implode(', ', SalesLead::TEMPERATURES), 422);
        }
        return $value;
    }

    private function validStatus(mixed $value): string
    {
        $value = strtolower(trim((string)$value));
        if (!in_array($value, SalesLead::STATUSES, true)) {
            Response::error('Invalid status. Allowed: ' . implode(', ', SalesLead::STATUSES), 422);
        }
        return $value;
    }

    /** Assignment target must be a real, active admin user in this tenant. */
    private function assertSalesUser(?int $userId): void
    {
        if ($userId === null) {
            return;
        }
        $row = Database::fetch(
            "SELECT user_id FROM users WHERE user_id = ? AND tenant_id = ? AND user_type = 'admin' AND is_active = 1 LIMIT 1",
            [$userId, Database::tenantId()]
        );
        if (!$row) {
            Response::error('Assigned user not found in this workspace', 422);
        }
    }
}
