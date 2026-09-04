<?php
declare(strict_types=1);

/**
 * Serves the report catalogue and runs one report at a time.
 *
 * The request never supplies SQL, a table, a column or an order. It supplies a
 * report id, which either names a definition in ReportRegistry or does not run
 * at all, plus an optional date range that is bound as parameters. Everything
 * else about the query is fixed in code.
 *
 * Not to be confused with AdminReportsController, which serves the inventory
 * and stock reports under /admin/reports. This one lives under /admin/ops/reports
 * with the rest of the client-and-project module, so the two never collide --
 * they did on the first attempt, and the older route quietly won.
 */
final class AdminOpsReportController
{
    /** Hard ceiling on a single response, whatever the caller asks for. */
    private const MAX_ROWS = 5000;

    /** The catalogue the Reports page renders as cards. */
    public function index(Request $request): void
    {
        Response::success(['reports' => ReportRegistry::catalogue()]);
    }

    /** One report's rows, with its own definition alongside so the viewer can render it. */
    public function show(Request $request): void
    {
        $id  = (string)$request->param('id');
        $def = ReportRegistry::find($id);
        if (!$def) {
            Response::error('No such report', 404);
        }

        $params = [Database::tenantId()];
        $where  = '';

        // The range applies only where the report has a date worth filtering on.
        $from = trim((string)$request->query('from', ''));
        $to   = trim((string)$request->query('to', ''));
        if (!empty($def['date_column'])) {
            if ($from !== '' && $this->isDate($from)) {
                $where   .= ' AND ' . $def['date_column'] . ' >= ?';
                $params[] = $from;
            }
            if ($to !== '' && $this->isDate($to)) {
                // Inclusive of the end date even when the column carries a time.
                $where   .= ' AND ' . $def['date_column'] . ' <= ?';
                $params[] = $to . ' 23:59:59';
            }
        }

        $limit = (int)$request->query('limit', 1000);
        $limit = max(1, min(self::MAX_ROWS, $limit));

        $sql = $def['sql'] . $where;
        if (!empty($def['group'])) { $sql .= ' GROUP BY ' . $def['group']; }
        if (!empty($def['order'])) { $sql .= ' ORDER BY ' . $def['order']; }
        $sql .= ' LIMIT ' . $limit;

        try {
            $rows = Database::fetchAll($sql, $params);
        } catch (\Throwable $e) {
            // A report whose table this deployment has not created should say so
            // rather than returning a bare 500 the page cannot explain.
            error_log('[Report] ' . $id . ' failed: ' . $e->getMessage());
            Response::error('This report could not be run against this database', 422);
            return;
        }

        Response::success([
            'report' => [
                'id'          => $id,
                'title'       => $def['title'],
                'category'    => $def['category'],
                'description' => $def['description'],
                'columns'     => $def['columns'],
                'has_dates'   => !empty($def['date_column']),
            ],
            'rows'      => $rows,
            'row_count' => count($rows),
            'truncated' => count($rows) >= $limit,
            'range'     => ['from' => $from ?: null, 'to' => $to ?: null],
        ]);
    }

    private function isDate(string $value): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
        [$y, $m, $d] = array_map('intval', explode('-', $value));
        return checkdate($m, $d, $y);
    }
}
