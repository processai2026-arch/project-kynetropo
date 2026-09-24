<?php
declare(strict_types=1);

/**
 * Admin Dashboard Stats Controller
 * GET /admin/dashboard-stats — summary stats for admin dashboard
 */
class AdminDashboardController
{
    public function stats(Request $request): void
    {
        $tenantId = Database::tenantId();
        $today    = date('Y-m-d');

        $openTickets = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE tenant_id = ? AND status IN ('open','assigned')",
            [$tenantId]
        )['cnt'] ?? 0);

        $inProgressTickets = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE tenant_id = ? AND status = 'in_progress'",
            [$tenantId]
        )['cnt'] ?? 0);

        $pendingOrders = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM orders WHERE tenant_id = ? AND status IN ('pending','confirmed','processing')",
            [$tenantId]
        )['cnt'] ?? 0);

        $activeMachines = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM machines WHERE tenant_id = ? AND status = 'active'",
            [$tenantId]
        )['cnt'] ?? 0);

        $presentToday = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM attendance_logs WHERE tenant_id = ? AND date = ? AND status = 'present'",
            [$tenantId, $today]
        )['cnt'] ?? 0);

        $totalEmployees = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM employees WHERE tenant_id = ? AND status = 'active'",
            [$tenantId]
        )['cnt'] ?? 0);

        $recentTickets = Database::fetchAll(
            "SELECT t.id, t.ticket_number, t.title, t.priority, t.status, t.created_at,
                    c.name AS customer_name, m.machine_id AS machine_code
             FROM tickets t
             LEFT JOIN customers c ON c.id = t.customer_id
             LEFT JOIN machines m ON m.id = t.machine_id
             WHERE t.tenant_id = ?
             ORDER BY t.created_at DESC LIMIT 5",
            [$tenantId]
        );

        $recentOrders = Database::fetchAll(
            "SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
                    c.name AS customer_name
             FROM orders o
             LEFT JOIN customers c ON c.id = o.customer_id
             WHERE o.tenant_id = ?
             ORDER BY o.created_at DESC LIMIT 5",
            [$tenantId]
        );

        Response::success([
            'open_tickets'       => $openTickets,
            'in_progress_tickets'=> $inProgressTickets,
            'pending_orders'     => $pendingOrders,
            'active_machines'    => $activeMachines,
            'present_today'      => $presentToday,
            'total_employees'    => $totalEmployees,
            'recent_tickets'     => $recentTickets,
            'recent_orders'      => $recentOrders,
        ]);
    }
}
