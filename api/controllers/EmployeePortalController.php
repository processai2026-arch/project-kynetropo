<?php
declare(strict_types=1);

/**
 * Employee Portal Controller
 * All routes require 'employee' middleware (role=employee in JWT)
 *
 * GET  /employee/dashboard-stats      — summary for employee
 * GET  /employee/tickets              — assigned tickets
 * GET  /employee/tickets/{id}         — ticket detail
 * PUT  /employee/tickets/{id}         — update status + work_notes
 * POST /employee/tickets/{id}/notes   — add note
 * GET  /employee/attendance           — own attendance logs
 * POST /employee/attendance/check-in  — GPS or manual check-in
 * POST /employee/attendance/check-out — GPS or manual check-out
 * GET  /employee/attendance/today     — today's record
 */
class EmployeePortalController
{
    private function employeeId(Request $request): int
    {
        $userId   = $request->user['user_id'] ?? 0;
        $tenantId = Database::tenantId();
        $emp      = Database::fetch(
            'SELECT id FROM employees WHERE user_id = ? AND tenant_id = ? LIMIT 1',
            [$userId, $tenantId]
        );
        if (!$emp) Response::error('Employee account not found', 403);
        return (int)$emp['id'];
    }

    public function dashboardStats(Request $request): void
    {
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();
        $today      = date('Y-m-d');

        $assigned = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE assigned_employee_id = ? AND tenant_id = ? AND status IN ('assigned','in_progress')",
            [$employeeId, $tenantId]
        )['cnt'] ?? 0);

        $resolvedToday = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE assigned_employee_id = ? AND tenant_id = ? AND status = 'resolved' AND DATE(resolved_at) = ?",
            [$employeeId, $tenantId, $today]
        )['cnt'] ?? 0);

        $attendance = Database::fetch(
            'SELECT check_in_time, check_out_time, status FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1',
            [$employeeId, $today, $tenantId]
        );

        $todayTickets = Database::fetchAll(
            "SELECT t.id, t.ticket_number, t.title, t.priority, t.status,
                    m.machine_id AS machine_code, m.model AS machine_model, m.location_name,
                    c.name AS customer_name
             FROM tickets t
             LEFT JOIN machines m  ON m.id = t.machine_id
             LEFT JOIN customers c ON c.id = t.customer_id
             WHERE t.assigned_employee_id = ? AND t.tenant_id = ? AND t.status IN ('assigned','in_progress')
             ORDER BY t.priority DESC, t.created_at ASC",
            [$employeeId, $tenantId]
        );

        Response::success([
            'assigned_tickets'  => $assigned,
            'resolved_today'    => $resolvedToday,
            'attendance_today'  => $attendance,
            'today_tickets'     => $todayTickets,
        ]);
    }

    public function tickets(Request $request): void
    {
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();

        $sql    = "SELECT t.*,
                     m.machine_id AS machine_code, m.model AS machine_model, m.location_name,
                     c.name AS customer_name, c.address AS customer_address
                   FROM tickets t
                   LEFT JOIN machines m  ON m.id = t.machine_id
                   LEFT JOIN customers c ON c.id = t.customer_id
                   WHERE t.assigned_employee_id = ? AND t.tenant_id = ?";
        $params = [$employeeId, $tenantId];

        if ($s = $request->query('status')) { $sql .= ' AND t.status = ?'; $params[] = $s; }
        $sql .= ' ORDER BY t.priority DESC, t.created_at ASC';
        $rows  = Database::fetchAll($sql, $params);
        Response::success($rows);
    }

    public function showTicket(Request $request): void
    {
        $id         = (int) $request->param('id');
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();

        $row = Database::fetch(
            "SELECT t.*,
               m.machine_id AS machine_code, m.model AS machine_model, m.location_name, m.latitude, m.longitude,
               c.name AS customer_name, c.address AS customer_address, c.phone AS customer_phone
             FROM tickets t
             LEFT JOIN machines m  ON m.id = t.machine_id
             LEFT JOIN customers c ON c.id = t.customer_id
             WHERE t.id = ? AND t.assigned_employee_id = ? AND t.tenant_id = ? LIMIT 1",
            [$id, $employeeId, $tenantId]
        );
        if (!$row) Response::error('Ticket not found', 404);

        $row['notes'] = Database::fetchAll('SELECT * FROM ticket_notes WHERE ticket_id = ? ORDER BY created_at ASC', [$id]);
        Response::success($row);
    }

    public function updateTicket(Request $request): void
    {
        $id         = (int) $request->param('id');
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();
        $body       = $request->body();

        $ticket = Database::fetch(
            'SELECT * FROM tickets WHERE id = ? AND assigned_employee_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $employeeId, $tenantId]
        );
        if (!$ticket) Response::error('Ticket not found', 404);

        $updates = [];
        $allowedStatuses = ['in_progress', 'resolved'];

        if (isset($body['status']) && in_array($body['status'], $allowedStatuses)) {
            $newStatus = $body['status'];
            $updates['status'] = $newStatus;
            if ($newStatus === 'in_progress' && !$ticket['started_at']) {
                $updates['started_at'] = date('Y-m-d H:i:s');
            }
            if ($newStatus === 'resolved' && !$ticket['resolved_at']) {
                $updates['resolved_at'] = date('Y-m-d H:i:s');
            }
        }
        if (isset($body['work_notes']))       $updates['work_notes']       = trim((string)$body['work_notes']);
        if (isset($body['resolution_notes'])) $updates['resolution_notes'] = trim((string)$body['resolution_notes']);

        if (!empty($updates)) {
            Database::update('tickets', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch(
            "SELECT t.*, m.machine_id AS machine_code, m.model AS machine_model, m.location_name,
               c.name AS customer_name
             FROM tickets t
             LEFT JOIN machines m ON m.id = t.machine_id
             LEFT JOIN customers c ON c.id = t.customer_id
             WHERE t.id = ? LIMIT 1",
            [$id]
        );
        Response::success($row);
    }

    public function addTicketNote(Request $request): void
    {
        $id         = (int) $request->param('id');
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();
        $body       = $request->body();

        $ticket = Database::fetch(
            'SELECT id FROM tickets WHERE id = ? AND assigned_employee_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $employeeId, $tenantId]
        );
        if (!$ticket) Response::error('Ticket not found', 404);

        $note = trim((string)($body['note'] ?? ''));
        if (!$note) Response::error('Note is required', 422);

        $emp        = Database::fetch('SELECT name FROM employees WHERE id = ? LIMIT 1', [$employeeId]);
        $authorName = $emp['name'] ?? 'Employee';

        $noteId = Database::insert('ticket_notes', [
            'tenant_id'   => $tenantId,
            'ticket_id'   => $id,
            'author_name' => $authorName,
            'author_role' => 'employee',
            'note'        => $note,
        ]);

        $row = Database::fetch('SELECT * FROM ticket_notes WHERE id = ? LIMIT 1', [$noteId]);
        Response::success($row, 'Created', 201);
    }

    public function attendanceToday(Request $request): void
    {
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();
        $today      = date('Y-m-d');

        $row = Database::fetch(
            'SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1',
            [$employeeId, $today, $tenantId]
        );
        Response::success($row ?? (object)[]);
    }

    public function attendance(Request $request): void
    {
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();

        $sql    = 'SELECT * FROM attendance_logs WHERE employee_id = ? AND tenant_id = ?';
        $params = [$employeeId, $tenantId];
        if ($m = $request->query('month')) { $sql .= " AND DATE_FORMAT(date,'%Y-%m') = ?"; $params[] = $m; }
        $sql .= ' ORDER BY date DESC';
        $rows  = Database::fetchAll($sql, $params);
        Response::success($rows);
    }

    public function checkIn(Request $request): void
    {
        $body       = $request->body();
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();

        $today    = date('Y-m-d');
        $existing = Database::fetch(
            'SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1',
            [$employeeId, $today, $tenantId]
        );

        if ($existing && $existing['check_in_time']) Response::error('Already checked in today', 409);

        $lat     = isset($body['latitude'])  ? (float)$body['latitude']  : null;
        $lng     = isset($body['longitude']) ? (float)$body['longitude'] : null;
        $method  = 'manual';
        $locName = '';

        if ($lat !== null && $lng !== null) {
            $machines = Database::fetchAll(
                'SELECT machine_id, location_name, latitude, longitude, geofence_radius_m FROM machines WHERE tenant_id = ? AND status = \'active\' AND latitude IS NOT NULL',
                [$tenantId]
            );
            foreach ($machines as $m) {
                $dist = $this->haversine($lat, $lng, (float)$m['latitude'], (float)$m['longitude']);
                if ($dist <= (int)$m['geofence_radius_m']) {
                    $method  = 'gps_auto';
                    $locName = $m['location_name'] . ' (' . $m['machine_id'] . ')';
                    break;
                }
            }
        }

        $now = date('Y-m-d H:i:s');
        if ($existing) {
            Database::update('attendance_logs', ['check_in_time' => $now, 'check_in_lat' => $lat, 'check_in_lng' => $lng, 'location_name' => $locName, 'method' => $method, 'status' => 'present'], ['id' => $existing['id']]);
            $id = $existing['id'];
        } else {
            $id = Database::insert('attendance_logs', [
                'tenant_id' => $tenantId, 'employee_id' => $employeeId, 'date' => $today,
                'check_in_time' => $now, 'check_in_lat' => $lat, 'check_in_lng' => $lng,
                'location_name' => $locName, 'status' => 'present', 'method' => $method,
            ]);
        }

        $row = Database::fetch('SELECT * FROM attendance_logs WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function checkOut(Request $request): void
    {
        $body       = $request->body();
        $employeeId = $this->employeeId($request);
        $tenantId   = Database::tenantId();

        $today    = date('Y-m-d');
        $existing = Database::fetch(
            'SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1',
            [$employeeId, $today, $tenantId]
        );

        if (!$existing || !$existing['check_in_time']) Response::error('Not checked in today', 409);
        if ($existing['check_out_time'])               Response::error('Already checked out today', 409);

        $lat = isset($body['latitude'])  ? (float)$body['latitude']  : null;
        $lng = isset($body['longitude']) ? (float)$body['longitude'] : null;
        $now = date('Y-m-d H:i:s');
        $hrs = round((strtotime($now) - strtotime($existing['check_in_time'])) / 3600, 2);

        Database::update('attendance_logs', [
            'check_out_time' => $now, 'check_out_lat' => $lat, 'check_out_lng' => $lng, 'hours_worked' => $hrs,
        ], ['id' => $existing['id']]);

        $row = Database::fetch('SELECT * FROM attendance_logs WHERE id = ? LIMIT 1', [$existing['id']]);
        Response::success($row);
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371000;
        $p1 = deg2rad($lat1); $p2 = deg2rad($lat2);
        $dp = deg2rad($lat2 - $lat1); $dl = deg2rad($lng2 - $lng1);
        $a  = sin($dp / 2) ** 2 + cos($p1) * cos($p2) * sin($dl / 2) ** 2;
        return 2 * $R * asin(sqrt($a));
    }
}
