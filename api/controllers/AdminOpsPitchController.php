<?php
declare(strict_types=1);

/**
 * Ops Pitches & Marketing Controller
 * GET    /admin/ops/pitches            — list with ROI
 * GET    /admin/ops/pitches/{id}       — detail: the leads it brought, their quotes, revenue, ROI
 * POST   /admin/ops/pitches            — create
 * PUT    /admin/ops/pitches/{id}       — update
 * DELETE /admin/ops/pitches/{id}       — delete
 *
 * An event's leads are the sales leads and customers whose source is this
 * event (sales_leads.source_pitch_id, ops_clients.source_pitch_id — kept in
 * step, one person counted once). A lead is won when a quotation was accepted
 * or the customer has reached Quotation Accepted or later. Revenue is what the
 * won ones are worth: their projects' quoted price, or the accepted quotation
 * while there is no project yet. ROI = (revenue − spend) / spend.
 *
 * An event's spend is kept on the event only, for its ROI — it is not added to
 * Finance → Expenses (the money is recorded there by hand, once).
 */
class AdminOpsPitchController
{
    private const TYPES = ['yes_meeting','business_forum','cold_outreach','referral_event','online','other'];

    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $rows     = Database::fetchAll(
            'SELECT * FROM ops_pitches WHERE tenant_id = ? ORDER BY date DESC',
            [$tenantId]
        );
        Response::success(array_map(fn($r) => $this->format($r, $this->people($tenantId, (int)$r['id'])), $rows));
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

        $people = $this->people($tenantId, $id);
        $data = $this->format($pitch, $people);
        $data['leads'] = $people;
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
        $id = Database::insert('ops_pitches', [
            'tenant_id'   => $tenantId,
            'name'        => $name,
            'date'        => $date,
            'venue'       => trim((string)($body['venue'] ?? '')) ?: null,
            'city'        => trim((string)($body['city']  ?? '')) ?: null,
            'type'        => in_array($body['type'] ?? '', self::TYPES) ? $body['type'] : 'yes_meeting',
            'spend'       => $spend,
            'description' => trim((string)($body['description'] ?? '')),
            'created_by'  => trim((string)($body['created_by']  ?? '')) ?: (string)($request->user['name'] ?? ''),
        ]);

        $row = Database::fetch('SELECT * FROM ops_pitches WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row, []), 'Created', 201);
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
        if (isset($body['spend'])) $updates['spend'] = (float)$body['spend'];
        if (isset($body['type']) && in_array($body['type'], self::TYPES)) $updates['type'] = $body['type'];

        if (!empty($updates)) {
            Database::update('ops_pitches', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM ops_pitches WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row, $this->people($tenantId, $id)));
    }

    /**
     * Deletes the event. Its leads and customers stay, with their source text,
     * but no longer point at it. Expenses that named it stay, unlinked.
     */
    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_pitches WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Pitch not found', 404);

        Database::beginTransaction();
        try {
            Database::execute('UPDATE sales_leads SET source_pitch_id = NULL WHERE tenant_id = ? AND source_pitch_id = ?', [$tenantId, $id]);
            Database::execute('UPDATE ops_clients SET source_pitch_id = NULL WHERE tenant_id = ? AND source_pitch_id = ?', [$tenantId, $id]);
            Database::execute('UPDATE ops_expenses SET pitch_id = NULL WHERE tenant_id = ? AND pitch_id = ?', [$tenantId, $id]);
            Database::execute('DELETE FROM ops_pitches WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
        Response::success(['message' => 'Deleted']);
    }

    /**
     * Everyone the event brought, one row each: the lead (with its customer
     * once converted), or a customer with no lead behind it. Each row carries
     * its latest quotation, whether it was won, and what it is worth.
     */
    private function people(int $tenantId, int $pitchId): array
    {
        $leads = Database::fetchAll(
            "SELECT l.id, l.lead_code, l.name, l.company, l.status, l.converted_client_id, l.created_at,
                    u.name AS assigned_to_name
               FROM sales_leads l
               LEFT JOIN users u ON u.user_id = l.assigned_to
              WHERE l.tenant_id = ? AND l.source_pitch_id = ?
              ORDER BY l.id DESC",
            [$tenantId, $pitchId]
        );
        $leadClientIds = array_values(array_filter(array_map(fn($l) => (int)$l['converted_client_id'], $leads)));

        $clients = [];
        foreach (Database::fetchAll(
            'SELECT id, client_code, name, company, stage, created_at FROM ops_clients
              WHERE tenant_id = ? AND (source_pitch_id = ?' . ($leadClientIds ? ' OR id IN (' . implode(',', $leadClientIds) . ')' : '') . ')',
            [$tenantId, $pitchId]
        ) as $c) {
            $clients[(int)$c['id']] = $c;
        }

        $projects = [];
        if ($clients) {
            foreach (Database::fetchAll(
                'SELECT client_id, COUNT(*) AS n, COALESCE(SUM(quoted), 0) AS quoted, COALESCE(SUM(received), 0) AS received
                   FROM ops_projects WHERE tenant_id = ? AND client_id IN (' . implode(',', array_keys($clients)) . ')
                  GROUP BY client_id',
                [$tenantId]
            ) as $p) {
                $projects[(int)$p['client_id']] = $p;
            }
        }

        $quotes = [];
        if ($leads) {
            foreach (Database::fetchAll(
                'SELECT lead_id, version, amount, status FROM sales_quotations
                  WHERE tenant_id = ? AND lead_id IN (' . implode(',', array_map(fn($l) => (int)$l['id'], $leads)) . ')
                  ORDER BY lead_id, version',
                [$tenantId]
            ) as $q) {
                $quotes[(int)$q['lead_id']][] = $q;
            }
        }

        $stages    = AdminOpsClientController::STAGES;
        $wonStages = array_slice($stages, (int)array_search('Quotation Accepted', $stages, true));

        $row = function (?array $lead, ?array $client) use ($projects, $quotes, $wonStages): array {
            $rounds   = $lead ? ($quotes[(int)$lead['id']] ?? []) : [];
            $latest   = $rounds ? $rounds[count($rounds) - 1] : null;
            $accepted = null;
            foreach ($rounds as $q) if ($q['status'] === 'accepted') $accepted = $q;
            $proj     = $client ? ($projects[(int)$client['id']] ?? null) : null;
            $projectQuoted = $proj ? (float)$proj['quoted'] : 0.0;

            $won = $accepted !== null
                || ($lead && $lead['status'] === 'onboarding')
                || ($client && in_array($client['stage'], $wonStages, true));
            $lost = !$won && $lead && $lead['status'] === 'lost';

            $revenue = 0.0;
            $from = null;
            if ($won) {
                if ($projectQuoted > 0) { $revenue = $projectQuoted; $from = 'project'; }
                elseif ($accepted && $accepted['amount'] !== null) { $revenue = (float)$accepted['amount']; $from = 'quotation'; }
            }

            return [
                'lead_id'          => $lead ? (int)$lead['id'] : null,
                'lead_code'        => $lead['lead_code'] ?? null,
                'client_id'        => $client ? (int)$client['id'] : null,
                'client_code'      => $client['client_code'] ?? null,
                'name'             => $lead ? $lead['name'] : $client['name'],
                'company'          => ($lead['company'] ?? '') !== '' ? $lead['company'] : ($client['company'] ?? ''),
                'lead_status'      => $lead['status'] ?? null,
                'stage'            => $client['stage'] ?? null,
                'assigned_to_name' => $lead['assigned_to_name'] ?? null,
                'quotes'           => count($rounds),
                'quote_amount'     => $latest && $latest['amount'] !== null ? (float)$latest['amount'] : null,
                'quote_status'     => $latest['status'] ?? null,
                'quote_version'    => $latest ? (int)$latest['version'] : null,
                'projects'         => $proj ? (int)$proj['n'] : 0,
                'project_quoted'   => $projectQuoted,
                'received'         => $proj ? (float)$proj['received'] : 0.0,
                'won'              => $won,
                'lost'             => $lost,
                'revenue'          => $revenue,
                'revenue_from'     => $from,
                // A quotation still waiting for an answer: what may come in.
                'pipeline'         => !$won && !$lost && $latest && $latest['status'] === 'sent' ? (float)($latest['amount'] ?? 0) : 0.0,
                'created_at'       => $lead['created_at'] ?? $client['created_at'],
            ];
        };

        $out = [];
        $seen = [];
        foreach ($leads as $l) {
            $cid = (int)$l['converted_client_id'];
            $client = $cid && isset($clients[$cid]) ? $clients[$cid] : null;
            if ($client) $seen[$cid] = true;
            $out[] = $row($l, $client);
        }
        foreach ($clients as $cid => $c) {
            if (!isset($seen[$cid])) $out[] = $row(null, $c);
        }
        return $out;
    }

    private function format(array $row, array $people): array
    {
        $leadsN   = count($people);
        $won      = array_filter($people, fn($p) => $p['won']);
        $quoted   = array_filter($people, fn($p) => $p['quotes'] > 0);
        $convN    = count($won);
        $revenue  = array_sum(array_column($people, 'revenue'));
        $spend    = (float)$row['spend'];

        return [
            'id'             => (int)$row['id'],
            'name'           => $row['name'],
            'date'           => $row['date'],
            'venue'          => $row['venue'],
            'city'           => $row['city'],
            'type'           => $row['type'],
            'spend'          => $spend,
            'description'    => $row['description'],
            'created_by'     => $row['created_by'],
            'created_at'     => $row['created_at'],
            'leads_count'    => $leadsN,
            'quoted_count'   => count($quoted),
            // The latest quotation of each lead that got one.
            'quoted_value'   => array_sum(array_map(fn($p) => (float)($p['quote_amount'] ?? 0), $quoted)),
            'converted'      => $convN,
            'lost'           => count(array_filter($people, fn($p) => $p['lost'])),
            'conversion_pct' => $leadsN > 0 ? round($convN / $leadsN * 100, 1) : 0,
            'revenue'        => $revenue,
            'received'       => array_sum(array_column($people, 'received')),
            'pipeline'       => array_sum(array_column($people, 'pipeline')),
            'cost_per_lead'  => $leadsN > 0 ? round($spend / $leadsN, 2) : null,
            'roi'            => $spend > 0 ? round(($revenue - $spend) / $spend * 100, 1) : null,
        ];
    }
}
