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

        $scope  = SalesPermissions::leadScope($request->user);
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

        $notes  = $request->input('outcome_notes');
        $leadId = (int)$row['lead_id'];

        SalesFollowup::complete($id, isset($request->user['user_id']) ? (int)$request->user['user_id'] : null, $notes);
        SalesActivity::log($leadId, 'followup_completed', 'Follow-up completed', $request->user, (string)$notes, 'followup', $id);

        // Optionally chain the next follow-up in the same action.
        $nextId   = null;
        $nextDate = $request->input('next_followup_date');
        if (!empty($nextDate)) {
            if (!$this->isValidDate((string)$nextDate)) {
                Response::error('Invalid next follow-up date', 422);
            }
            $nextTime = $request->input('next_followup_time');
            if (!empty($nextTime) && !$this->isValidTime((string)$nextTime)) {
                Response::error('Invalid next follow-up time', 422);
            }
            $nextId = SalesFollowup::create([
                'lead_id'     => $leadId,
                'due_date'    => $nextDate,
                'due_time'    => $nextTime ?: null,
                'assigned_to' => $row['assigned_to'],
                'purpose'     => (string)$request->input('next_followup_purpose', ''),
            ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

            SalesActivity::log(
                $leadId, 'followup_created',
                'Follow-up scheduled for ' . $nextDate,
                $request->user, '', 'followup', $nextId
            );
        }

        SalesLead::touchActivity($leadId);
        SalesLead::refreshSchedule($leadId);

        Response::success(['next_followup_id' => $nextId], 'Follow-up completed');
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
