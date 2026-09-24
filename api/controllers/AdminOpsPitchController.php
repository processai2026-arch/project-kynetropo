<?php
declare(strict_types=1);

/**
 * Ops Pitches & Marketing Controller
 * GET    /admin/ops/pitches            — list with ROI
 * GET    /admin/ops/pitches/{id}       — detail with leads + ROI
 * POST   /admin/ops/pitches            — create (also creates expense)
 * PUT    /admin/ops/pitches/{id}       — update
 * DELETE /admin/ops/pitches/{id}
 */
class AdminOpsPitchController
{
    private const CONVERTED_STAGE = 'Advance Paid';

    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $rows     = Database::fetchAll(
            'SELECT * FROM ops_pitches WHERE tenant_id = ? ORDER BY date DESC',
            [$tenantId]
        );
        Response::success(array_map(fn($r) => $this->formatWithRoi($r, $tenantId), $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $pitch = Database::fetch(
            'SELECT * FROM ops_pitches WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$pitch) Response::error('Pitch not found', 404);

        $leads = Database::fetchAll(
            "SELECT c.id, c.name, c.stage, c.health, c.owner,
                    p.name AS project_name, p.quoted, p.received, p.payment_status
             FROM ops_clients c
             LEFT JOIN ops_projects p ON p.client_id = c.id AND p.tenant_id = c.tenant_id
             WHERE c.tenant_id = ? AND c.source_pitch_id = ?
             ORDER BY c.created_at DESC",
            [$tenantId, $id]
        );

        $data = $this->formatWithRoi($pitch, $tenantId);
        $data['leads'] = $leads;
        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $name     = trim((string)($body['name'] ?? ''));
        $date     = trim((string)($body['date'] ?? ''));

        if (!$name) Response::error('Event name is required', 422);
        if (!$date) Response::error('Date is required', 422);

        $spend = (float)($body['spend'] ?? 0);
        $validTypes = ['yes_meeting','business_forum','cold_outreach','referral_event','online','other'];

        $id = Database::insert('ops_pitches', [
            'tenant_id'   => $tenantId,
            'name'        => $name,
            'date'        => $date,
            'venue'       => trim((string)($body['venue'] ?? '')) ?: null,
            'city'        => trim((string)($body['city']  ?? '')) ?: null,
            'type'        => in_array($body['type'] ?? '', $validTypes) ? $body['type'] : 'yes_meeting',
            'spend'       => $spend,
            'description' => trim((string)($body['description'] ?? '')),
            'created_by'  => trim((string)($body['created_by']  ?? '')),
        ]);

        // Auto-create a Marketing expense for the spend
        if ($spend > 0) {
            Database::insert('ops_expenses', [
                'tenant_id'   => $tenantId,
                'category'    => 'pitch',
                'amount'      => $spend,
                'description' => "Pitch expense: {$name}",
                'pitch_id'    => $id,
                'date'        => $date,
                'added_by'    => $body['created_by'] ?? '',
            ]);
        }

        $row = Database::fetch('SELECT * FROM ops_pitches WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->formatWithRoi($row, $tenantId), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $pitch = Database::fetch(
            'SELECT * FROM ops_pitches WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$pitch) Response::error('Pitch not found', 404);

        $updates = [];
        foreach (['name','venue','city','description'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (!empty($body['date'])) $updates['date'] = $body['date'];
        if (isset($body['spend'])) {
            $updates['spend'] = (float)$body['spend'];
            // Update linked expense
            Database::query(
                'UPDATE ops_expenses SET amount = ? WHERE pitch_id = ? AND tenant_id = ?',
                [$updates['spend'], $id, $tenantId]
            );
        }
        $validTypes = ['yes_meeting','business_forum','cold_outreach','referral_event','online','other'];
        if (isset($body['type']) && in_array($body['type'], $validTypes)) $updates['type'] = $body['type'];

        if (!empty($updates)) {
            Database::update('ops_pitches', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM ops_pitches WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->formatWithRoi($row, $tenantId));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_pitches WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Pitch not found', 404);
        Database::query('DELETE FROM ops_pitches WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Deleted']);
    }

    private function formatWithRoi(array $row, int $tenantId): array
    {
        // Leads count = clients where source_pitch_id = this pitch
        $leadsCount = Database::fetch(
            'SELECT COUNT(*) AS cnt FROM ops_clients WHERE tenant_id = ? AND source_pitch_id = ?',
            [$tenantId, $row['id']]
        );

        // Converted = reached 'Advance Paid' or later stages
        $convertedStages = ['Advance Paid','Development','QA','Delivery','Full Payment','Closed'];
        $placeholders = implode(',', array_fill(0, count($convertedStages), '?'));
        $converted = Database::fetch(
            "SELECT COUNT(*) AS cnt FROM ops_clients
             WHERE tenant_id = ? AND source_pitch_id = ? AND stage IN ({$placeholders})",
            array_merge([$tenantId, $row['id']], $convertedStages)
        );

        // Revenue from conversions
        $revenue = Database::fetch(
            "SELECT COALESCE(SUM(p.quoted),0) AS total
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.tenant_id = ? AND c.source_pitch_id = ? AND c.stage IN ({$placeholders})",
            array_merge([$tenantId, $row['id']], $convertedStages)
        );

        $leadsN    = (int)($leadsCount['cnt']   ?? 0);
        $convN     = (int)($converted['cnt']    ?? 0);
        $revenueAmt = (float)($revenue['total'] ?? 0);
        $spend     = (float)$row['spend'];
        $roi       = $spend > 0 ? round(($revenueAmt - $spend) / $spend * 100, 1) : null;
        $convPct   = $leadsN > 0 ? round($convN / $leadsN * 100, 1) : 0;

        return [
            'id'           => (int)$row['id'],
            'name'         => $row['name'],
            'date'         => $row['date'],
            'venue'        => $row['venue'],
            'city'         => $row['city'],
            'type'         => $row['type'],
            'spend'        => $spend,
            'description'  => $row['description'],
            'created_by'   => $row['created_by'],
            'created_at'   => $row['created_at'],
            'leads_count'  => $leadsN,
            'converted'    => $convN,
            'conversion_pct' => $convPct,
            'revenue'      => $revenueAmt,
            'roi'          => $roi,
        ];
    }
}
