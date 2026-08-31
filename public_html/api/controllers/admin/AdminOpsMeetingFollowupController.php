<?php
declare(strict_types=1);

/**
 * Ops Meeting Follow-up Controller
 *
 * GET    /admin/ops/meetings/{meeting_id}/followups   — list follow-ups
 * POST   /admin/ops/meetings/{meeting_id}/followups   — add follow-up
 * PUT    /admin/ops/meetings/followups/{id}           — update follow-up
 * DELETE /admin/ops/meetings/followups/{id}           — delete follow-up
 */
class AdminOpsMeetingFollowupController
{
    public function index(Request $request): void
    {
        $meetingId = (int) $request->param('meeting_id');
        $tenantId  = Database::tenantId();

        $meeting = Database::fetch(
            'SELECT * FROM ops_meetings WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$meetingId, $tenantId]
        );
        if (!$meeting) Response::error('Meeting not found', 404);

        $followups = Database::fetchAll(
            'SELECT * FROM ops_meeting_followups WHERE meeting_id = ? AND tenant_id = ? ORDER BY date ASC, created_at ASC',
            [$meetingId, $tenantId]
        );

        Response::success([
            'meeting'   => $meeting,
            'followups' => $followups,
        ]);
    }

    public function store(Request $request): void
    {
        $meetingId = (int) $request->param('meeting_id');
        $body      = $request->body();
        $tenantId  = Database::tenantId();

        $meeting = Database::fetch(
            'SELECT * FROM ops_meetings WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$meetingId, $tenantId]
        );
        if (!$meeting) Response::error('Meeting not found', 404);

        $outcome = trim((string)($body['outcome'] ?? ''));
        if (!$outcome) Response::error('Outcome is required', 422);

        $date = $body['date'] ?? date('Y-m-d');

        $id = Database::insert('ops_meeting_followups', [
            'tenant_id'  => $tenantId,
            'meeting_id' => $meetingId,
            'date'       => $date,
            'outcome'    => $outcome,
            'notes'      => trim((string)($body['notes'] ?? '')) ?: null,
            'added_by'   => trim((string)($body['added_by'] ?? '')),
        ]);

        // Log to activity timeline for the client
        if ($meeting['client_id']) {
            Database::insert('ops_activity_log', [
                'tenant_id'   => $tenantId,
                'entity_type' => 'client',
                'entity_id'   => (int)$meeting['client_id'],
                'action'      => 'meeting_outcome',
                'description' => "Follow-up recorded: {$outcome}",
                'done_by'     => trim((string)($body['added_by'] ?? '')),
            ]);
        }

        $row = Database::fetch('SELECT * FROM ops_meeting_followups WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'Follow-up added', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $fu = Database::fetch(
            'SELECT * FROM ops_meeting_followups WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$fu) Response::error('Follow-up not found', 404);

        $updates = [];
        if (isset($body['date']))    $updates['date']    = $body['date'];
        if (isset($body['outcome'])) $updates['outcome'] = trim((string)$body['outcome']);
        if (isset($body['notes']))   $updates['notes']   = trim((string)$body['notes']) ?: null;

        if (empty($updates)) Response::error('Nothing to update', 422);
        Database::update('ops_meeting_followups', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

        $row = Database::fetch('SELECT * FROM ops_meeting_followups WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        Database::fetch('SELECT id FROM ops_meeting_followups WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Follow-up not found', 404);

        Database::query('DELETE FROM ops_meeting_followups WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['deleted' => true]);
    }
}
