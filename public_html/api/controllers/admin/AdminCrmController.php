<?php
declare(strict_types=1);

/**
 * Admin CRM Controller — leads, deals/pipeline, and activities (Zoho-CRM-lite scope).
 *
 * Leads
 *   GET    /admin/crm/leads                — list/filter
 *   GET    /admin/crm/leads/{id}           — single
 *   POST   /admin/crm/leads                — create
 *   PUT    /admin/crm/leads/{id}           — update
 *   DELETE /admin/crm/leads/{id}           — delete
 *   POST   /admin/crm/leads/{id}/convert   — convert lead -> customer (+ optional deal)
 *
 * Deals / Pipeline
 *   GET    /admin/crm/deals                — list/filter
 *   GET    /admin/crm/deals/pipeline       — board grouped by stage
 *   GET    /admin/crm/deals/{id}           — single
 *   POST   /admin/crm/deals                — create
 *   PUT    /admin/crm/deals/{id}           — update
 *   PUT    /admin/crm/deals/{id}/stage     — change stage only (kanban drag/select)
 *   DELETE /admin/crm/deals/{id}           — delete
 *
 * Activities
 *   GET    /admin/crm/activities                       — list/filter
 *   GET    /admin/crm/activities/timeline/{type}/{id}   — unified timeline for a record
 *   GET    /admin/crm/activities/{id}                   — single
 *   POST   /admin/crm/activities                        — create
 *   PUT    /admin/crm/activities/{id}                   — update
 *   DELETE /admin/crm/activities/{id}                   — delete
 */
class AdminCrmController
{
    private static function actorId(Request $request): ?int
    {
        return isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
    }

    // ════════════════════════════════════════════════════════════════════
    // LEADS
    // ════════════════════════════════════════════════════════════════════

    public function leadsIndex(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 500)));

        $result = Lead::all([
            'status'   => $request->query('status'),
            'owner_id' => $request->query('owner_id'),
            'source'   => $request->query('source'),
            'search'   => $request->query('search'),
        ], $page, $limit);

        Response::paginated($result['rows'], $result['pagination']);
    }

    public function leadsShow(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) Response::error('Invalid lead ID', 400);

        $lead = Lead::find($id);
        if (!$lead) Response::error('Lead not found', 404);

        $lead['activities'] = CrmActivity::timeline('lead', $id);
        Response::success($lead);
    }

    public function leadsStore(Request $request): void
    {
        Validator::make($request->only(['name', 'email', 'phone', 'status', 'source']), [
            'name'   => 'required|string|min:2|max:150',
            'email'  => 'email',
            'status' => 'in:' . implode(',', Lead::VALID_STATUSES),
        ])->validate();

        $id = Lead::create([
            'name'         => trim((string)$request->input('name')),
            'company_name' => $request->input('company_name'),
            'email'        => $request->input('email'),
            'phone'        => $request->input('phone'),
            'source'       => $request->input('source'),
            'status'       => $request->input('status', 'new'),
            'owner_id'     => $request->input('owner_id'),
            'notes'        => $request->input('notes'),
        ], self::actorId($request));

        Response::success(Lead::find($id), 'Lead created', 201);
    }

    public function leadsUpdate(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Lead::findRaw($id)) Response::error('Lead not found', 404);

        if ($request->input('status') !== null && !in_array($request->input('status'), Lead::VALID_STATUSES, true)) {
            Response::error('Invalid status. Allowed: ' . implode(', ', Lead::VALID_STATUSES), 422);
        }
        if ($request->input('email') !== null && $request->input('email') !== '' && !filter_var($request->input('email'), FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email', 422);
        }

        $data = $request->only(['name', 'company_name', 'email', 'phone', 'source', 'status', 'owner_id', 'notes']);
        Lead::update($id, $data);

        Response::success(Lead::find($id), 'Lead updated');
    }

    public function leadsDestroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Lead::findRaw($id)) Response::error('Lead not found', 404);

        Lead::delete($id);
        Response::success(null, 'Lead deleted');
    }

    /** POST /admin/crm/leads/{id}/convert — create a customer (+ optional deal) from a lead. */
    public function leadsConvert(Request $request): void
    {
        $id   = (int)$request->param('id');
        $lead = Lead::findRaw($id);
        if (!$lead) Response::error('Lead not found', 404);

        if ($lead['converted_customer_id']) {
            Response::error('Lead already converted', 409);
        }

        $createDeal  = $request->input('create_deal', true);
        $dealTitle   = trim((string)$request->input('deal_title', '')) ?: ($lead['company_name'] ?: $lead['name']);
        $dealValue   = $request->input('deal_value', 0);

        $phone = preg_replace('/\D/', '', (string)($lead['phone'] ?? ''));
        if ($phone === '') {
            Response::error('Lead must have a phone number to convert to a customer', 422);
        }
        $email = trim((string)($lead['email'] ?? ''));
        if ($email === '') {
            $email = $phone . '@noemail.kynetropo.local';
        }

        try {
            $customerId = User::create([
                'name'         => $lead['name'],
                'email'        => $email,
                'phone'        => $phone,
                'user_type'    => 'customer',
                'company_name' => $lead['company_name'],
                'password'     => bin2hex(random_bytes(12)), // lead has no portal login flow yet
            ]);
        } catch (AppException $e) {
            Response::error('Could not create customer: ' . $e->getMessage(), $e->getCode());
        }

        $dealId = null;
        if ($createDeal) {
            $dealId = Deal::create([
                'title'       => $dealTitle,
                'customer_id' => $customerId,
                'lead_id'     => $id,
                'value'       => $dealValue,
                'stage'       => 'qualification',
                'owner_id'    => $lead['owner_id'],
            ], self::actorId($request));
        }

        Lead::markConverted($id, $customerId, $dealId);

        Response::success([
            'lead_id'     => $id,
            'customer_id' => $customerId,
            'deal_id'     => $dealId,
        ], 'Lead converted', 201);
    }

    // ════════════════════════════════════════════════════════════════════
    // DEALS / PIPELINE
    // ════════════════════════════════════════════════════════════════════

    public function dealsIndex(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 500)));

        $result = Deal::all([
            'stage'       => $request->query('stage'),
            'owner_id'    => $request->query('owner_id'),
            'customer_id' => $request->query('customer_id'),
            'search'      => $request->query('search'),
        ], $page, $limit);

        Response::paginated($result['rows'], $result['pagination']);
    }

    /** GET /admin/crm/deals/pipeline — kanban board grouped by stage. */
    public function dealsPipeline(Request $request): void
    {
        $board = Deal::pipeline([
            'owner_id' => $request->query('owner_id'),
        ]);
        Response::success($board);
    }

    public function dealsShow(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) Response::error('Invalid deal ID', 400);

        $deal = Deal::find($id);
        if (!$deal) Response::error('Deal not found', 404);

        $deal['activities'] = CrmActivity::timeline('deal', $id);
        Response::success($deal);
    }

    public function dealsStore(Request $request): void
    {
        Validator::make($request->only(['title', 'value', 'stage', 'probability']), [
            'title'       => 'required|string|min:2|max:150',
            'value'       => 'numeric',
            'stage'       => 'in:' . implode(',', Deal::VALID_STAGES),
            'probability' => 'numeric',
        ])->validate();

        $id = Deal::create([
            'title'               => trim((string)$request->input('title')),
            'customer_id'         => $request->input('customer_id'),
            'lead_id'             => $request->input('lead_id'),
            'value'               => $request->input('value', 0),
            'currency'            => $request->input('currency', 'INR'),
            'stage'               => $request->input('stage', 'qualification'),
            'expected_close_date' => $request->input('expected_close_date'),
            'owner_id'            => $request->input('owner_id'),
            'probability'         => $request->input('probability'),
            'notes'               => $request->input('notes'),
        ], self::actorId($request));

        Response::success(Deal::find($id), 'Deal created', 201);
    }

    public function dealsUpdate(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Deal::findRaw($id)) Response::error('Deal not found', 404);

        if ($request->input('stage') !== null && !in_array($request->input('stage'), Deal::VALID_STAGES, true)) {
            Response::error('Invalid stage. Allowed: ' . implode(', ', Deal::VALID_STAGES), 422);
        }

        $data = $request->only([
            'title', 'customer_id', 'lead_id', 'value', 'currency', 'stage',
            'expected_close_date', 'owner_id', 'probability', 'notes',
        ]);
        Deal::update($id, $data);

        Response::success(Deal::find($id), 'Deal updated');
    }

    /** PUT /admin/crm/deals/{id}/stage — dedicated endpoint for kanban drag/select. */
    public function dealsChangeStage(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Deal::findRaw($id)) Response::error('Deal not found', 404);

        $stage = (string)$request->input('stage', '');
        if (!in_array($stage, Deal::VALID_STAGES, true)) {
            Response::error('Invalid stage. Allowed: ' . implode(', ', Deal::VALID_STAGES), 422);
        }

        Deal::changeStage($id, $stage);
        Response::success(Deal::find($id), 'Deal stage updated');
    }

    public function dealsDestroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Deal::findRaw($id)) Response::error('Deal not found', 404);

        Deal::delete($id);
        Response::success(null, 'Deal deleted');
    }

    // ════════════════════════════════════════════════════════════════════
    // ACTIVITIES
    // ════════════════════════════════════════════════════════════════════

    public function activitiesIndex(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 500)));

        $doneParam = $request->query('done');
        $done = $doneParam === null || $doneParam === '' ? '' : ($doneParam === 'true' || $doneParam === '1');

        $result = CrmActivity::all([
            'related_type' => $request->query('related_type'),
            'related_id'   => $request->query('related_id'),
            'type'         => $request->query('type'),
            'done'         => $done,
            'owner_id'     => $request->query('owner_id'),
        ], $page, $limit);

        Response::paginated($result['rows'], $result['pagination']);
    }

    /** GET /admin/crm/activities/timeline/{type}/{id} — unified timeline for a lead/deal/customer. */
    public function activitiesTimeline(Request $request): void
    {
        $type = (string)$request->param('type');
        $id   = (int)$request->param('id');

        if (!in_array($type, CrmActivity::VALID_RELATED_TYPES, true)) {
            Response::error('Invalid related type. Allowed: ' . implode(', ', CrmActivity::VALID_RELATED_TYPES), 422);
        }

        Response::success(CrmActivity::timeline($type, $id));
    }

    public function activitiesShow(Request $request): void
    {
        $id = (int)$request->param('id');
        $activity = CrmActivity::find($id);
        if (!$activity) Response::error('Activity not found', 404);

        Response::success($activity);
    }

    public function activitiesStore(Request $request): void
    {
        Validator::make($request->only(['subject', 'type', 'related_type', 'related_id']), [
            'subject'      => 'required|string|min:2|max:200',
            'type'         => 'in:' . implode(',', CrmActivity::VALID_TYPES),
            'related_type' => 'required|in:' . implode(',', CrmActivity::VALID_RELATED_TYPES),
            'related_id'   => 'required|integer',
        ])->validate();

        $id = CrmActivity::create([
            'type'         => $request->input('type', 'task'),
            'subject'      => trim((string)$request->input('subject')),
            'notes'        => $request->input('notes'),
            'related_type' => $request->input('related_type'),
            'related_id'   => (int)$request->input('related_id'),
            'due_at'       => $request->input('due_at'),
            'done'         => $request->input('done', false),
            'owner_id'     => $request->input('owner_id'),
        ], self::actorId($request));

        Response::success(CrmActivity::find($id), 'Activity created', 201);
    }

    public function activitiesUpdate(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!CrmActivity::find($id)) Response::error('Activity not found', 404);

        if ($request->input('type') !== null && !in_array($request->input('type'), CrmActivity::VALID_TYPES, true)) {
            Response::error('Invalid type. Allowed: ' . implode(', ', CrmActivity::VALID_TYPES), 422);
        }

        $data = $request->only(['type', 'subject', 'notes', 'due_at', 'owner_id', 'done']);
        CrmActivity::update($id, $data);

        Response::success(CrmActivity::find($id), 'Activity updated');
    }

    public function activitiesDestroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!CrmActivity::find($id)) Response::error('Activity not found', 404);

        CrmActivity::delete($id);
        Response::success(null, 'Activity deleted');
    }
}
