<?php
declare(strict_types=1);

/**
 * Admin Attendance Log Controller (GPS-based check-in/out)
 * GET    /admin/attendance            — list logs (filter: employee_id, date, month)
 * POST   /admin/attendance/check-in   — check employee in
 * POST   /admin/attendance/check-out  — check employee out
 * POST   /admin/attendance/manual     — admin manual entry
 * PUT    /admin/attendance/{id}        — admin correction
 */
class AdminAttendanceLogController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $sql    = 'SELECT a.*, e.name AS employee_name FROM attendance_logs a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.tenant_id = ?';
        $params = [$tenantId];

        if ($eid = $request->query('employee_id')) {
            $sql .= ' AND a.employee_id = ?'; $params[] = (int)$eid;
        }
        if ($date = $request->query('date')) {
            $sql .= ' AND a.date = ?'; $params[] = $date;
        }
        if ($month = $request->query('month')) {
            $sql .= ' AND DATE_FORMAT(a.date, \'%Y-%m\') = ?'; $params[] = $month;
        }
        if ($status = $request->query('status')) {
            $sql .= ' AND a.status = ?'; $params[] = $status;
        }

        $sql .= ' ORDER BY a.date DESC, a.employee_id ASC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    // POST /admin/attendance/check-in — employee check-in via API
    public function checkIn(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $employeeId = (int)($body['employee_id'] ?? ($request->user['employee_id'] ?? 0));
        if (!$employeeId) Response::error('Employee ID required', 422);

        $emp = Database::fetch('SELECT id FROM employees WHERE id = ? AND tenant_id = ? AND status = \'active\' LIMIT 1', [$employeeId, $tenantId]);
        if (!$emp) Response::error('Employee not found or inactive', 404);

        $today    = date('Y-m-d');
        $existing = Database::fetch('SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1', [$employeeId, $today, $tenantId]);

        if ($existing && $existing['check_in_time']) {
            Response::error('Already checked in today', 409);
        }

        $lat       = isset($body['latitude'])  ? (float)$body['latitude']  : null;
        $lng       = isset($body['longitude']) ? (float)$body['longitude'] : null;
        $method    = 'manual';
        $locName   = trim((string)($body['location_name'] ?? ''));

        // GPS auto-detect nearest machine
        if ($lat !== null && $lng !== null) {
            $machines = Database::fetchAll(
                'SELECT id, machine_id, location_name, latitude, longitude, geofence_radius_m FROM machines WHERE tenant_id = ? AND status = \'active\' AND latitude IS NOT NULL AND longitude IS NOT NULL',
                [$tenantId]
            );
            foreach ($machines as $m) {
                $dist = $this->haversineDistance($lat, $lng, (float)$m['latitude'], (float)$m['longitude']);
                if ($dist <= (int)$m['geofence_radius_m']) {
                    $method  = 'gps_auto';
                    $locName = $m['location_name'] . ' (' . $m['machine_id'] . ')';
                    break;
                }
            }
        }

        $now = date('Y-m-d H:i:s');
        if ($existing) {
            Database::update('attendance_logs', [
                'check_in_time' => $now,
                'check_in_lat'  => $lat,
                'check_in_lng'  => $lng,
                'location_name' => $locName,
                'method'        => $method,
                'status'        => 'present',
            ], ['id' => $existing['id']]);
            $id = $existing['id'];
        } else {
            $id = Database::insert('attendance_logs', [
                'tenant_id'     => $tenantId,
                'employee_id'   => $employeeId,
                'date'          => $today,
                'check_in_time' => $now,
                'check_in_lat'  => $lat,
                'check_in_lng'  => $lng,
                'location_name' => $locName,
                'status'        => 'present',
                'method'        => $method,
            ]);
        }

        $row = Database::fetch('SELECT a.*, e.name AS employee_name FROM attendance_logs a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    // POST /admin/attendance/check-out
    public function checkOut(Request $request): void
    {
        $body       = $request->body();
        $tenantId   = Database::tenantId();
        $employeeId = (int)($body['employee_id'] ?? ($request->user['employee_id'] ?? 0));
        if (!$employeeId) Response::error('Employee ID required', 422);

        $today    = date('Y-m-d');
        $existing = Database::fetch('SELECT * FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1', [$employeeId, $today, $tenantId]);

        if (!$existing || !$existing['check_in_time']) Response::error('Not checked in today', 409);
        if ($existing['check_out_time']) Response::error('Already checked out today', 409);

        $lat = isset($body['latitude'])  ? (float)$body['latitude']  : null;
        $lng = isset($body['longitude']) ? (float)$body['longitude'] : null;
        $now = date('Y-m-d H:i:s');

        $hoursWorked = null;
        if ($existing['check_in_time']) {
            $diff        = strtotime($now) - strtotime($existing['check_in_time']);
            $hoursWorked = round($diff / 3600, 2);
        }

        Database::update('attendance_logs', [
            'check_out_time' => $now,
            'check_out_lat'  => $lat,
            'check_out_lng'  => $lng,
            'hours_worked'   => $hoursWorked,
        ], ['id' => $existing['id']]);

        $row = Database::fetch('SELECT a.*, e.name AS employee_name FROM attendance_logs a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ? LIMIT 1', [$existing['id']]);
        Response::success($this->format($row));
    }

    // POST /admin/attendance/manual — admin creates/overrides entry
    public function manual(Request $request): void
    {
        $body       = $request->body();
        $tenantId   = Database::tenantId();
        $employeeId = (int)($body['employee_id'] ?? 0);
        $date       = $body['date'] ?? date('Y-m-d');

        if (!$employeeId) Response::error('Employee ID required', 422);

        $emp = Database::fetch('SELECT id FROM employees WHERE id = ? AND tenant_id = ? LIMIT 1', [$employeeId, $tenantId]);
        if (!$emp) Response::error('Employee not found', 404);

        $checkIn  = $body['check_in_time']  ?? null;
        $checkOut = $body['check_out_time'] ?? null;
        $status   = in_array($body['status'] ?? '', ['present','absent','half_day']) ? $body['status'] : 'present';

        $hoursWorked = null;
        if ($checkIn && $checkOut) {
            $diff        = strtotime($checkOut) - strtotime($checkIn);
            $hoursWorked = round($diff / 3600, 2);
        }

        $existing = Database::fetch('SELECT id FROM attendance_logs WHERE employee_id = ? AND date = ? AND tenant_id = ? LIMIT 1', [$employeeId, $date, $tenantId]);
        if ($existing) {
            Database::update('attendance_logs', [
                'check_in_time'  => $checkIn,
                'check_out_time' => $checkOut,
                'hours_worked'   => $hoursWorked,
                'status'         => $status,
                'method'         => 'manual',
                'notes'          => trim((string)($body['notes'] ?? '')),
            ], ['id' => $existing['id']]);
            $id = $existing['id'];
        } else {
            $id = Database::insert('attendance_logs', [
                'tenant_id'      => $tenantId,
                'employee_id'    => $employeeId,
                'date'           => $date,
                'check_in_time'  => $checkIn,
                'check_out_time' => $checkOut,
                'hours_worked'   => $hoursWorked,
                'status'         => $status,
                'method'         => 'manual',
                'notes'          => trim((string)($body['notes'] ?? '')),
            ]);
        }

        $row = Database::fetch('SELECT a.*, e.name AS employee_name FROM attendance_logs a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $log = Database::fetch('SELECT id FROM attendance_logs WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$log) Response::error('Attendance record not found', 404);

        $updates = [];
        if (isset($body['check_in_time']))  $updates['check_in_time']  = $body['check_in_time'];
        if (isset($body['check_out_time'])) $updates['check_out_time'] = $body['check_out_time'];
        if (isset($body['status']) && in_array($body['status'], ['present','absent','half_day'])) {
            $updates['status'] = $body['status'];
        }
        if (isset($body['notes'])) $updates['notes'] = trim((string)$body['notes']);

        if (isset($updates['check_in_time']) && isset($updates['check_out_time'])) {
            $diff = strtotime($updates['check_out_time']) - strtotime($updates['check_in_time']);
            $updates['hours_worked'] = round($diff / 3600, 2);
        }

        if (!empty($updates)) {
            Database::update('attendance_logs', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT a.*, e.name AS employee_name FROM attendance_logs a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R    = 6371000; // metres
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $dphi = deg2rad($lat2 - $lat1);
        $dlam = deg2rad($lng2 - $lng1);
        $a    = sin($dphi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dlam / 2) ** 2;
        return 2 * $R * asin(sqrt($a));
    }

    private function format(array $row): array
    {
        return [
            'id'             => (int)$row['id'],
            'employee_id'    => (int)$row['employee_id'],
            'employee_name'  => $row['employee_name'] ?? null,
            'date'           => $row['date'],
            'check_in_time'  => $row['check_in_time'],
            'check_in_lat'   => $row['check_in_lat']  !== null ? (float)$row['check_in_lat']  : null,
            'check_in_lng'   => $row['check_in_lng']  !== null ? (float)$row['check_in_lng']  : null,
            'check_out_time' => $row['check_out_time'],
            'check_out_lat'  => $row['check_out_lat'] !== null ? (float)$row['check_out_lat'] : null,
            'check_out_lng'  => $row['check_out_lng'] !== null ? (float)$row['check_out_lng'] : null,
            'location_name'  => $row['location_name'],
            'status'         => $row['status'],
            'hours_worked'   => $row['hours_worked'] !== null ? (float)$row['hours_worked'] : null,
            'method'         => $row['method'],
            'notes'          => $row['notes'],
            'created_at'     => $row['created_at'],
        ];
    }
}
