<?php
declare(strict_types=1);

/**
 * Sales Meetings Controller — physical/virtual meetings scheduled from a lead.
 *
 *   GET    /admin/sales/meetings               — list/filter
 *   POST   /admin/sales/meetings               — schedule
 *   GET    /admin/sales/meetings/{id}          — detail
 *   PUT    /admin/sales/meetings/{id}          — edit a scheduled meeting
 *   POST   /admin/sales/meetings/{id}/complete — record the outcome
 *   POST   /admin/sales/meetings/{id}/cancel   — cancel
 */
class AdminSalesMeetingController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.meetings.view');

        $scope  = SalesPermissions::leadScope($request->user);
        $result = SalesMeeting::all([
            'status'       => $request->query('status'),
            'meeting_type' => $request->query('meeting_type'),
            'lead_id'      => $request->query('lead_id'),
            'date_from'    => $request->query('date_from'),
            'date_to'      => $request->query('date_to'),
        ], $scope, (int)$request->query('page', 1), (int)$request->query('limit', 200));

        Response::success([
            'items'      => $result['rows'],
            'pagination' => $result['pagination'],
            'counts'     => SalesMeeting::counts($scope),
        ]);
    }

    public function show(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.meetings.view');

        $id  = (int)$request->param('id');
        $row = SalesMeeting::findRaw($id);
        if (!$row) {
            Response::error('Meeting not found', 404);
        }
        $this->assertAccess($request, $row);

        Response::success(SalesMeeting::format($row));
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.meetings.create');

        $leadId = (int)$request->input('lead_id');
        $lead   = SalesLead::findRaw($leadId);
        if (!$lead) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $lead);

        $payload = $this->validatePayload($request, true);

        $id = SalesMeeting::create([
            'lead_id'      => $leadId,
            'title'        => $payload['title'],
            'meeting_type' => $payload['meeting_type'],
            'meeting_date' => $payload['meeting_date'],
            'meeting_time' => $payload['meeting_time'],
            'place'        => $payload['place'],
            'meeting_link' => $payload['meeting_link'],
            'participants' => $request->input('participants'),
            'notes'        => $request->input('notes'),
            'assigned_to'  => $lead['assigned_to'] ?? ($request->user['user_id'] ?? null),
        ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

        SalesActivity::log(
            $leadId, 'meeting_scheduled',
            'Meeting scheduled — ' . $payload['title'],
            $request->user,
            strtoupper($payload['meeting_type']) . ' on ' . $payload['meeting_date']
                . ($payload['meeting_time'] ? ' ' . $payload['meeting_time'] : ''),
            'meeting',
            $id
        );

        if (in_array($lead['status'], ['new', 'contacted'], true)) {
            SalesLead::update($leadId, ['status' => 'meeting_scheduled']);
        }
        SalesLead::refreshSchedule($leadId);

        Response::success(SalesMeeting::format(SalesMeeting::findRaw($id) ?? []), 'Meeting scheduled', 201);
    }

    public function update(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.meetings.edit');

        $id  = (int)$request->param('id');
        $row = SalesMeeting::findRaw($id);
        if (!$row) {
            Response::error('Meeting not found', 404);
        }
        $this->assertAccess($request, $row);

        if ($row['status'] !== 'scheduled') {
            Response::error('Only a scheduled meeting can be edited', 409);
        }

        $payload = $this->validatePayload($request, false, $row);
        SalesMeeting::update($id, $payload);

        SalesActivity::log((int)$row['lead_id'], 'meeting_updated', 'Meeting updated', $request->user, '', 'meeting', $id);
        SalesLead::refreshSchedule((int)$row['lead_id']);

        Response::success(SalesMeeting::format(SalesMeeting::findRaw($id) ?? []), 'Meeting updated');
    }

    public function complete(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.meetings.edit');

        $id  = (int)$request->param('id');
        $row = SalesMeeting::findRaw($id);
        if (!$row) {
            Response::error('Meeting not found', 404);
        }
        $this->assertAccess($request, $row);

        if ($row['status'] !== 'scheduled') {
            Response::error('This meeting is already ' . $row['status'], 409);
        }

        $outcome = strtolower(trim((string)$request->input('outcome', '')));
        if (!in_array($outcome, SalesMeeting::OUTCOMES, true)) {
            Response::error('Invalid meeting outcome. Allowed: ' . implode(', ', SalesMeeting::OUTCOMES), 422);
        }

        $nextMeetingDate = $request->input('next_meeting_date');
        if (!empty($nextMeetingDate) && !$this->isValidDate((string)$nextMeetingDate)) {
            Response::error('Invalid next meeting date', 422);
        }

        $leadId = (int)$row['lead_id'];

        SalesMeeting::complete($id, [
            'outcome'           => $outcome,
            'outcome_notes'     => $request->input('outcome_notes'),
            'requirements'      => $request->input('requirements'),
            'decisions'         => $request->input('decisions'),
            'next_action'       => $request->input('next_action'),
            'next_meeting_date' => $nextMeetingDate ?: null,
        ]);

        SalesActivity::log(
            $leadId, 'meeting_completed',
            'Meeting completed — ' . str_replace('_', ' ', $outcome),
            $request->user,
            (string)$request->input('outcome_notes', ''),
            'meeting',
            $id,
            ['outcome' => $outcome]
        );

        // A follow-up meeting requested during the wrap-up.
        $nextMeetingId = null;
        if (!empty($nextMeetingDate)) {
            $nextMeetingId = SalesMeeting::create([
                'lead_id'      => $leadId,
                'title'        => 'Follow-up meeting — ' . $row['title'],
                'meeting_type' => $row['meeting_type'],
                'meeting_date' => $nextMeetingDate,
                'meeting_time' => $row['meeting_time'],
                'place'        => $row['place'],
                'meeting_link' => $row['meeting_link'],
                'participants' => $row['participants'],
                'notes'        => (string)$request->input('next_action', ''),
                'assigned_to'  => $row['assigned_to'],
            ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

            SalesActivity::log(
                $leadId, 'meeting_scheduled',
                'Next meeting scheduled for ' . $nextMeetingDate,
                $request->user, '', 'meeting', $nextMeetingId
            );
        }

        // A follow-up task requested during the wrap-up.
        $followupId = null;
        $followupDate = $request->input('next_followup_date');
        if (!empty($followupDate)) {
            if (!$this->isValidDate((string)$followupDate)) {
                Response::error('Invalid next follow-up date', 422);
            }
            $followupId = SalesFollowup::create([
                'lead_id'     => $leadId,
                'meeting_id'  => $id,
                'due_date'    => $followupDate,
                'assigned_to' => $row['assigned_to'],
                'purpose'     => (string)$request->input('next_action', 'Meeting follow-up'),
            ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

            SalesActivity::log(
                $leadId, 'followup_created',
                'Follow-up scheduled for ' . $followupDate,
                $request->user, '', 'followup', $followupId
            );
        }

        SalesLead::touchActivity($leadId, 'meeting_' . $outcome);
        SalesLead::refreshSchedule($leadId);

        Response::success([
            'next_meeting_id'  => $nextMeetingId,
            'next_followup_id' => $followupId,
        ], 'Meeting outcome recorded');
    }

    public function cancel(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.meetings.edit');

        $id  = (int)$request->param('id');
        $row = SalesMeeting::findRaw($id);
        if (!$row) {
            Response::error('Meeting not found', 404);
        }
        $this->assertAccess($request, $row);

        SalesMeeting::cancel($id);
        SalesLead::refreshSchedule((int)$row['lead_id']);

        Response::success(null, 'Meeting cancelled');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Validates the schedule payload. A physical meeting needs a place; a
     * virtual one needs a link — mirroring what the form shows per type.
     */
    private function validatePayload(Request $request, bool $required, array $existing = []): array
    {
        $title = trim((string)$request->input('title', $existing['title'] ?? ''));
        if ($required && mb_strlen($title) < 2) {
            Response::error('Meeting title is required', 422);
        }

        $type = strtolower(trim((string)$request->input('meeting_type', $existing['meeting_type'] ?? 'virtual')));
        if (!in_array($type, SalesMeeting::TYPES, true)) {
            Response::error('Invalid meeting type. Allowed: ' . implode(', ', SalesMeeting::TYPES), 422);
        }

        $date = (string)$request->input('meeting_date', $existing['meeting_date'] ?? '');
        if (!$this->isValidDate($date)) {
            Response::error('A valid meeting date is required', 422);
        }

        $time = $request->input('meeting_time', $existing['meeting_time'] ?? null);
        if (!empty($time) && !$this->isValidTime((string)$time)) {
            Response::error('Invalid meeting time', 422);
        }

        $place = trim((string)$request->input('place', $existing['place'] ?? ''));
        $link  = trim((string)$request->input('meeting_link', $existing['meeting_link'] ?? ''));

        if ($type === 'physical' && $place === '') {
            Response::error('A meeting place is required for a physical meeting', 422);
        }
        if ($type === 'virtual' && $link === '') {
            Response::error('A meeting link is required for a virtual meeting', 422);
        }

        $data = [
            'title'        => $title,
            'meeting_type' => $type,
            'meeting_date' => $date,
            'meeting_time' => $time ?: null,
            'place'        => $type === 'physical' ? $place : '',
            'meeting_link' => $type === 'virtual'  ? $link  : '',
        ];

        if (!$required) {
            foreach (['participants', 'notes'] as $col) {
                if ($request->input($col) !== null) {
                    $data[$col] = $request->input($col);
                }
            }
        }

        return $data;
    }

    private function assertAccess(Request $request, array $meeting): void
    {
        if (SalesPermissions::canSeeAllLeads($request->user)) {
            return;
        }
        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ((int)($meeting['assigned_to'] ?? 0) === $userId) {
            return;
        }
        $lead = SalesLead::findRaw((int)$meeting['lead_id']);
        if (!$lead || (int)($lead['assigned_to'] ?? 0) !== $userId) {
            Response::error('Meeting not found', 404);
        }
    }

    private function isValidDate(string $value): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $value);
        return $d !== false && $d->format('Y-m-d') === $value;
    }

    private function isValidTime(string $value): bool
    {
        return (bool)preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $value);
    }
}
