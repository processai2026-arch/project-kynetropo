<?php
declare(strict_types=1);

/**
 * SalesLead — the head of the sales lifecycle
 * (LEAD → CALL → FOLLOW-UP → MEETING → ONBOARDING → CUSTOMER).
 *
 * Conversion hands the customer to the existing project/DRP system by creating
 * an `ops_clients` record and storing the reference here; the sales history
 * (calls, follow-ups, meetings, timeline) is never deleted.
 */
class SalesLead
{
    public const STATUSES = [
        'new', 'contacted', 'qualified', 'meeting_scheduled',
        'proposal', 'onboarding', 'converted', 'lost',
    ];

    public const TEMPERATURES = ['hot', 'warm', 'cold'];

    public const SOURCES = [
        'website', 'referral', 'cold_call', 'email', 'social',
        'event', 'walk_in', 'partner', 'other',
    ];

    private const COLUMNS = [
        'name', 'company', 'contact_person', 'phone', 'email', 'source',
        'assigned_to', 'status', 'temperature', 'notes', 'acquired_on',
    ];

    // ── Reads ───────────────────────────────────────────────────────────────

    /**
     * @param array $filters search|temperature|status|assigned_to|converted|
     *                       followup_from|followup_to|created_from|created_to
     * @param array $scope   record-level restriction from SalesPermissions::leadScope()
     */
    public static function all(array $filters, array $scope, int $page = 1, int $limit = 50): array
    {
        $page  = max(1, $page);
        $limit = min(200, max(1, $limit));

        $where  = ['l.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($scope['sql'] !== '') {
            $where[] = ltrim(str_replace('assigned_to', 'l.assigned_to', $scope['sql']), ' AND');
            $params  = array_merge($params, $scope['params']);
        }

        if (!empty($filters['temperature']) && in_array($filters['temperature'], self::TEMPERATURES, true)) {
            $where[]  = 'l.temperature = ?';
            $params[] = $filters['temperature'];
        }
        if (!empty($filters['status']) && in_array($filters['status'], self::STATUSES, true)) {
            $where[]  = 'l.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['assigned_to'])) {
            $where[]  = 'l.assigned_to = ?';
            $params[] = (int)$filters['assigned_to'];
        }
        if (!empty($filters['source'])) {
            $where[]  = 'l.source = ?';
            $params[] = $filters['source'];
        }
        if (!empty($filters['followup_from'])) {
            $where[]  = 'DATE(l.next_followup_at) >= ?';
            $params[] = $filters['followup_from'];
        }
        if (!empty($filters['followup_to'])) {
            $where[]  = 'DATE(l.next_followup_at) <= ?';
            $params[] = $filters['followup_to'];
        }
        if (!empty($filters['meeting_from'])) {
            $where[]  = 'DATE(l.next_meeting_at) >= ?';
            $params[] = $filters['meeting_from'];
        }
        // "Leads received in August" means the day the client came in, not the
        // day the record was typed up. Rows with no acquired date fall back to
        // when they were entered, which for those rows is the same thing.
        if (!empty($filters['created_from'])) {
            $where[]  = 'COALESCE(l.acquired_on, DATE(l.created_at)) >= ?';
            $params[] = $filters['created_from'];
        }
        if (!empty($filters['created_to'])) {
            $where[]  = 'COALESCE(l.acquired_on, DATE(l.created_at)) <= ?';
            $params[] = $filters['created_to'];
        }
        if (!empty($filters['search'])) {
            $like     = '%' . trim((string)$filters['search']) . '%';
            $where[]  = '(l.name LIKE ? OR l.company LIKE ? OR l.contact_person LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.lead_code LIKE ?)';
            array_push($params, $like, $like, $like, $like, $like, $like);
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count(
            "SELECT COUNT(*) AS cnt FROM sales_leads l WHERE $whereClause",
            $params
        );

        $rows = Database::fetchAll(
            "SELECT l.*, u.name AS assigned_to_name
               FROM sales_leads l
               LEFT JOIN users u ON u.user_id = l.assigned_to
              WHERE $whereClause
              ORDER BY FIELD(l.temperature,'hot','warm','cold'),
                       (l.next_followup_at IS NULL), l.next_followup_at ASC,
                       l.created_at DESC
              LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows'       => array_map([self::class, 'format'], $rows),
            'pagination' => [
                'page'        => $page,
                'limit'       => $limit,
                'total'       => $total,
                'total_pages' => (int)ceil($total / max(1, $limit)),
            ],
        ];
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_leads WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT l.*, u.name AS assigned_to_name
               FROM sales_leads l
               LEFT JOIN users u ON u.user_id = l.assigned_to
              WHERE l.id = ? AND l.tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        return $row ? self::format($row) : null;
    }

    // ── Writes ──────────────────────────────────────────────────────────────

    public static function create(array $data, ?int $createdBy): int
    {
        $id = Database::insert('sales_leads', [
            'tenant_id'      => Database::tenantId(),
            'name'           => $data['name'],
            'company'        => (string)($data['company'] ?? ''),
            'contact_person' => (string)($data['contact_person'] ?? ''),
            'phone'          => (string)($data['phone'] ?? ''),
            'email'          => (string)($data['email'] ?? ''),
            'source'         => (string)($data['source'] ?? ''),
            'assigned_to'    => !empty($data['assigned_to']) ? (int)$data['assigned_to'] : null,
            'status'         => $data['status'] ?? 'new',
            'temperature'    => $data['temperature'] ?? 'warm',
            'notes'          => $data['notes'] ?? null,
            'acquired_on'    => $data['acquired_on'] ?? null,
            'last_activity_at' => date('Y-m-d H:i:s'),
            'created_by'     => $createdBy,
        ]);

        // Human-readable code, derived from the row id so it is always unique.
        Database::execute(
            'UPDATE sales_leads SET lead_code = ? WHERE id = ? AND tenant_id = ?',
            ['LD-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT), $id, Database::tenantId()]
        );

        return $id;
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];

        foreach (self::COLUMNS as $col) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $value = $data[$col];
            if ($col === 'assigned_to') {
                $value = !empty($value) ? (int)$value : null;
            }
            $fields[] = "`$col` = ?";
            $params[] = $value;
        }

        if (!$fields) {
            return;
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE sales_leads SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function touchActivity(int $id, ?string $outcome = null): void
    {
        if ($outcome !== null) {
            Database::execute(
                'UPDATE sales_leads SET last_activity_at = NOW(), last_outcome = ? WHERE id = ? AND tenant_id = ?',
                [$outcome, $id, Database::tenantId()]
            );
            return;
        }
        Database::execute(
            'UPDATE sales_leads SET last_activity_at = NOW() WHERE id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
    }

    /** Recomputes the denormalised next follow-up / next meeting pointers. */
    public static function refreshSchedule(int $id): void
    {
        $tenantId = Database::tenantId();

        $followup = Database::fetch(
            "SELECT due_date, due_time FROM sales_followups
              WHERE tenant_id = ? AND lead_id = ? AND status = 'pending'
              ORDER BY due_date ASC, (due_time IS NULL), due_time ASC LIMIT 1",
            [$tenantId, $id]
        );
        $meeting = Database::fetch(
            "SELECT meeting_date, meeting_time FROM sales_meetings
              WHERE tenant_id = ? AND lead_id = ? AND status = 'scheduled'
              ORDER BY meeting_date ASC, (meeting_time IS NULL), meeting_time ASC LIMIT 1",
            [$tenantId, $id]
        );

        Database::execute(
            'UPDATE sales_leads SET next_followup_at = ?, next_meeting_at = ? WHERE id = ? AND tenant_id = ?',
            [
                $followup ? self::combine($followup['due_date'], $followup['due_time']) : null,
                $meeting  ? self::combine($meeting['meeting_date'], $meeting['meeting_time']) : null,
                $id,
                $tenantId,
            ]
        );
    }

    /**
     * @param bool $createdClient true when the conversion created this customer,
     *   false when it linked to one that already existed. Undo reads this to
     *   decide whether the customer record is its to remove — the difference
     *   between undoing your own work and deleting somebody else's.
     */
    public static function markConverted(int $id, int $clientId, ?int $projectId, bool $createdClient = false): void
    {
        Database::execute(
            "UPDATE sales_leads
                SET status = 'converted', converted_client_id = ?, converted_project_id = ?,
                    converted_client_created = ?, converted_at = NOW()
              WHERE id = ? AND tenant_id = ?",
            [$clientId, $projectId, $createdClient ? 1 : 0, $id, Database::tenantId()]
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM sales_leads WHERE id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static function combine(?string $date, ?string $time): ?string
    {
        if (!$date) {
            return null;
        }
        return $date . ' ' . ($time ?: '00:00:00');
    }

    public static function format(array $row): array
    {
        return [
            'id'                   => (int)$row['id'],
            'lead_code'            => $row['lead_code'],
            'name'                 => $row['name'],
            'company'              => $row['company'],
            'contact_person'       => $row['contact_person'],
            'phone'                => $row['phone'],
            'email'                => $row['email'],
            'source'               => $row['source'],
            'assigned_to'          => $row['assigned_to'] !== null ? (int)$row['assigned_to'] : null,
            'assigned_to_name'     => $row['assigned_to_name'] ?? null,
            'status'               => $row['status'],
            'temperature'          => $row['temperature'],
            'next_followup_at'     => $row['next_followup_at'],
            'next_meeting_at'      => $row['next_meeting_at'],
            'last_activity_at'     => $row['last_activity_at'],
            'last_outcome'         => $row['last_outcome'],
            'notes'                => $row['notes'],
            // The day the client came in. Null means "the day it was entered",
            // which is what every lead recorded before this field existed says.
            'acquired_on'          => $row['acquired_on'] ?? null,
            'converted_client_id'  => $row['converted_client_id'] !== null ? (int)$row['converted_client_id'] : null,
            'converted_project_id' => $row['converted_project_id'] !== null ? (int)$row['converted_project_id'] : null,
            'converted_at'         => $row['converted_at'],
            'created_at'           => $row['created_at'],
            'updated_at'           => $row['updated_at'],
        ];
    }
}
