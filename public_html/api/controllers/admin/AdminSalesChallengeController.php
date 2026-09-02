<?php
declare(strict_types=1);

/**
 * Sales Challenges Controller — "Challenge Accepted".
 *
 *   GET    /admin/sales/challenges                 — list (+ status counts)
 *   POST   /admin/sales/challenges                 — create (admin)
 *   GET    /admin/sales/challenges/{id}            — detail (+ activity, report)
 *   PUT    /admin/sales/challenges/{id}            — edit (admin)
 *   POST   /admin/sales/challenges/{id}/accept     — accept
 *   POST   /admin/sales/challenges/{id}/start      — move to in-progress
 *   POST   /admin/sales/challenges/{id}/complete   — complete before deadline
 *   POST   /admin/sales/challenges/{id}/expire     — force the expiry sweep (admin)
 *   POST   /admin/sales/challenges/{id}/cancel     — cancel (admin)
 *   DELETE /admin/sales/challenges/{id}            — blocked; history is kept
 *
 * The deadline is enforced by the DATABASE, not the caller: sweepExpired() runs
 * first on every request, and accept/start/complete carry `deadline > NOW()` in
 * their WHERE clause. A hand-crafted request cannot complete an expired
 * challenge, and the frontend countdown has no authority over any of this.
 */
class AdminSalesChallengeController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.view');
        SalesChallenge::sweepExpired();

        // Viewing a colleague shows that colleague's board — what they set,
        // took, or were offered — counted the same way.
        $viewing   = SalesViewAs::current();
        $subject   = $viewing !== null ? ['user_id' => (int)$viewing['user_id']] : $request->user;
        $isManager = $viewing === null && SalesPermissions::has($request->user, 'sales.challenges.manage');
        $status    = (string)$request->query('status', '');
        if ($status !== '' && !in_array($status, SalesChallenge::STATUSES, true)) {
            Response::error('Invalid status filter', 422);
        }

        $result = SalesChallenge::all(
            $status,
            $subject,
            $isManager,
            (int)$request->query('page', 1),
            (int)$request->query('limit', 200),
            SalesViewAs::userId()
        );

        Response::success([
            // Decorated per row so the board can grey out what is not yours to
            // take. The same rule is re-applied in accept() — this only decides
            // which buttons are worth drawing.
            'items'       => array_map(fn(array $c): array => $this->withAcceptance($c, $request), $result['rows']),
            'pagination'  => $result['pagination'],
            'counts'      => SalesChallenge::counts($subject, $isManager),
            'server_time' => SalesChallenge::serverTime(),
            'can_manage'  => $isManager,
        ]);
    }

    public function show(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.view');
        SalesChallenge::sweepExpired();

        $id        = (int)$request->param('id');
        $challenge = SalesChallenge::find($id);
        if (!$challenge) {
            Response::error('Challenge not found', 404);
        }

        // Anyone on the team may read a challenge and join the discussion on it.
        // Accepting is the restricted act, and `can_accept` says who may.
        $challenge = $this->withAcceptance($challenge, $request);

        $challenge['report']   = $this->report($challenge);
        $challenge['comments'] = SalesComment::forEntity('challenge', $id);
        Response::success($challenge);
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.create');

        $title = trim((string)$request->input('title', ''));
        if (mb_strlen($title) < 3) {
            Response::error('Challenge title is required', 422);
        }

        $deadline = $this->validDeadline($request->input('deadline'), true);

        $priority = strtolower(trim((string)$request->input('priority', 'normal')));
        if (!in_array($priority, SalesChallenge::PRIORITIES, true)) {
            Response::error('Invalid priority. Allowed: ' . implode(', ', SalesChallenge::PRIORITIES), 422);
        }

        $leadId = $request->input('lead_id');
        if (!empty($leadId) && !SalesLead::findRaw((int)$leadId)) {
            Response::error('Related lead not found', 422);
        }

        $id = SalesChallenge::create([
            'title'       => $title,
            'description' => $request->input('description'),
            'lead_id'     => $leadId,
            'client_id'   => $request->input('client_id'),
            'deadline'    => $deadline,
            'priority'    => $priority,
        ], isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);

        $assignees = $request->input('assignees', []);
        if (is_array($assignees) && $assignees) {
            SalesChallenge::setAssignees($id, $assignees);
        }

        SalesChallenge::logActivity($id, 'created', $request->user, $title);

        Response::success($this->detail($id, $request), 'Challenge created', 201);
    }

    public function update(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.manage');
        SalesChallenge::sweepExpired();

        $id  = (int)$request->param('id');
        $raw = SalesChallenge::findRaw($id);
        if (!$raw) {
            Response::error('Challenge not found', 404);
        }
        if (in_array($raw['status'], ['completed', 'expired', 'cancelled'], true)) {
            Response::error('A ' . $raw['status'] . ' challenge can no longer be edited', 409);
        }

        $data = [];
        if ($request->input('title') !== null) {
            $title = trim((string)$request->input('title'));
            if (mb_strlen($title) < 3) {
                Response::error('Challenge title is required', 422);
            }
            $data['title'] = $title;
        }
        if ($request->input('description') !== null) {
            $data['description'] = $request->input('description');
        }
        if ($request->input('deadline') !== null) {
            $data['deadline'] = $this->validDeadline($request->input('deadline'), true);
        }
        if ($request->input('priority') !== null) {
            $priority = strtolower(trim((string)$request->input('priority')));
            if (!in_array($priority, SalesChallenge::PRIORITIES, true)) {
                Response::error('Invalid priority', 422);
            }
            $data['priority'] = $priority;
        }
        if ($request->input('lead_id') !== null) {
            $data['lead_id'] = $request->input('lead_id');
        }

        if ($data) {
            SalesChallenge::update($id, $data);
        }

        $assignees = $request->input('assignees');
        if (is_array($assignees)) {
            SalesChallenge::setAssignees($id, $assignees);
        }

        SalesChallenge::logActivity($id, 'updated', $request->user);

        Response::success($this->detail($id, $request), 'Challenge updated');
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    public function accept(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.accept');
        SalesChallenge::sweepExpired();

        $id  = (int)$request->param('id');
        $raw = SalesChallenge::findRaw($id);
        if (!$raw) {
            Response::error('Challenge not found', 404);
        }

        $userId = (int)$request->user['user_id'];

        // Setting the challenge and taking it are opposite roles. Someone who
        // could do both could hand themselves an easy target and claim it, and
        // the whole board would stop meaning anything.
        if ($raw['created_by'] !== null && (int)$raw['created_by'] === $userId) {
            Response::error('You set this challenge — someone else has to take it', 403);
        }
        if (!SalesChallenge::isOfferedTo($id, $userId)) {
            Response::error('This challenge was not offered to you', 403);
        }
        if ($raw['status'] === 'expired') {
            Response::error('This challenge has expired', 409);
        }
        if ($raw['status'] !== 'available') {
            Response::error('This challenge is already ' . $raw['status'], 409);
        }

        if (!SalesChallenge::accept($id, $userId)) {
            // Lost the race: someone accepted first, or the deadline passed
            // between the read and the write.
            SalesChallenge::sweepExpired();
            Response::error('This challenge is no longer available', 409);
        }

        SalesChallenge::logActivity($id, 'accepted', $request->user);
        Response::success($this->detail($id, $request), 'Challenge accepted');
    }

    public function start(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.accept');
        SalesChallenge::sweepExpired();

        $id     = (int)$request->param('id');
        $raw    = SalesChallenge::findRaw($id);
        $userId = (int)$request->user['user_id'];

        if (!$raw) {
            Response::error('Challenge not found', 404);
        }
        if ((int)$raw['accepted_by'] !== $userId) {
            Response::error('Only the sales user who accepted this challenge can start it', 403);
        }
        if ($raw['status'] === 'expired') {
            Response::error('This challenge has expired', 409);
        }
        if (!SalesChallenge::start($id, $userId)) {
            Response::error('This challenge cannot be started', 409);
        }

        SalesChallenge::logActivity($id, 'started', $request->user);
        Response::success($this->detail($id, $request), 'Challenge in progress');
    }

    public function complete(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.complete');
        SalesChallenge::sweepExpired();

        $id     = (int)$request->param('id');
        $raw    = SalesChallenge::findRaw($id);
        $userId = (int)$request->user['user_id'];

        if (!$raw) {
            Response::error('Challenge not found', 404);
        }
        if ((int)$raw['accepted_by'] !== $userId) {
            Response::error('Only the sales user who accepted this challenge can complete it', 403);
        }
        if ($raw['status'] === 'expired') {
            Response::error('This challenge has expired and can no longer be completed', 409);
        }
        if ($raw['status'] === 'completed') {
            Response::error('This challenge is already completed', 409);
        }

        $notes = $request->input('completion_notes');

        // The deadline guard lives in the UPDATE — a request that arrives a
        // moment after the deadline changes nothing and is reported as expired.
        if (!SalesChallenge::complete($id, $userId, $notes)) {
            SalesChallenge::sweepExpired();
            $after = SalesChallenge::findRaw($id);
            if ($after && $after['status'] === 'expired') {
                Response::error('This challenge has expired and can no longer be completed', 409);
            }
            Response::error('This challenge cannot be completed', 409);
        }

        SalesChallenge::logActivity($id, 'completed', $request->user, $notes);
        Response::success($this->detail($id, $request), 'Challenge completed');
    }

    /** POST /admin/sales/challenges/{id}/expire — only valid past the deadline. */
    public function expire(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.manage');

        $id  = (int)$request->param('id');
        $raw = SalesChallenge::findRaw($id);
        if (!$raw) {
            Response::error('Challenge not found', 404);
        }
        if ($raw['status'] === 'expired') {
            Response::success($this->detail($id, $request), 'Challenge already expired');
        }
        if (!SalesChallenge::expire($id)) {
            Response::error('This challenge has not reached its deadline yet', 409);
        }

        SalesChallenge::logActivity($id, 'expired', $request->user, 'Expired by administrator after deadline');
        Response::success($this->detail($id, $request), 'Challenge expired');
    }

    public function cancel(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.manage');

        $id = (int)$request->param('id');
        if (!SalesChallenge::findRaw($id)) {
            Response::error('Challenge not found', 404);
        }
        if (!SalesChallenge::cancel($id)) {
            Response::error('This challenge can no longer be cancelled', 409);
        }

        SalesChallenge::logActivity($id, 'cancelled', $request->user);
        Response::success($this->detail($id, $request), 'Challenge cancelled');
    }

    /** Completed and expired challenges stay in history — deletion is refused. */
    public function destroy(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.challenges.manage');
        Response::error('Challenges are kept as history and cannot be deleted. Cancel it instead.', 409);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** One challenge, with the acceptance flags every response carries. */
    private function detail(int $id, Request $request): ?array
    {
        $challenge = SalesChallenge::find($id);
        return $challenge ? $this->withAcceptance($challenge, $request) : null;
    }

    /**
     * Who may accept this challenge, answered on the server so the board and
     * the detail page cannot disagree.
     *
     * Three separate conditions, kept separate because they fail for different
     * reasons and the UI says something different for each: it was offered to
     * someone else, you set it yourself, or you do not hold the permission.
     */
    private function withAcceptance(array $challenge, Request $request): array
    {
        // Read from the subject's side, so viewing a colleague reads as their
        // board — but never offering the button, because the accept endpoint
        // will always act as the real caller and refuse.
        $viewing = SalesViewAs::current();
        $userId  = SalesViewAs::subjectId($request->user);
        $offered = SalesChallenge::isOfferedTo((int)$challenge['id'], $userId);
        $isMine  = $challenge['created_by'] !== null && (int)$challenge['created_by'] === $userId;

        $challenge['is_offered_to_me'] = $offered;
        $challenge['i_created_it']     = $isMine;
        $challenge['can_accept']       = $viewing === null
            && $offered
            && !$isMine
            && $challenge['status'] === 'available'
            && SalesPermissions::has($request->user, 'sales.challenges.accept');

        return $challenge;
    }

    /**
     * The destroyed-state report (spec §35). Only fields the backend actually
     * knows are returned — no fabricated streaks, completion percentages or
     * witness notifications.
     */
    private function report(array $challenge): array
    {
        $report = [
            'contract' => strtoupper($challenge['status']),
            'status'   => $challenge['status'] === 'expired' ? 'DESTROYED' : strtoupper($challenge['status']),
            'deadline' => $challenge['deadline'],
        ];

        if ($challenge['status'] === 'expired') {
            $report['time_left'] = '00:00:00';
        }
        if ($challenge['accepted_by_name']) {
            $report['accepted_by'] = $challenge['accepted_by_name'];
            $report['accepted_at'] = $challenge['accepted_at'];
        }
        if ($challenge['completed_at']) {
            $report['completed_at'] = $challenge['completed_at'];
        }
        if ($challenge['expired_at']) {
            $report['expired_at'] = $challenge['expired_at'];
        }
        if ($challenge['accepted_at'] && $challenge['expired_at']) {
            $held = strtotime((string)$challenge['expired_at']) - strtotime((string)$challenge['accepted_at']);
            $report['held_for'] = $this->humanDuration(max(0, $held));
        }

        return $report;
    }

    private function humanDuration(int $seconds): string
    {
        $h = intdiv($seconds, 3600);
        $m = intdiv($seconds % 3600, 60);
        $s = $seconds % 60;
        return sprintf('%02d:%02d:%02d', $h, $m, $s);
    }

    private function validDeadline(mixed $value, bool $mustBeFuture): string
    {
        $raw = trim((string)$value);
        if ($raw === '') {
            Response::error('A deadline is required', 422);
        }

        // Accept "Y-m-d H:i", "Y-m-d H:i:s" and the HTML datetime-local "Y-m-d\TH:i".
        $normalised = str_replace('T', ' ', $raw);
        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $normalised)) {
            $normalised .= ':00';
        }

        $dt = DateTime::createFromFormat('Y-m-d H:i:s', $normalised);
        if ($dt === false || $dt->format('Y-m-d H:i:s') !== $normalised) {
            Response::error('Invalid deadline. Expected YYYY-MM-DD HH:MM', 422);
        }

        // Compare against SERVER time, not the caller's clock.
        if ($mustBeFuture && $normalised <= SalesChallenge::serverTime()) {
            Response::error('The deadline must be in the future', 422);
        }

        return $normalised;
    }
}
