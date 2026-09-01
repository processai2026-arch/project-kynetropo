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
        // One grouped query instead of one per call/follow-up/meeting row.
        $lead['comment_counts'] = SalesComment::countsForLead($id);
        $lead['comments']       = SalesComment::forEntity('lead', $id);

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
            $status = $this->validStatus($request->input('status'));
            // Onboarding and conversion are not just a column value: they create
            // the customer record, stamp converted_at and link the two systems
            // together. Setting the word here would leave a lead that claims to
            // be converted with nothing behind it, and "Undo Convert" would then
            // have nothing to undo.
            if (in_array($status, ['onboarding', 'converted'], true) && $status !== $raw['status']) {
                Response::error(
                    'Use Start Onboarding or Convert to move a lead there — setting the status alone '
                    . 'would not create the customer record.',
                    422
                );
            }
            $data['status'] = $status;
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
            // "Lead details updated" on its own tells the next person nothing —
            // not which field moved, not what it used to say. The diff is the
            // part of the entry worth reading.
            $changes = $this->describeChanges($raw, $data);
            SalesActivity::log(
                $id,
                'lead_updated',
                'Lead updated by ' . (string)($request->user['name'] ?? 'someone'),
                $request->user,
                implode('; ', $changes)
            );
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

        // The caller may correct or complete the customer details on the way in
        // — a lead is captured in a hurry, a customer record is kept for years.
        // Anything not supplied falls back to what the lead already knows.
        $name = trim((string)$request->input('name', ''));
        if ($name === '') {
            $name = $raw['company'] !== '' ? (string)$raw['company'] : (string)$raw['name'];
        }
        if (mb_strlen($name) < 2) {
            Response::error('A customer name is required', 422);
        }

        $health = (string)$request->input('health', 'green');
        if (!in_array($health, ['green', 'yellow', 'red'], true)) {
            Response::error('Health must be green, yellow or red', 422);
        }

        $details = [
            'name'   => mb_substr($name, 0, 200),
            'phone'  => mb_substr(trim((string)$request->input('phone',  $raw['phone']  ?? '')), 0, 30),
            'email'  => mb_substr(trim((string)$request->input('email',  $raw['email']  ?? '')), 0, 200),
            'source' => mb_substr(trim((string)$request->input('source', $raw['source'] ?: 'sales_lead')), 0, 200),
            'owner'  => mb_substr(trim((string)$request->input('owner', (string)($request->user['name'] ?? ''))), 0, 100),
            'health' => $health,
            'stage'  => mb_substr(trim((string)$request->input('stage', 'Onboarding')), 0, 80),
            'notes'  => trim((string)$request->input('notes', "Converted from sales lead {$raw['lead_code']}.\n" . (string)$raw['notes'])),
        ];

        // Reuse an existing ops client when one already matches on phone/email,
        // rather than creating a duplicate customer in the project system. The
        // caller can point at a specific one instead, or insist on a new record.
        $existing = null;
        $linkTo   = (int)$request->input('link_client_id', 0);
        $forceNew = (bool)$request->input('create_new', false);

        if ($linkTo > 0) {
            $existing = Database::fetch(
                'SELECT id FROM ops_clients WHERE tenant_id = ? AND id = ? LIMIT 1',
                [$tenantId, $linkTo]
            );
            if (!$existing) {
                Response::error('That customer no longer exists', 404);
            }
        } elseif (!$forceNew) {
            if ($details['phone'] !== '') {
                $existing = Database::fetch(
                    'SELECT id FROM ops_clients WHERE tenant_id = ? AND phone = ? LIMIT 1',
                    [$tenantId, $details['phone']]
                );
            }
            if (!$existing && $details['email'] !== '') {
                $existing = Database::fetch(
                    'SELECT id FROM ops_clients WHERE tenant_id = ? AND email = ? LIMIT 1',
                    [$tenantId, $details['email']]
                );
            }
        }

        if ($existing) {
            $clientId = (int)$existing['id'];
        } else {
            $clientId = Database::insert('ops_clients', ['tenant_id' => $tenantId] + $details);
        }

        // Optionally open the first project for this customer in the same step.
        // That mapping is the whole relationship between the two records.
        $projectId   = null;
        $projectName = trim((string)$request->input('project_name', ''));
        if ($projectName !== '') {
            $priority = (string)$request->input('project_priority', 'medium');
            if (!in_array($priority, ['low', 'medium', 'high', 'critical'], true)) {
                $priority = 'medium';
            }
            $deadline  = (string)$request->input('project_deadline', '');
            $projectId = Database::insert('ops_projects', [
                'tenant_id' => $tenantId,
                'client_id' => $clientId,
                'name'      => mb_substr($projectName, 0, 200),
                'stage'     => 'Onboarding',
                'owner'     => $details['owner'],
                'deadline'  => $deadline !== '' ? $deadline : null,
                'health'    => 'green',
                'priority'  => $priority,
                'quoted'    => (float)$request->input('project_quoted', 0),
            ]);
        }

        SalesLead::markConverted($id, $clientId, $projectId, $existing === null);

        SalesActivity::log(
            $id, 'lead_converted',
            'Converted to customer',
            $request->user,
            'Customer record #' . $clientId . ' in the project/DRP system',
            'ops_client',
            $clientId
        );

        // Mirror onto the ops activity log so the project system's own timeline
        // shows where this client came from. Creating and linking are logged
        // differently: this entry used to say "created" even when the lead was
        // pointed at a customer that had been there for months.
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'client',
            'entity_id'   => $clientId,
            'action'      => $existing === null ? 'created_from_sales_lead' : 'linked_to_sales_lead',
            'description' => ($existing === null ? 'Converted from sales lead ' : 'Linked to sales lead ')
                             . $raw['lead_code'] . ' (' . $raw['name'] . ')',
            'done_by'     => (string)($request->user['name'] ?? ''),
        ]);

        Response::success([
            'lead_id'    => $id,
            'client_id'  => $clientId,
            'project_id' => $projectId,
            'reused_existing_client' => $existing !== null,
        ], $existing !== null
            ? 'Lead linked to the existing customer'
            : 'Lead converted to customer', 201);
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

    /**
     * POST /admin/sales/leads/{id}/revert
     *
     * Steps a lead back out of onboarding or conversion — both are reachable by
     * a mis-tap, and neither should be a one-way door.
     *
     *   converted  -> onboarding   (the conversion link is cleared)
     *   onboarding -> qualified
     *
     * Reverting a conversion also REMOVES the customer record the conversion
     * created — an undo that leaves a phantom customer behind in the CRM is not
     * an undo, and the next person has no way to tell it apart from a real one.
     *
     * It is removed only when it is genuinely this conversion's to remove:
     * created by this conversion (not an existing customer it was linked to),
     * claimed by no other lead, and with nothing attached since except the
     * project the same conversion opened. Anything else is somebody's real
     * work, so the record is kept and the response says exactly why.
     *
     * The sales timeline is never erased — the reversal is appended to it.
     */
    public function revertStatus(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.leads.convert');

        $id  = (int)$request->param('id');
        $raw = SalesLead::findRaw($id);
        if (!$raw) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $raw);

        $reason = trim((string)$request->input('reason', ''));

        if ($raw['status'] === 'converted' || !empty($raw['converted_client_id'])) {
            $tenantId  = Database::tenantId();
            $clientId  = (int)$raw['converted_client_id'];
            $projectId = (int)($raw['converted_project_id'] ?? 0);

            // Decide BEFORE the lead is unlinked: the check asks whether any
            // other lead claims this customer, and this lead still counts as one
            // until the UPDATE below runs.
            [$removable, $keepReason] = $this->conversionIsRemovable($raw, $clientId, $projectId);

            Database::execute(
                "UPDATE sales_leads
                    SET status = 'onboarding', converted_client_id = NULL,
                        converted_project_id = NULL, converted_at = NULL
                  WHERE id = ? AND tenant_id = ?",
                [$id, $tenantId]
            );

            $removedClient  = null;
            $removedProject = null;

            if ($clientId && $removable) {
                if ($projectId) {
                    Database::execute(
                        'DELETE FROM ops_projects WHERE id = ? AND tenant_id = ?',
                        [$projectId, $tenantId]
                    );
                    $removedProject = $projectId;
                }
                Database::execute(
                    'DELETE FROM ops_clients WHERE id = ? AND tenant_id = ?',
                    [$clientId, $tenantId]
                );
                $removedClient = $clientId;

                // The ops timeline keeps the entry even though the row is gone:
                // "this customer existed and was removed" is the thing somebody
                // looking for it later needs to find.
                Database::insert('ops_activity_log', [
                    'tenant_id'   => $tenantId,
                    'entity_type' => 'client',
                    'entity_id'   => $clientId,
                    'action'      => 'sales_conversion_reverted',
                    'description' => 'Sales lead ' . $raw['lead_code'] . ' undid its conversion; this customer record'
                                     . ($removedProject ? ' and its project' : '') . ' was removed.',
                    'done_by'     => (string)($request->user['name'] ?? ''),
                ]);
            } elseif ($clientId) {
                Database::insert('ops_activity_log', [
                    'tenant_id'   => $tenantId,
                    'entity_type' => 'client',
                    'entity_id'   => $clientId,
                    'action'      => 'sales_lead_unlinked',
                    'description' => 'Sales lead ' . $raw['lead_code'] . ' undid its conversion; this customer record was kept ('
                                     . $keepReason . ').',
                    'done_by'     => (string)($request->user['name'] ?? ''),
                ]);
            }

            SalesActivity::log(
                $id, 'lead_updated', 'Conversion reverted',
                $request->user,
                trim(($removedClient
                        ? 'Customer record #' . $clientId . ' was removed from the project system'
                          . ($removedProject ? ' along with its project' : '') . '.'
                        : 'Unlinked from customer record #' . $clientId . ', which was kept (' . $keepReason . ').')
                     . ' ' . $reason),
                'ops_client', $clientId ?: null
            );

            Response::success([
                'lead'               => SalesLead::find($id),
                'removed_client_id'  => $removedClient,
                'removed_project_id' => $removedProject,
                // Only set when the record could NOT be removed — the client
                // reads this to explain why something is still in the CRM.
                'kept_customer_id'   => $removedClient === null ? ($clientId ?: null) : null,
                'kept_reason'        => $removedClient === null && $clientId ? $keepReason : null,
            ], $removedClient
                ? 'Conversion undone — the customer record was removed from the project system'
                : 'Conversion undone — the customer record was kept (' . $keepReason . ')');
        }

        if ($raw['status'] === 'onboarding') {
            SalesLead::update($id, ['status' => 'qualified']);
            SalesActivity::log($id, 'lead_updated', 'Moved back out of onboarding', $request->user, $reason);
            Response::success(['lead' => SalesLead::find($id)], 'Lead moved back to qualified');
        }

        Response::error('This lead is not in onboarding or converted, so there is nothing to revert', 409);
    }

    /**
     * May this conversion's customer record be removed along with it?
     *
     * Only when it is this conversion's to remove. Three separate ways it stops
     * being that, each of which means someone else's work would be destroyed:
     *
     *   - the conversion LINKED to a customer that already existed;
     *   - another lead has since converted onto the same customer;
     *   - anything has been attached to it that this conversion did not create
     *     — a second project, a meeting, a payment, an AMC, a document.
     *
     * Every count is wrapped: an ops table missing on an older install must not
     * turn an undo into a 500, and "I could not check" is treated as "do not
     * remove", which is the safe direction to be wrong in.
     *
     * @return array{0:bool,1:string} [removable, why not]
     */
    private function conversionIsRemovable(array $lead, int $clientId, int $projectId): array
    {
        if ($clientId < 1) {
            return [false, 'there was no customer record'];
        }
        $leadId   = (int)$lead['id'];
        $tenantId = Database::tenantId();

        $count = static function (string $sql, array $params): ?int {
            try {
                return Database::count($sql, $params);
            } catch (Throwable $e) {
                error_log('[SalesLead] revert safety check failed: ' . $e->getMessage());
                return null;
            }
        };

        // Created here, or linked to a customer that was already there? Recorded
        // on the lead at conversion time, because it is the one fact the undo
        // cannot afford to guess: get it wrong and it deletes somebody else's
        // customer. Conversions from before this column existed read 0, so they
        // keep the record — the safe direction to be wrong in.
        if ((int)($lead['converted_client_created'] ?? 0) !== 1) {
            return [false, 'it already existed before this lead was converted'];
        }

        $otherLeads = $count(
            'SELECT COUNT(*) AS cnt FROM sales_leads
              WHERE tenant_id = ? AND converted_client_id = ? AND id <> ?',
            [$tenantId, $clientId, $leadId]
        );
        if ($otherLeads === null) {
            return [false, 'its other leads could not be checked'];
        }
        if ($otherLeads > 0) {
            return [false, 'another lead is also converted onto it'];
        }

        // Projects: the one this conversion opened does not count against it.
        $projects = $projectId > 0
            ? $count('SELECT COUNT(*) AS cnt FROM ops_projects WHERE tenant_id = ? AND client_id = ? AND id <> ?',
                     [$tenantId, $clientId, $projectId])
            : $count('SELECT COUNT(*) AS cnt FROM ops_projects WHERE tenant_id = ? AND client_id = ?',
                     [$tenantId, $clientId]);
        if ($projects === null) {
            return [false, 'its projects could not be checked'];
        }
        if ($projects > 0) {
            return [false, 'it has projects of its own now'];
        }

        // Everything else that can hang off a customer. A missing table answers
        // null and is skipped — it cannot hold rows it has nowhere to store.
        $attached = [
            'ops_meetings'           => 'meetings',
            'ops_payments'           => 'payments',
            'ops_amc_records'        => 'an AMC',
            'ops_document_checklist' => 'documents',
        ];
        foreach ($attached as $table => $label) {
            $rows = $count("SELECT COUNT(*) AS cnt FROM `$table` WHERE tenant_id = ? AND client_id = ?",
                           [$tenantId, $clientId]);
            if ($rows !== null && $rows > 0) {
                return [false, 'it has ' . $label . ' attached'];
            }
        }

        return [true, ''];
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

    /**
     * Field-by-field diff for the lead timeline.
     *
     * Phone and email are shown in full because a wrong one is the single most
     * expensive mistake on a lead — someone reviewing the timeline has to be
     * able to see what it was changed FROM. Notes are reported as changed
     * without quoting either version: they run to paragraphs, and pasting both
     * into a timeline entry buries everything around it.
     */
    private function describeChanges(array $before, array $after): array
    {
        $labels = [
            'name'           => 'Name',
            'company'        => 'Company',
            'contact_person' => 'Contact person',
            'phone'          => 'Phone',
            'email'          => 'Email',
            'source'         => 'Source',
            'status'         => 'Status',
            'temperature'    => 'Temperature',
        ];

        $changes = [];
        foreach ($labels as $col => $label) {
            if (!array_key_exists($col, $after)) {
                continue;
            }
            $from = trim((string)($before[$col] ?? ''));
            $to   = trim((string)$after[$col]);
            if ($from === $to) {
                continue;
            }
            $changes[] = $from === ''
                ? $label . ' set to ' . ($to !== '' ? $to : '(empty)')
                : $label . ': ' . $from . ' -> ' . ($to !== '' ? $to : '(cleared)');
        }

        if (array_key_exists('notes', $after)
            && trim((string)($before['notes'] ?? '')) !== trim((string)$after['notes'])) {
            $changes[] = 'Notes edited';
        }

        if (array_key_exists('assigned_to', $after)
            && (int)($before['assigned_to'] ?? 0) !== (int)($after['assigned_to'] ?? 0)) {
            $name = $after['assigned_to']
                ? (Database::fetch(
                    'SELECT name FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1',
                    [(int)$after['assigned_to'], Database::tenantId()]
                  )['name'] ?? 'someone')
                : null;
            $changes[] = $name ? 'Assigned to ' . $name : 'Unassigned';
        }

        return $changes;
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
