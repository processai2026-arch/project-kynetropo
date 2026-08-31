<?php
declare(strict_types=1);

class Task
{
    public const VALID_STATUSES   = ['Pending', 'In Progress', 'Completed', 'Blocked'];
    public const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

    public static function all(array $filters = []): array
    {
        $where  = ['tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], self::VALID_STATUSES, true)) {
            $where[]  = 'status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['assignee'])) {
            $where[]  = 'assignee_id = ?';
            $params[] = $filters['assignee'];
        }
        if (!empty($filters['priority']) && in_array($filters['priority'], self::VALID_PRIORITIES, true)) {
            $where[]  = 'priority = ?';
            $params[] = $filters['priority'];
        }
        if (!empty($filters['month']) && preg_match('/^\d{4}-\d{2}$/', (string)$filters['month'])) {
            $where[]  = "DATE_FORMAT(created_at, '%Y-%m') = ?";
            $params[] = $filters['month'];
        }

        return Database::fetchAll(
            'SELECT * FROM tasks WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC',
            $params
        );
    }

    public static function findByKey(string $key): ?array
    {
        return Database::fetch('SELECT * FROM tasks WHERE task_key = ? AND tenant_id = ? LIMIT 1', [$key, Database::tenantId()]);
    }

    public static function byEmployee(string $employeeKey): array
    {
        return Database::fetchAll(
            'SELECT * FROM tasks WHERE assignee_id = ? AND tenant_id = ? ORDER BY created_at DESC',
            [$employeeKey, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        $count   = Database::count('SELECT COUNT(*) AS cnt FROM tasks WHERE tenant_id = ?', [Database::tenantId()]);
        $taskKey = 'TSK-' . str_pad((string)($count + 1), 3, '0', STR_PAD_LEFT);

        $tags = $data['tags'] ?? [];
        if (!is_array($tags)) $tags = [];

        Database::insertTenant('tasks', [
            'task_key'    => $taskKey,
            'title'       => $data['title'],
            'description' => $data['description'] ?? '',
            'assignee_id' => $data['assigneeId'],
            'assigned_by' => $data['assignedBy'] ?? 'Admin',
            'priority'    => $data['priority']   ?? 'Medium',
            'status'      => $data['status']     ?? 'Pending',
            'due_date'    => $data['dueDate'],
            'tags'        => json_encode($tags),
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        // Return the generated task_key instead of task_id — callers identify tasks by key
        return $count + 1;
    }

    public static function format(array $row): array
    {
        return [
            'id'          => $row['task_key'],
            'title'       => $row['title'],
            'description' => $row['description'] ?? '',
            'assigneeId'  => $row['assignee_id'],
            'assignedBy'  => $row['assigned_by'],
            'priority'    => $row['priority'],
            'status'      => $row['status'],
            'dueDate'     => $row['due_date'],
            'tags'        => $row['tags'] ? json_decode($row['tags'], true) : [],
            'completedAt' => $row['completed_at'] ? date('c', strtotime($row['completed_at'])) : null,
            'createdAt'   => date('c', strtotime($row['created_at'])),
        ];
    }

    /** Fetch a task's comments in chronological order. */
    public static function comments(string $taskKey): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM task_comments WHERE task_key = ? AND tenant_id = ? ORDER BY created_at ASC',
            [$taskKey, Database::tenantId()]
        );
        return array_map(fn($c) => [
            'id'        => (int)$c['comment_id'],
            'author'    => $c['author'],
            'body'      => $c['body'],
            'createdAt' => date('c', strtotime($c['created_at'])),
        ], $rows);
    }
}
