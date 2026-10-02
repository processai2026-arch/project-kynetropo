<?php
declare(strict_types=1);

/**
 * AMC payments to chase: due within 30 days, or overdue. The dashboard's
 * "AMC due" list and the notification bell both read this.
 */
final class OpsAmcAlerts
{
    public const DAYS_AHEAD = 30;

    public static function due(int $tenantId): array
    {
        $rows = Database::fetchAll(
            "SELECT a.id, a.client_id, a.project_id, a.amount, a.term_paid, a.first_year_free,
                    c.name AS client_name, p.name AS project_name,
                    IF(a.term_paid, a.renewal_date, a.start_date) AS due_date,
                    DATEDIFF(IF(a.term_paid, a.renewal_date, a.start_date), CURDATE()) AS days_until_due
               FROM ops_amc_records a
               JOIN ops_clients  c ON c.id = a.client_id  AND c.tenant_id = a.tenant_id
               JOIN ops_projects p ON p.id = a.project_id AND p.tenant_id = a.tenant_id
              WHERE a.tenant_id = ? AND IF(a.term_paid, a.renewal_date, a.start_date) <= CURDATE() + INTERVAL " . self::DAYS_AHEAD . " DAY
              ORDER BY due_date, a.id",
            [$tenantId]
        );
        foreach ($rows as &$r) {
            foreach (['id', 'client_id', 'project_id', 'term_paid', 'first_year_free', 'days_until_due'] as $k) $r[$k] = (int)$r[$k];
            $r['amount'] = (float)$r['amount'];
        }
        unset($r);
        return $rows;
    }
}
