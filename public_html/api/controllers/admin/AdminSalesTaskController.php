<?php
declare(strict_types=1);

/**
 * Sales Tasks Controller — assign work, and be told when it comes back.
 *
 *   GET    /admin/sales/tasks                  — list (+ counts)
 *   POST   /admin/sales/tasks                  — assign a task to someone
 *   GET    /admin/sales/tasks/{id}             — detail (+ activity, comments)
 *   PUT    /admin/sales/tasks/{id}             — edit (assigner or admin)
 *   POST   /admin/sales/tasks/{id}/start       — assignee picks it up
 *   POST   /admin/sales/tasks/{id}/complete    — assignee finishes it
 *   POST   /admin/sales/tasks/{id}/reopen      — assigner hands it back
 *   POST   /admin/sales/tasks/{id}/acknowledge — assigner accepts the work
 *   POST   /admin/sales/tasks/{id}/cancel      — assigner or admin calls it off
 *   POST   /admin/sales/tasks/{id}/restore     — undo a cancellation
 *
 * Two roles decide everything: the ASSIGNEE is the only one who can complete a
 * task, and the ASSIGNER is the only one told when they do (and the only one
 * who can hand it back). Being an administrator does not make you either — an
 * admin can cancel or reassign, which is honest, but cannot quietly mark
 * somebody else's work done.
 */
class AdminSalesTaskController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.view');

        $userId = $this->userId($request);
        // A manager viewing one colleague wants that colleague's board, not
        // everybody's.
        $seeAll = !SalesViewAs::active() && SalesPermissions::has($request->user, 'sales.tasks.manage');

        $status = (string)$request->query('status', '');
        if ($status !== '' && !in_array($status, SalesTask::STATUSES, true)) {
            Response::error('Invalid status filter', 422);
        }
        $bucket = (string)$request->query('bucket', '');
        if ($bucket !== '' && !in_array($bucket, ['mine', 'given', 'overdue', 'completed'], true)) {
            Response::error('Invalid bucket. Allowed: mine, given, overdue, completed', 422);
        }

        $result = SalesTask::all(
            [
                'status'      => $status,
                'bucket'      => $bucket,
                'assigned_to' => $request->query('assigned_to'),
                'assigned_by' => $request->query('assigned_by'),
                'lead_id'     => $request->query('lead_id'),
                'search'      => trim((string)$request->query('search', '')),
            ],
            $userId,
            $seeAll,
            (int)$request->query('page', 1),
            (int)$request->query('limit', 200)
        );

        Response::success([
            'items'      => array_map(fn(array $t) => $this->withCapabilities($t, $request), $result['rows']),
            'pagination' => $result['pagination'],
            'counts'     => SalesTask::counts($userId, $seeAll),
            'can_manage' => $seeAll,
            'me'         => $userId,
        ]);
    }

    public function show(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.view');

        $id   = (int)$request->param('id');
        $task = SalesTask::find($id);
        if (!$task) {
            Response::error('Task not found', 404);
        }
        $this->assertVisible($request, $task);

        $task = $this->withCapabilities($task, $request);
        $task['comments'] = SalesComment::forEntity('task', $id);
        Response::success($task);
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.create');

        $title = trim((string)$request->input('title', ''));
        if (mb_strlen($title) < 3) {
            Response::error('A task title is required', 422);
        }

        $assignedTo = (int)$request->input('assigned_to', 0);
        $assignee   = $this->assignee($assignedTo);

        $dueDate = $this->optionalDate($request->input('due_date'));
        $dueTime = $this->optionalTime($request->input('due_time'));
        $priority = $this->validPriority($request->input('priority', 'normal'));

        $leadId = $request->input('lead_id');
        if (!empty($leadId)) {
            $lead = SalesLead::findRaw((int)$leadId);
            if (!$lead) {
                Response::error('Related lead not found', 422);
            }
            SalesPermissions::assertLeadAccess($request->user, $lead);
        }

        $id = SalesTask::create([
            'title'            => $title,
            'description'      => $request->input('description'),
            'assigned_to'      => $assignedTo,
            'assigned_to_name' => (string)$assignee['name'],
            'lead_id'          => $leadId,
            'due_date'         => $dueDate,
            'due_time'         => $dueTime,
            'priority'         => $priority,
        ], $request->user);

        SalesTask::logActivity($id, 'created', $request->user, 'Assigned to ' . $assignee['name']);

        Response::success($this->detail($id, $request), 'Task assigned to ' . $assignee['name'], 201);
    }

    public function update(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.create');

        $id  = (int)$request->param('id');
        $raw = SalesTask::findRaw($id);
        if (!$raw) {
            Response::error('Task not found', 404);
        }
        $this->assertCanDirect($request, $raw, 'edit');

        if (in_array($raw['status'], ['completed', 'cancelled'], true)) {
            Response::error('A ' . $raw['status'] . ' task can no longer be edited. Reopen it first.', 409);
        }

        $data    = [];
        $changes = [];

        if ($request->input('title') !== null) {
            $title = trim((string)$request->input('title'));
            if (mb_strlen($title) < 3) {
                Response::error('A task title is required', 422);
            }
            if ($title !== (string)$raw['title']) {
                $changes[] = 'Title: ' . $title;
            }
            $data['title'] = $title;
        }
        if ($request->input('description') !== null) {
            $data['description'] = $request->input('description');
        }
        if ($request->input('due_date') !== null) {
            $data['due_date'] = $this->optionalDate($request->input('due_date'));
            if ((string)$data['due_date'] !== (string)($raw['due_date'] ?? '')) {
                $changes[] = 'Due: ' . ($data['due_date'] ?: 'cleared');
            }
        }
        if ($request->input('due_time') !== null) {
            $data['due_time'] = $this->optionalTime($request->input('due_time'));
        }
        if ($request->input('priority') !== null) {
            $data['priority'] = $this->validPriority($request->input('priority'));
            if ($data['priority'] !== (string)$raw['priority']) {
                $changes[] = 'Priority: ' . $data['priority'];
            }
        }
        if ($request->input('lead_id') !== null) {
            $data['lead_id'] = $request->input('lead_id');
        }
        if ($request->input('assigned_to') !== null) {
            $newAssignee = $this->assignee((int)$request->input('assigned_to'));
            if ((int)$request->input('assigned_to') !== (int)$raw['assigned_to']) {
                $changes[] = 'Reassigned to ' . $newAssignee['name'];
            }
            $data['assigned_to']      = (int)$request->input('assigned_to');
            $data['assigned_to_name'] = (string)$newAssignee['name'];
        }

        if (!$data) {
            Response::error('Nothing to update', 400);
        }

        SalesTask::update($id, $data);
        SalesTask::logActivity($id, 'updated', $request->user, $changes ? implode('; ', $changes) : null);

        Response::success($this->detail($id, $request), 'Task updated');
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    public function start(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.complete');

        $raw = $this->mine($request);
        if (!SalesTask::start((int)$raw['id'], $this->userId($request))) {
            Response::error('This task cannot be started', 409);
        }

        SalesTask::logActivity((int)$raw['id'], 'started', $request->user);
        Response::success($this->detail((int)$raw['id'], $request), 'Task started');
    }

    public function complete(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.complete');

        $raw   = $this->mine($request);
        $notes = $request->input('completion_notes');

        if (!SalesTask::complete((int)$raw['id'], $this->userId($request), $notes ? (string)$notes : null)) {
            Response::error('This task is already ' . $raw['status'], 409);
        }

        // The assigner is told through the notification feed, which reads this
        // row — nothing is pushed from here, so the message survives a reload.
        SalesTask::logActivity((int)$raw['id'], 'completed', $request->user, $notes ? (string)$notes : null);
        Response::success($this->detail((int)$raw['id'], $request), 'Task completed');
    }

    /** The assigner hands it back, with a reason — that reason IS the message. */
    public function reopen(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.create');

        $id  = (int)$request->param('id');
        $raw = SalesTask::findRaw($id);
        if (!$raw) {
            Response::error('Task not found', 404);
        }
        $this->assertCanDirect($request, $raw, 'reopen');

        $reason = trim((string)$request->input('reason', ''));
        if (!SalesTask::reopen($id)) {
            Response::error('Only a completed task can be reopened', 409);
        }

        SalesTask::logActivity($id, 'reopened', $request->user, $reason !== '' ? $reason : null);
        Response::success($this->detail($id, $request), 'Task reopened');
    }

    public function acknowledge(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.view');

        $id  = (int)$request->param('id');
        $raw = SalesTask::findRaw($id);
        if (!$raw) {
            Response::error('Task not found', 404);
        }
        $this->assertCanDirect($request, $raw, 'acknowledge');

        if (!SalesTask::acknowledge($id, $this->userId($request))) {
            Response::error('This task is not waiting to be accepted', 409);
        }

        SalesTask::logActivity($id, 'acknowledged', $request->user, 'Work accepted');
        Response::success($this->detail($id, $request), 'Task accepted');
    }

    public function cancel(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.create');

        $id  = (int)$request->param('id');
        $raw = SalesTask::findRaw($id);
        if (!$raw) {
            Response::error('Task not found', 404);
        }
        $this->assertCanDirect($request, $raw, 'cancel');

        if (!SalesTask::cancel($id, $this->userId($request))) {
            Response::error('This task can no longer be cancelled', 409);
        }

        SalesTask::logActivity($id, 'cancelled', $request->user, trim((string)$request->input('reason', '')) ?: null);
        Response::success($this->detail($id, $request), 'Task cancelled');
    }

    /** Undo — cancelling the wrong task is a human mistake, not a decision. */
    public function restore(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.tasks.create');

        $id  = (int)$request->param('id');
        $raw = SalesTask::findRaw($id);
        if (!$raw) {
            Response::error('Task not found', 404);
        }
        $this->assertCanDirect($request, $raw, 'restore');

        if (!SalesTask::restore($id)) {
            Response::error('Only a cancelled task can be restored', 409);
        }

        SalesTask::logActivity($id, 'restored', $request->user);
        Response::success($this->detail($id, $request), 'Task restored');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Whose board this request is about.
     *
     * That is the caller, unless they are reading a colleague's work — and
     * because the viewing parameter is only ever honoured on a GET, every
     * write below still resolves to the real caller.
     */
    private function userId(Request $request): int
    {
        return SalesViewAs::subjectId($request->user);
    }

    private function detail(int $id, Request $request): array
    {
        $task = SalesTask::find($id) ?? [];
        return $task ? $this->withCapabilities($task, $request) : $task;
    }

    /**
     * What this caller may do with this task, decided once on the server so the
     * two clients cannot disagree about it. Every one of these is re-checked on
     * the action itself — this only decides which buttons are worth drawing.
     */
    private function withCapabilities(array $task, Request $request): array
    {
        $userId     = $this->userId($request);
        $isAssignee = (int)$task['assigned_to'] === $userId;
        $isAssigner = $task['assigned_by'] !== null && (int)$task['assigned_by'] === $userId;
        $isAdmin    = !SalesViewAs::active() && SalesPermissions::has($request->user, 'sales.tasks.manage');
        // Reading someone else's board draws no buttons at all. Every action
        // below would be performed as the real caller, so a button here would
        // promise something the server is right to refuse.
        $viewing    = SalesViewAs::active();
        $live       = !$viewing && in_array($task['status'], SalesTask::LIVE_STATUSES, true);

        $task['is_assignee']     = $isAssignee;
        $task['is_assigner']     = $isAssigner;
        $task['can_start']       = !$viewing && $isAssignee && $task['status'] === 'open'
                                   && SalesPermissions::has($request->user, 'sales.tasks.complete');
        $task['can_complete']    = $isAssignee && $live
                                   && SalesPermissions::has($request->user, 'sales.tasks.complete');
        $task['can_edit']        = ($isAssigner || $isAdmin) && $live;
        $task['can_cancel']      = ($isAssigner || $isAdmin) && $live;
        $task['can_restore']     = !$viewing && ($isAssigner || $isAdmin) && $task['status'] === 'cancelled';
        $task['can_reopen']      = !$viewing && ($isAssigner || $isAdmin) && $task['status'] === 'completed';
        $task['can_acknowledge'] = !$viewing && ($isAssigner || $isAdmin) && $task['status'] === 'completed'
                                   && empty($task['reviewed_at']);
        return $task;
    }

    /** The task must be one the caller gave, was given, or administers. */
    private function assertVisible(Request $request, array $task): void
    {
        // An administrator sees every task — except while looking at one
        // colleague, where the detail page must agree with the list about
        // whose board this is.
        if (!SalesViewAs::active() && SalesPermissions::has($request->user, 'sales.tasks.manage')) {
            return;
        }
        $userId = $this->userId($request);
        if ((int)$task['assigned_to'] === $userId) {
            return;
        }
        if ($task['assigned_by'] !== null && (int)$task['assigned_by'] === $userId) {
            return;
        }
        // 404 rather than 403 — do not confirm that a task exists to someone
        // with nothing to do with it.
        Response::error('Task not found', 404);
    }

    /** Loads a task the caller is the ASSIGNEE of, or refuses. */
    private function mine(Request $request): array
    {
        $id  = (int)$request->param('id');
        $raw = SalesTask::findRaw($id);
        if (!$raw) {
            Response::error('Task not found', 404);
        }
        if ((int)$raw['assigned_to'] !== $this->userId($request)) {
            Response::error('Only the person this task was given to can do this', 403);
        }
        return $raw;
    }

    /** The assigner's actions — open to an administrator as well. */
    private function assertCanDirect(Request $request, array $task, string $verb): void
    {
        $userId = $this->userId($request);
        if ($task['assigned_by'] !== null && (int)$task['assigned_by'] === $userId) {
            return;
        }
        if (SalesPermissions::has($request->user, 'sales.tasks.manage')) {
            return;
        }
        Response::error("Only the person who assigned this task can $verb it", 403);
    }

    /** The assignee must be a real, active admin user of this tenant. */
    private function assignee(int $userId): array
    {
        if ($userId < 1) {
            Response::error('Choose who this task is for', 422);
        }
        $row = Database::fetch(
            "SELECT user_id, name FROM users
              WHERE tenant_id = ? AND user_id = ? AND user_type = 'admin' AND is_active = 1 LIMIT 1",
            [Database::tenantId(), $userId]
        );
        if (!$row) {
            Response::error('That person cannot be given tasks', 422);
        }
        return $row;
    }

    private function validPriority(mixed $value): string
    {
        $priority = strtolower(trim((string)$value));
        if ($priority === '') {
            return 'normal';
        }
        if (!in_array($priority, SalesTask::PRIORITIES, true)) {
            Response::error('Invalid priority. Allowed: ' . implode(', ', SalesTask::PRIORITIES), 422);
        }
        return $priority;
    }

    private function optionalDate(mixed $value): ?string
    {
        $raw = trim((string)$value);
        if ($raw === '') {
            return null;
        }
        $d = DateTime::createFromFormat('Y-m-d', $raw);
        if ($d === false || $d->format('Y-m-d') !== $raw) {
            Response::error('Invalid due date. Expected YYYY-MM-DD', 422);
        }
        return $raw;
    }

    private function optionalTime(mixed $value): ?string
    {
        $raw = trim((string)$value);
        if ($raw === '') {
            return null;
        }
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $raw)) {
            Response::error('Invalid due time', 422);
        }
        return strlen($raw) === 5 ? $raw . ':00' : $raw;
    }
}
