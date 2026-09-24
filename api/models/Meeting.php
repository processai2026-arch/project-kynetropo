<?php
declare(strict_types=1);

class Meeting
{
    public static function all(array $filters = []): array
    {
        $where = ['tenant_id = ?'];
        $params = [Database::tenantId()];

        // Filter by date range
        if (!empty($filters['from'])) {
            $where[] = 'date >= ?';
            $params[] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'date <= ?';
            $params[] = $filters['to'];
        }

        // Filter by attendee
        if (!empty($filters['attendee'])) {
            $where[] = 'JSON_CONTAINS(attendees, ?, "$")';
            $params[] = json_encode($filters['attendee']);
        }

        $sql = 'SELECT * FROM meetings WHERE ' . implode(' AND ', $where) . ' ORDER BY meeting_id ASC';

        return Database::fetchAll($sql, $params);
    }

    public static function upcoming(int $limit = 10): array
    {
        return Database::fetchAll(
            'SELECT * FROM meetings WHERE date >= CURDATE() AND tenant_id = ? ORDER BY date ASC, time ASC LIMIT ?',
            [Database::tenantId(), $limit]
        );
    }

    public static function findById(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM meetings WHERE meeting_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('meetings', [
            'title'        => $data['title'],
            'date'         => $data['date'],
            'time'         => $data['time'],
            'location'     => $data['location'] ?? null,
            'agenda'       => $data['agenda'] ?? null,
            'notes'        => $data['notes'] ?? null,
            'attendees'    => json_encode($data['attendees'] ?? []),
            'raci'         => json_encode($data['raci'] ?? []),
            'action_items' => json_encode($data['action_items'] ?? []),
            'created_by'   => $data['created_by'] ?? null,
            'created_at'   => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];

        $fieldMap = [
            'title' => 'title',
            'date' => 'date',
            'time' => 'time',
            'location' => 'location',
            'agenda' => 'agenda',
            'notes' => 'notes',
        ];

        foreach ($fieldMap as $key => $col) {
            if (array_key_exists($key, $data)) {
                $fields[] = "$col = ?";
                $params[] = $data[$key];
            }
        }

        // Handle JSON fields
        if (array_key_exists('attendees', $data)) {
            $fields[] = 'attendees = ?';
            $params[] = json_encode($data['attendees']);
        }
        if (array_key_exists('raci', $data)) {
            $fields[] = 'raci = ?';
            $params[] = json_encode($data['raci']);
        }
        if (array_key_exists('action_items', $data)) {
            $fields[] = 'action_items = ?';
            $params[] = json_encode($data['action_items']);
        }

        if (empty($fields)) {
            return;
        }

        $fields[] = 'updated_at = NOW()';
        $params[] = $id;
        $params[] = Database::tenantId();

        Database::execute(
            'UPDATE meetings SET ' . implode(', ', $fields) . ' WHERE meeting_id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM meetings WHERE meeting_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function format(array $row): array
    {
        return [
            'id' => (string)$row['meeting_id'],
            'meeting_id' => (int)$row['meeting_id'],
            'title' => $row['title'],
            'date' => $row['date'],
            'time' => substr($row['time'], 0, 5), // HH:MM format
            'location' => $row['location'] ?? '',
            'agenda' => $row['agenda'] ?? '',
            'notes' => $row['notes'] ?? '',
            'attendees' => json_decode($row['attendees'] ?? '[]', true),
            'raci' => json_decode($row['raci'] ?? '[]', true),
            'action_items' => json_decode($row['action_items'] ?? '[]', true),
            'actionItems' => json_decode($row['action_items'] ?? '[]', true), // For backward compatibility
            'created_by' => $row['created_by'] ? (int)$row['created_by'] : null,
            'created_at' => $row['created_at'],
            'createdAt' => $row['created_at'], // For backward compatibility
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}