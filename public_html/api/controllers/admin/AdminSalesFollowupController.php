<?php
declare(strict_types=1);

/**
 * Sales Follow-Ups Controller — the action queue (Today / Overdue / Upcoming /
 * Completed). Buckets are computed from the server date, never the client's.
 *
 *   GET    /admin/sales/followups                — bucketed list
 *   POST   /admin/sales/followups                — create
 *   PUT    /admin/sales/followups/{id}           — reschedule / edit a pending follow-up
 *   POST   /admin/sales/followups/{id}/complete  — mark done (+ optional next one)
 *   POST   /admin/sales/followups/{id}/cancel    — cancel
 */
class AdminSalesFollowupController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.followups.view');

        $bucket = (string)$request->query('bucket', '');
        if ($bucket !== '' && !in_array($bucket, SalesFollowup::BUCKETS, true)) {
            Response::error('Invalid bucket. Allowed: ' . implode(', ', SalesFollowup::BUCKETS), 422);
        }

        // Your queue, not the team's. Seeing a colleague's is what the view-as
        // switcher is for; a mixed list is one nobody can work down.
        $scope  = SalesPermissions::ownScope($request->user);
        $result = SalesFollowup::all($bucket, [
            'lead_id'     => $request->query('lead_id'),
            'assigned_to' => $request->query('assigned_to'),
        ], $scope, (int)$request->query('page', 1), (int)$request->query('limit', 200));

        Response::success([
            'items'      => $result['rows'],
            'pagination' => $result['pagination'],
            'counts'     => SalesFollowup::counts($scope),
        ]);
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.followups.create');

        $leadId = (int)$request->input('lead_id');
        $lead   = SalesLead::findRaw($leadId);
        if (!$lead) {
            Response::error('Lead not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $lead);

        $dueDate = (string)$request->input('due_date', '');
        if (!$this->isValidDate($dueDate)) {
            Response::error('A valid follow-up date is required', 422);
        }
        $dueTime = $request->input('due_time');
        if (!empty($dueTime) && !$this->isValidTime((string)$dueTime)) {
            Response::error('Invalid follow-up time', 422);
        }

        $id = SalesFollowup::create([
            'lead_id'     => $leadId,
            'due_date'    => $dueDate,
            'due_time'    => $dueTime ?: null,
            'assigned_to' => $lead['assigned_to'] ?? ($request->user['user_id'] ?? null),
            'purpose'     => (string)$request->input('purpose', ''),
        ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

        SalesActivity::log(
            $leadId, 'followup_created',
            'Follow-up scheduled for ' . $dueDate . ($dueTime ? ' ' . $dueTime : ''),
            $request->user, (string)$request->input('purpose', ''), 'followup', $id
        );
        SalesLead::refreshSchedule($leadId);

        Response::success(['id' => $id, 'lead' => SalesLead::find($leadId)], 'Follow-up created', 201);
    }

    public function update(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.followups.create');

        $id  = (int)$request->param('id');
        $row = SalesFollowup::findRaw($id);
        if (!$row) {
            Response::error('Follow-up not found', 404);
        }
        $this->assertAccess($request, $row);
        $this->assertIsOwner($request, $row);

        if ($row['status'] !== 'pending') {
            Response::error('Only a pending follow-up can be edited', 409);
        }

        // Every edit carries a reason, and the reason is shown to the team.
        $reason = trim((string)$request->input('edit_reason', ''));
        if (mb_strlen($reason) < 3) {
            Response::error('Say why you are changing this follow-up — the team sees the reason', 422);
        }
        if (mb_strlen($reason) > 300) {
            Response::error('Keep the reason under 300 characters', 422);
        }

        $data = [];
        if ($request->input('due_date') !== null) {
            if (!$this->isValidDate((string)$request->input('due_date'))) {
                Response::error('Invalid follow-up date', 422);
            }
            $data['due_date'] = $request->input('due_date');
        }
        if ($request->input('due_time') !== null) {
            $t = (string)$request->input('due_time');
            if ($t !== '' && !$this->isValidTime($t)) {
                Response::error('Invalid follow-up time', 422);
            }
            $data['due_time'] = $t ?: null;
        }
        if ($request->input('purpose') !== null) {
            $data['purpose'] = mb_substr((string)$request->input('purpose'), 0, 200);
        }

        if (!$data) {
            Response::error('Nothing to update', 400);
        }

        SalesFollowup::edit($id, $data, $request->user, $reason);
        $leadId  = (int)$row['lead_id'];
        SalesLead::refreshSchedule($leadId);
        $updated = SalesFollowup::findRaw($id);

        // An edit is part of the sales history: record what actually moved and
        // why, so a rescheduled follow-up can never look like it was missed.
        $changes   = $this->describeChanges($row, $updated ?? $row);
        $changes[] = 'Reason: ' . $reason;
        SalesActivity::log(
            $leadId,
            'followup_updated',
            'Follow-up edited by ' . (string)($request->user['name'] ?? 'someone'),
            $request->user,
            implode('; ', $changes),
            'followup',
            $id
        );

        Response::success(
            ['followup' => $updated ? SalesFollowup::format($updated) : null],
            'Follow-up updated'
        );
    }

    public function complete(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.followups.complete');

        $id  = (int)$request->param('id');
        $row = SalesFollowup::findRaw($id);
        if (!$row) {
            Response::error('Follow-up not found', 404);
        }
        $this->assertAccess($request, $row);

        if ($row['status'] !== 'pending') {
            Response::error('This follow-up is already ' . $row['status'], 409);
        }

        $leadId = (int)$row['lead_id'];
        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        // ── Everything is checked before anything is written ─────────────────
        // Completing can also create the next follow-up and move the lead. Half
        // of that happening and then a 422 arriving would leave the queue in a
        // state nobody asked for and no screen explains.

        // Absent means an older client that only ever said "done" — which is
        // the answer it always implied.
        $outcome = strtolower(trim((string)$request->input('outcome', '')));
        if ($outcome === '') {
            $outcome = 'completed';
        }
        if (!in_array($outcome, SalesFollowup::OUTCOMES, true)) {
            Response::error(
                'Invalid outcome. Allowed: ' . implode(', ', SalesFollowup::OUTCOMES),
                422
            );
        }

        $notes = trim((string)$request->input('outcome_notes', ''));
        if ($outcome === 'not_interested' && $notes === '') {
            Response::error('Say why they are not interested — that reason is the useful part.', 422);
        }

        $nextDate = trim((string)$request->input('next_followup_date', ''));
        $nextTime = trim((string)$request->input('next_followup_time', ''));
        if ($outcome === 'not_picked_up' && $nextDate === '') {
            Response::error('Nobody answered, so pick a date to try again.', 422);
        }
        if ($nextDate !== '' && !$this->isValidDate($nextDate)) {
            Response::error('Invalid next follow-up date', 422);
        }
        if ($nextTime !== '' && !$this->isValidTime($nextTime)) {
            Response::error('Invalid next follow-up time', 422);
        }

        // Moving the lead is a lead edit, whoever asked for it.
        $markLost = $outcome === 'not_interested' && (bool)$request->input('mark_lead_lost', false);
        $markHot  = $outcome === 'interested'     && (bool)$request->input('mark_lead_hot', false);
        if (($markLost || $markHot) && !SalesPermissions::has($request->user, 'sales.leads.edit')) {
            Response::error('You do not have permission to change the lead itself.', 403);
        }

        // ── Writes ───────────────────────────────────────────────────────────
        SalesFollowup::complete($id, $userId, $notes !== '' ? $notes : null, $outcome);

        $label = ucfirst(str_replace('_', ' ', $outcome));
        SalesActivity::log(
            $leadId,
            'followup_completed',
            'Follow-up completed — ' . $label,
            $request->user,
            $notes,
            'followup',
            $id,
            ['outcome' => $outcome]
        );

        // Chain the next follow-up in the same action.
        $nextId = null;
        if ($nextDate !== '') {
            $nextId = SalesFollowup::create([
                'lead_id'     => $leadId,
                'due_date'    => $nextDate,
                'due_time'    => $nextTime ?: null,
                'assigned_to' => $row['assigned_to'],
                'purpose'     => (string)$request->input('next_followup_purpose', ''),
            ], $userId);

            SalesActivity::log(
                $leadId, 'followup_created',
                'Follow-up scheduled for ' . $nextDate,
                $request->user, '', 'followup', $nextId
            );
        }

        $this->applyToLead($request, $leadId, $outcome, $notes, $markLost, $markHot);

        // The lead's own "last outcome" learns what the follow-up learned,
        // rather than only recording that somebody touched it.
        SalesLead::touchActivity($leadId, SalesFollowup::OUTCOME_ON_LEAD[$outcome] ?? null);
        SalesLead::refreshSchedule($leadId);

        Response::success(
            ['next_followup_id' => $nextId, 'outcome' => $outcome],
            'Follow-up completed — ' . $label
        );
    }

    /**
     * The part of the answer that belongs on the lead rather than on the
     * follow-up.
     *
     * "Not interested" left sitting in the pipeline as an open lead is how a
     * board fills with work nobody intends to do, so the dialog offers to close
     * it — but only offers: a person ticks it, the timeline records it with the
     * reason, and it is undone by editing the lead like any other status.
     *
     * A lead already converted or onboarding is never moved. Whatever one
     * follow-up says, the deal is further along than this.
     */
    private function applyToLead(
        Request $request,
        int $leadId,
        string $outcome,
        string $notes,
        bool $markLost,
        bool $markHot
    ): void {
        if (!$markLost && !$markHot) {
            return;
        }
        $lead = SalesLead::findRaw($leadId);
        if (!$lead) {
            return;
        }

        if ($markLost) {
            if (in_array((string)$lead['status'], ['converted', 'onboarding', 'lost'], true)) {
                return;
            }
            SalesLead::update($leadId, ['status' => 'lost', 'temperature' => 'cold']);
            SalesActivity::log(
                $leadId, 'status_changed',
                'Marked lost — not interested',
                $request->user, $notes, 'followup', null
            );
            return;
        }

        if ((string)$lead['temperature'] === 'hot') {
            return;
        }
        SalesLead::update($leadId, ['temperature' => 'hot']);
        SalesActivity::log(
            $leadId, 'temperature_changed',
            'Marked hot — interested at follow-up',
            $request->user, $notes, 'followup', null
        );
    }

    public function cancel(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.followups.complete');

        $id  = (int)$request->param('id');
        $row = SalesFollowup::findRaw($id);
        if (!$row) {
            Response::error('Follow-up not found', 404);
        }
        $this->assertAccess($request, $row);

        SalesFollowup::cancel($id);
        SalesLead::refreshSchedule((int)$row['lead_id']);

        Response::success(null, 'Follow-up cancelled');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** A user may act on a follow-up assigned to them, or on one of their leads. */
    private function assertAccess(Request $request, array $followup): void
    {
        if (SalesPermissions::canSeeAllLeads($request->user)) {
            return;
        }
        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ((int)($followup['assigned_to'] ?? 0) === $userId) {
            return;
        }
        $lead = SalesLead::findRaw((int)$followup['lead_id']);
        if (!$lead || (int)($lead['assigned_to'] ?? 0) !== $userId) {
            Response::error('Follow-up not found', 404);
        }
    }

    /**
     * Editing is the owner's alone.
     *
     * A follow-up is a promise one person made about one lead; someone else
     * quietly moving the date is how a commitment goes missing without anyone
     * noticing. Sales administrators are allowed through because somebody has
     * to be able to fix a genuine mistake — and when they do, the edit trail
     * names them, so it is a correction on the record rather than a silent one.
     */
    private function assertIsOwner(Request $request, array $followup): void
    {
        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if (SalesFollowup::ownerId($followup) === $userId && $userId > 0) {
            return;
        }
        if (SalesPermissions::isAdmin($request->user)) {
            return;
        }
        Response::error(
            'Only the person this follow-up belongs to can edit it. Add a comment instead.',
            403
        );
    }

    /** Human-readable diff for the timeline entry. */
    private function describeChanges(array $before, array $after): array
    {
        $changes = [];
        $when = static function (array $r): string {
            return (string)$r['due_date'] . ($r['due_time'] ? ' ' . substr((string)$r['due_time'], 0, 5) : '');
        };
        if ($when($before) !== $when($after)) {
            $changes[] = 'Rescheduled from ' . $when($before) . ' to ' . $when($after);
        }
        if ((string)($before['purpose'] ?? '') !== (string)($after['purpose'] ?? '')) {
            $changes[] = 'Purpose: ' . ((string)($after['purpose'] ?? '') !== '' ? $after['purpose'] : '(cleared)');
        }
        return $changes;
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
