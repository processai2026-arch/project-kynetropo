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

        // Your diary: meetings on your leads, assigned to you, or that you
        // have been named on. A shared list of everybody's meetings is not a
        // diary, and "Meetings Today" counted from it means nothing.
        $scope  = SalesPermissions::ownScope($request->user);
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

        Response::success($this->formatted($id));
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

        SalesMeeting::setParticipants($id, $this->validParticipants($request->input('participant_ids')));

        Response::success($this->formatted($id), 'Meeting scheduled', 201);
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

        // Only when the caller said something about it: an edit that leaves the
        // field out should not quietly empty the guest list.
        if ($request->input('participant_ids') !== null) {
            SalesMeeting::setParticipants($id, $this->validParticipants($request->input('participant_ids')));
        }

        Response::success($this->formatted($id), 'Meeting updated');
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

        // Everything is checked before anything is written. Validating the
        // follow-up date further down used to mark the meeting completed and
        // then reject the request: the caller saw an error, fixed the date,
        // pressed save again and got "this meeting is already completed" --
        // with the follow-up they had asked for never created.
        $outcome = strtolower(trim((string)$request->input('outcome', '')));
        if (!in_array($outcome, SalesMeeting::OUTCOMES, true)) {
            Response::error('Invalid meeting outcome. Allowed: ' . implode(', ', SalesMeeting::OUTCOMES), 422);
        }

        $nextMeetingDate = $request->input('next_meeting_date');
        if (!empty($nextMeetingDate) && !$this->isValidDate((string)$nextMeetingDate)) {
            Response::error('Invalid next meeting date', 422);
        }
        $nextMeetingTime = $request->input('next_meeting_time');
        if (!empty($nextMeetingTime) && !$this->isValidTime((string)$nextMeetingTime)) {
            Response::error('Invalid next meeting time', 422);
        }

        $followupDate = $request->input('next_followup_date');
        if (!empty($followupDate) && !$this->isValidDate((string)$followupDate)) {
            Response::error('Invalid next follow-up date', 422);
        }
        $followupTime = $request->input('next_followup_time');
        if (!empty($followupTime) && !$this->isValidTime((string)$followupTime)) {
            Response::error('Invalid next follow-up time', 422);
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
                'meeting_time' => $nextMeetingTime ?: $row['meeting_time'],
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
        if (!empty($followupDate)) {
            $purpose = trim((string)$request->input('next_action', ''));
            $followupId = SalesFollowup::create([
                'lead_id'     => $leadId,
                'meeting_id'  => $id,
                'due_date'    => $followupDate,
                'due_time'    => $followupTime ?: null,
                'assigned_to' => $row['assigned_to'],
                'purpose'     => $purpose !== '' ? $purpose : 'Meeting follow-up',
            ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

            SalesActivity::log(
                $leadId, 'followup_created',
                'Follow-up scheduled for ' . $followupDate,
                $request->user, '', 'followup', $followupId
            );
        }

        SalesLead::touchActivity($leadId, 'meeting_' . $outcome);
        SalesLead::refreshSchedule($leadId);
        $this->syncMeetingStatus($leadId);

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

        // Cancelling a meeting that is not scheduled used to answer "Meeting
        // cancelled" while changing nothing, because the UPDATE carries its own
        // status guard. Say so instead.
        if ($row['status'] !== 'scheduled') {
            Response::error('This meeting is already ' . $row['status'], 409);
        }

        $reason = trim((string)$request->input('reason', ''));

        SalesMeeting::cancel($id);

        // Every other thing that happens to a meeting reaches the lead's
        // timeline; a cancellation is the one people most want explained later.
        SalesActivity::log(
            (int)$row['lead_id'], 'meeting_cancelled',
            'Meeting cancelled - ' . $row['title'],
            $request->user, $reason, 'meeting', $id
        );

        SalesLead::refreshSchedule((int)$row['lead_id']);
        $this->syncMeetingStatus((int)$row['lead_id']);

        Response::success(null, 'Meeting cancelled');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** One meeting with its guest list, in the shape the client expects. */
    private function formatted(int $id): array
    {
        $row = SalesMeeting::findRaw($id);
        if (!$row) {
            return [];
        }
        return SalesMeeting::format($row, SalesMeeting::participantsFor([$id])[$id] ?? []);
    }

    /**
     * Turns the ids the client sent into real colleagues.
     *
     * Checked against the user table rather than trusted: being on a meeting
     * puts it in someone's diary, and an unchecked id is a way to put a meeting
     * in the diary of somebody who is not on this team.
     *
     * @return array<int, array{user_id:int,name:string}>
     */
    private function validParticipants(mixed $raw): array
    {
        if (!is_array($raw) || $raw === []) {
            return [];
        }
        $ids = [];
        foreach (array_slice($raw, 0, 30) as $value) {
            $id = is_array($value) ? (int)($value['user_id'] ?? 0) : (int)$value;
            if ($id > 0) {
                $ids[$id] = true;
            }
        }
        if (!$ids) {
            return [];
        }

        $in   = implode(',', array_fill(0, count($ids), '?'));
        $rows = Database::fetchAll(
            "SELECT user_id, name FROM users
              WHERE tenant_id = ? AND user_type = 'admin' AND is_active = 1 AND user_id IN ($in)",
            [Database::tenantId(), ...array_keys($ids)]
        );
        return array_map(
            static fn(array $r): array => ['user_id' => (int)$r['user_id'], 'name' => (string)$r['name']],
            $rows
        );
    }

    /**
     * Validates the schedule payload. A physical meeting needs a place; a
     * virtual one needs a link — mirroring what the form shows per type.
     */
    private function validatePayload(Request $request, bool $required, array $existing = []): array
    {
        // Checked whenever a title is actually supplied, not only on create:
        // sending an empty one to the edit endpoint used to blank the meeting's
        // title, leaving an untitled row in the list.
        $title = trim((string)$request->input('title', $existing['title'] ?? ''));
        if (($required || $request->input('title') !== null) && mb_strlen($title) < 2) {
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
        if ($type === 'virtual') {
            if ($link === '') {
                Response::error('A meeting link is required for a virtual meeting', 422);
            }
            $link = $this->normaliseLink($link);
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

    /**
     * A meeting link people can actually click.
     *
     * The list renders it as a hyperlink, so whatever is stored here is what
     * somebody taps on the way into a call. A scheme typo ("htttps://") or a
     * note to self ("ask Kaushik") used to be saved verbatim and presented as a
     * working link -- the failure only shows up at the moment the meeting starts.
     */
    private function normaliseLink(string $link): string
    {
        // A pasted "meet.google.com/abc-defg-hij" is a link, just an unqualified
        // one -- complete it rather than refusing it.
        if (!preg_match('#^[a-zA-Z][a-zA-Z0-9+.\\-]*://#', $link)) {
            $link = 'https://' . $link;
        }

        $scheme = strtolower((string)parse_url($link, PHP_URL_SCHEME));
        $host   = (string)parse_url($link, PHP_URL_HOST);

        if (!in_array($scheme, ['http', 'https'], true)
            || $host === ''
            || !str_contains($host, '.')
            || filter_var($link, FILTER_VALIDATE_URL) === false
        ) {
            Response::error(
                'That does not look like a meeting link. Paste the full address, '
                . 'for example https://meet.google.com/abc-defg-hij',
                422
            );
        }

        return $link;
    }

    /**
     * Keeps the lead's status honest about whether a meeting is still coming.
     *
     * A lead moved to "meeting scheduled" when the meeting was booked, and then
     * stayed there for good -- the meeting could be held, cancelled or missed and
     * the pipeline still claimed one was on the way. Once nothing is scheduled,
     * the lead is simply a qualified one awaiting its next step.
     */
    private function syncMeetingStatus(int $leadId): void
    {
        $lead = SalesLead::findRaw($leadId);
        if (!$lead || $lead['status'] !== 'meeting_scheduled') {
            return;
        }
        $stillScheduled = Database::fetch(
            "SELECT id FROM sales_meetings
              WHERE tenant_id = ? AND lead_id = ? AND status = 'scheduled' LIMIT 1",
            [Database::tenantId(), $leadId]
        );
        if (!$stillScheduled) {
            SalesLead::update($leadId, ['status' => 'qualified']);
        }
    }

    private function assertAccess(Request $request, array $meeting): void
    {
        // While looking at a colleague, their diary is the whole world -- the
        // list is already narrowed to them, and the detail has to agree or a
        // meeting that is invisible in the list still opens by id.
        $viewing = SalesViewAs::current();
        if ($viewing !== null) {
            $subject = (int)$viewing['user_id'];
            if ((int)($meeting['assigned_to'] ?? 0) === $subject) {
                return;
            }
            $lead = SalesLead::findRaw((int)$meeting['lead_id']);
            if (!$lead || (int)($lead['assigned_to'] ?? 0) !== $subject) {
                Response::error('Meeting not found', 404);
            }
            return;
        }

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
