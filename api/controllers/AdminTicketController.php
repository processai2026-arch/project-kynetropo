<?php
declare(strict_types=1);

/**
 * Admin Ticket Controller
 * GET    /admin/tickets               — list tickets (filters: status, priority, customer_id, employee_id)
 * GET    /admin/tickets/{id}          — single ticket with notes
 * POST   /admin/tickets              — create ticket
 * PUT    /admin/tickets/{id}          — update ticket (status, assignment, notes)
 * DELETE /admin/tickets/{id}          — close/delete ticket
 * GET    /admin/tickets/{id}/notes    — get ticket notes
 * POST   /admin/tickets/{id}/notes    — add note to ticket
 * POST   /admin/tickets/{id}/assign   — assign ticket to employee
 */
class AdminTicketController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $sql    = "SELECT t.*,
                     m.machine_id AS machine_code, m.model AS machine_model,
                     c.name AS customer_name,
                     e.name AS employee_name
                   FROM tickets t
                   LEFT JOIN machines m  ON m.id = t.machine_id
                   LEFT JOIN customers c ON c.id = t.customer_id
                   LEFT JOIN employees e ON e.id = t.assigned_employee_id
                   WHERE t.tenant_id = ?";
        $params = [$tenantId];

        if ($s = $request->query('status')) {
            $sql .= ' AND t.status = ?'; $params[] = $s;
        }
        if ($p = $request->query('priority')) {
            $sql .= ' AND t.priority = ?'; $params[] = $p;
        }
        if ($c = $request->query('customer_id')) {
            $sql .= ' AND t.customer_id = ?'; $params[] = (int)$c;
        }
        if ($e = $request->query('employee_id')) {
            $sql .= ' AND t.assigned_employee_id = ?'; $params[] = (int)$e;
        }
        if ($q = $request->query('search')) {
            $sql .= ' AND (t.ticket_number LIKE ? OR t.title LIKE ? OR c.name LIKE ?)';
            $like = '%'.$q.'%'; $params[] = $like; $params[] = $like; $params[] = $like;
        }

        $sql .= ' ORDER BY t.created_at DESC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $row = Database::fetch(
            "SELECT t.*,
               m.machine_id AS machine_code, m.model AS machine_model,
               c.name AS customer_name,
               e.name AS employee_name
             FROM tickets t
             LEFT JOIN machines m  ON m.id = t.machine_id
             LEFT JOIN customers c ON c.id = t.customer_id
             LEFT JOIN employees e ON e.id = t.assigned_employee_id
             WHERE t.id = ? AND t.tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$row) Response::error('Ticket not found', 404);

        $notes = Database::fetchAll(
            'SELECT * FROM ticket_notes WHERE ticket_id = ? ORDER BY created_at ASC',
            [$id]
        );

        $data          = $this->format($row);
        $data['notes'] = $notes;
        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $machineId = (int)($body['machine_id'] ?? 0);
        $title     = trim((string)($body['title'] ?? ''));

        if (!$machineId) Response::error('Machine is required', 422);
        if (!$title)     Response::error('Title is required', 422);

        $machine = Database::fetch(
            'SELECT id, customer_id FROM machines WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$machineId, $tenantId]
        );
        if (!$machine) Response::error('Machine not found', 404);

        // Auto-derive customer from machine
        $customerId = (int)$machine['customer_id'];

        $ticketNumber = $this->nextTicketNumber($tenantId);

        $id = Database::insert('tickets', [
            'tenant_id'   => $tenantId,
            'ticket_number' => $ticketNumber,
            'machine_id'  => $machineId,
            'customer_id' => $customerId,
            'title'       => $title,
            'description' => trim((string)($body['description'] ?? '')),
            'priority'    => in_array($body['priority'] ?? '', ['low','medium','high','urgent']) ? $body['priority'] : 'medium',
            'status'      => 'open',
            'raised_by'   => in_array($body['raised_by'] ?? '', ['customer','admin']) ? $body['raised_by'] : 'admin',
        ]);

        $row = Database::fetch(
            "SELECT t.*, m.machine_id AS machine_code, m.model AS machine_model,
               c.name AS customer_name, e.name AS employee_name
             FROM tickets t
             LEFT JOIN machines m  ON m.id = t.machine_id
             LEFT JOIN customers c ON c.id = t.customer_id
             LEFT JOIN employees e ON e.id = t.assigned_employee_id
             WHERE t.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $ticket = Database::fetch(
            'SELECT * FROM tickets WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$ticket) Response::error('Ticket not found', 404);

        $updates = [];

        if (isset($body['title']))            $updates['title']            = trim((string)$body['title']);
        if (isset($body['description']))      $updates['description']      = trim((string)$body['description']);
        if (isset($body['work_notes']))       $updates['work_notes']       = trim((string)$body['work_notes']);
        if (isset($body['resolution_notes'])) $updates['resolution_notes'] = trim((string)$body['resolution_notes']);
        if (isset($body['priority']) && in_array($body['priority'], ['low','medium','high','urgent'])) {
            $updates['priority'] = $body['priority'];
        }

        if (isset($body['status']) && in_array($body['status'], ['open','assigned','in_progress','resolved','closed'])) {
            $newStatus = $body['status'];
            $updates['status'] = $newStatus;
            if ($newStatus === 'in_progress' && !$ticket['started_at']) {
                $updates['started_at'] = date('Y-m-d H:i:s');
            }
            if ($newStatus === 'resolved' && !$ticket['resolved_at']) {
                $updates['resolved_at'] = date('Y-m-d H:i:s');
            }
            if ($newStatus === 'closed' && !$ticket['closed_at']) {
                $updates['closed_at'] = date('Y-m-d H:i:s');
            }
        }

        if (isset($body['assigned_employee_id'])) {
            $empId = (int)$body['assigned_employee_id'];
            if ($empId > 0) {
                $emp = Database::fetch('SELECT id FROM employees WHERE id = ? AND tenant_id = ? LIMIT 1', [$empId, $tenantId]);
                if (!$emp) Response::error('Employee not found', 404);
                $updates['assigned_employee_id'] = $empId;
                $updates['assigned_at']           = date('Y-m-d H:i:s');
                if (($updates['status'] ?? $ticket['status']) === 'open') {
                    $updates['status'] = 'assigned';
                }
            } else {
                $updates['assigned_employee_id'] = null;
            }
        }

        if (!empty($updates)) {
            Database::update('tickets', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch(
            "SELECT t.*, m.machine_id AS machine_code, m.model AS machine_model,
               c.name AS customer_name, e.name AS employee_name
             FROM tickets t
             LEFT JOIN machines m  ON m.id = t.machine_id
             LEFT JOIN customers c ON c.id = t.customer_id
             LEFT JOIN employees e ON e.id = t.assigned_employee_id
             WHERE t.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $ticket = Database::fetch(
            'SELECT id FROM tickets WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$ticket) Response::error('Ticket not found', 404);

        Database::update('tickets', ['status' => 'closed', 'closed_at' => date('Y-m-d H:i:s')], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Ticket closed']);
    }

    public function notes(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $ticket = Database::fetch('SELECT id FROM tickets WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$ticket) Response::error('Ticket not found', 404);

        $rows = Database::fetchAll('SELECT * FROM ticket_notes WHERE ticket_id = ? ORDER BY created_at ASC', [$id]);
        Response::success($rows);
    }

    public function addNote(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $ticket = Database::fetch('SELECT id FROM tickets WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$ticket) Response::error('Ticket not found', 404);

        $note = trim((string)($body['note'] ?? ''));
        if (!$note) Response::error('Note is required', 422);

        $noteId = Database::insert('ticket_notes', [
            'tenant_id'   => $tenantId,
            'ticket_id'   => $id,
            'author_name' => trim((string)($body['author_name'] ?? 'Admin')),
            'author_role' => in_array($body['author_role'] ?? '', ['admin','customer','employee']) ? $body['author_role'] : 'admin',
            'note'        => $note,
        ]);

        $row = Database::fetch('SELECT * FROM ticket_notes WHERE id = ? LIMIT 1', [$noteId]);
        Response::success($row, 'Created', 201);
    }

    private function nextTicketNumber(int $tenantId): string
    {
        $last = Database::fetch(
            "SELECT ticket_number FROM tickets WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
            [$tenantId]
        );
        if ($last) {
            preg_match('/(\d+)$/', $last['ticket_number'], $m);
            $num = isset($m[1]) ? (int)$m[1] + 1 : 1;
        } else {
            $num = 1;
        }
        return 'TKT-' . str_pad((string)$num, 4, '0', STR_PAD_LEFT);
    }

    private function format(array $row): array
    {
        return [
            'id'                   => (int)$row['id'],
            'ticket_number'        => $row['ticket_number'],
            'machine_id'           => (int)$row['machine_id'],
            'machine_code'         => $row['machine_code']  ?? null,
            'machine_model'        => $row['machine_model'] ?? null,
            'customer_id'          => (int)$row['customer_id'],
            'customer_name'        => $row['customer_name'] ?? null,
            'assigned_employee_id' => $row['assigned_employee_id'] ? (int)$row['assigned_employee_id'] : null,
            'employee_name'        => $row['employee_name'] ?? null,
            'title'                => $row['title'],
            'description'          => $row['description'],
            'priority'             => $row['priority'],
            'status'               => $row['status'],
            'raised_by'            => $row['raised_by'],
            'work_notes'           => $row['work_notes'],
            'resolution_notes'     => $row['resolution_notes'],
            'assigned_at'          => $row['assigned_at'],
            'started_at'           => $row['started_at'],
            'resolved_at'          => $row['resolved_at'],
            'closed_at'            => $row['closed_at'],
            'created_at'           => $row['created_at'],
        ];
    }
}
