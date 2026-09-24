<?php
declare(strict_types=1);

/**
 * Global search — one request across every record type in the workspace.
 *
 *   GET /admin/search?q=...
 *
 * Answers the header's Ctrl-K palette. The palette also knows the page list on
 * its own, so this endpoint only deals in records: clients, projects, leads,
 * bugs, meetings, pitches and employees.
 *
 * Three rules it holds to:
 *
 *   1. A short query is refused rather than answered. One or two characters
 *      match most of the database, which is not a result — it is the whole
 *      table with the useful part hidden.
 *   2. Sales leads are record-scoped like everywhere else: a rep who cannot
 *      open a lead cannot find it here either.
 *   3. Every table is probed defensively. This installation carries a subset of
 *      the platform's tables, and a missing one must degrade to "no results in
 *      that group", never to a 500 that takes the whole palette down.
 */
class AdminGlobalSearchController
{
    /** Below this the answer is the whole table, so nothing is returned. */
    private const MIN_QUERY = 2;

    /** Per group. The palette is a shortlist, not a report. */
    private const LIMIT = 6;

    public function index(Request $request): void
    {
        $q = trim((string)$request->query('q', ''));
        if (mb_strlen($q) < self::MIN_QUERY) {
            Response::success(['groups' => [], 'query' => $q]);
        }

        $like     = '%' . $q . '%';
        $tenantId = Database::tenantId();
        $groups   = [];

        // ── Clients ─────────────────────────────────────────────────────────
        $rows = $this->safeFetch(
            "SELECT id, name, phone, email, stage, owner
               FROM ops_clients
              WHERE tenant_id = ? AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR owner LIKE ?)
              ORDER BY name ASC LIMIT " . self::LIMIT,
            [$tenantId, $like, $like, $like, $like]
        );
        $this->push($groups, 'clients', 'Clients', array_map(fn(array $r): array => [
            'id'       => (int)$r['id'],
            'title'    => (string)$r['name'],
            'subtitle' => trim(implode(' · ', array_filter([$r['phone'], $r['email']]))),
            'meta'     => (string)($r['stage'] ?? ''),
            'url'      => '/clients/' . (int)$r['id'],
        ], $rows));

        // ── Projects ────────────────────────────────────────────────────────
        $rows = $this->safeFetch(
            "SELECT p.id, p.name, p.stage, p.owner, p.balance, c.name AS client_name
               FROM ops_projects p
               LEFT JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
              WHERE p.tenant_id = ? AND (p.name LIKE ? OR p.owner LIKE ? OR c.name LIKE ?)
              ORDER BY p.name ASC LIMIT " . self::LIMIT,
            [$tenantId, $like, $like, $like]
        );
        $this->push($groups, 'projects', 'Projects', array_map(fn(array $r): array => [
            'id'       => (int)$r['id'],
            'title'    => (string)$r['name'],
            'subtitle' => trim((string)($r['client_name'] ?? '')),
            'meta'     => (string)($r['stage'] ?? ''),
            'url'      => '/projects/' . (int)$r['id'],
        ], $rows));

        // ── Sales leads — record-scoped, like every other sales read ────────
        if (SalesPermissions::has($request->user, 'sales.leads.view')) {
            $scope  = SalesPermissions::leadScope($request->user);
            $where  = 'tenant_id = ? AND (name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ? OR lead_code LIKE ?)';
            $params = [$tenantId, $like, $like, $like, $like, $like];
            if ($scope['sql'] !== '') {
                $where   .= ' AND assigned_to = ?';
                $params[] = $scope['params'][0];
            }
            $rows = $this->safeFetch(
                "SELECT id, lead_code, name, company, phone, status, temperature
                   FROM sales_leads
                  WHERE $where
                  ORDER BY updated_at DESC LIMIT " . self::LIMIT,
                $params
            );
            $this->push($groups, 'leads', 'Sales leads', array_map(fn(array $r): array => [
                'id'       => (int)$r['id'],
                'title'    => trim((string)($r['company'] !== '' ? $r['company'] : $r['name'])),
                'subtitle' => trim(implode(' · ', array_filter([$r['lead_code'], $r['name'], $r['phone']]))),
                'meta'     => (string)($r['status'] ?? ''),
                'url'      => '/sales/leads/' . (int)$r['id'],
            ], $rows));
        }

        // ── Bugs ────────────────────────────────────────────────────────────
        $rows = $this->safeFetch(
            "SELECT id, title, status, priority FROM ops_bugs
              WHERE tenant_id = ? AND title LIKE ?
              ORDER BY id DESC LIMIT " . self::LIMIT,
            [$tenantId, $like]
        );
        $this->push($groups, 'bugs', 'Bugs', array_map(fn(array $r): array => [
            'id'       => (int)$r['id'],
            'title'    => (string)$r['title'],
            'subtitle' => (string)($r['priority'] ?? ''),
            'meta'     => (string)($r['status'] ?? ''),
            'url'      => '/bugs/' . (int)$r['id'],
        ], $rows));

        // ── Pitches ─────────────────────────────────────────────────────────
        $rows = $this->safeFetch(
            "SELECT id, name, date FROM ops_pitches
              WHERE tenant_id = ? AND name LIKE ?
              ORDER BY date DESC LIMIT " . self::LIMIT,
            [$tenantId, $like]
        );
        $this->push($groups, 'pitches', 'Pitches', array_map(fn(array $r): array => [
            'id'       => (int)$r['id'],
            'title'    => (string)$r['name'],
            'subtitle' => '',
            'meta'     => (string)($r['date'] ?? ''),
            'url'      => '/pitches/' . (int)$r['id'],
        ], $rows));

        // ── Employees ───────────────────────────────────────────────────────
        $rows = $this->safeFetch(
            "SELECT employee_id AS id, name, designation, phone FROM employees
              WHERE tenant_id = ? AND (name LIKE ? OR designation LIKE ? OR phone LIKE ?)
              ORDER BY name ASC LIMIT " . self::LIMIT,
            [$tenantId, $like, $like, $like]
        );
        $this->push($groups, 'employees', 'Employees', array_map(fn(array $r): array => [
            'id'       => (int)$r['id'],
            'title'    => (string)$r['name'],
            'subtitle' => (string)($r['phone'] ?? ''),
            'meta'     => (string)($r['designation'] ?? ''),
            // No employee detail route — the list page filters on the query.
            'url'      => '/employees',
        ], $rows));

        Response::success(['groups' => array_values($groups), 'query' => $q]);
    }

    /**
     * A query whose table may not exist on this installation. The palette must
     * survive a missing table with an empty group, not a 500.
     */
    private function safeFetch(string $sql, array $params): array
    {
        try {
            return Database::fetchAll($sql, $params);
        } catch (Throwable $e) {
            error_log('[GlobalSearch] skipped a group: ' . $e->getMessage());
            return [];
        }
    }

    /** Empty groups are dropped rather than shipped as headings with nothing under them. */
    private function push(array &$groups, string $type, string $label, array $items): void
    {
        if ($items === []) {
            return;
        }
        $groups[] = ['type' => $type, 'label' => $label, 'items' => $items];
    }
}
