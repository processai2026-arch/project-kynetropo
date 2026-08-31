<?php
declare(strict_types=1);

/**
 * Component Library (Operations module).
 * Predefined spec components the Quotation Builder reuses across line items.
 * All queries are tenant-scoped.
 *
 *  GET    /admin/quotation-components        index
 *  POST   /admin/quotation-components        store
 *  POST   /admin/quotation-components/bulk   bulkStore
 *  DELETE /admin/quotation-components/{id}   destroy
 */
class AdminQuotationComponentController
{
    public function index(Request $request): void
    {
        $tid = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT component_id, name, make, default_unit, default_qty, category
             FROM component_library WHERE tenant_id = ? ORDER BY category, name',
            [$tid]
        );
        Response::success($rows, 'Components');
    }

    public function store(Request $request): void
    {
        $tid = Database::tenantId();

        $name = trim((string) $request->input('name', ''));
        if ($name === '') {
            Response::error('Component name is required', 422);
        }
        $make = trim((string) $request->input('make', ''));

        $existing = $this->findDuplicate($tid, $name, $make);
        if ($existing) {
            Response::success($existing, 'Component exists', 200);
        }

        $componentId = Database::insertTenant('component_library', [
            'name'         => $name,
            'make'         => $make !== '' ? $make : null,
            'default_unit' => trim((string) $request->input('default_unit', '')) ?: null,
            'default_qty'  => $this->normalizeQty($request->input('default_qty')),
            'category'     => trim((string) $request->input('category', '')) ?: null,
        ]);

        $row = Database::fetch(
            'SELECT component_id, name, make, default_unit, default_qty, category
             FROM component_library WHERE component_id = ? AND tenant_id = ?',
            [$componentId, $tid]
        );
        Response::success($row, 'Component created', 201);
    }

    public function bulkStore(Request $request): void
    {
        $tid = Database::tenantId();

        $components = $request->input('components');
        if (is_array($components)) {
            foreach ($components as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $name = trim((string) ($c['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $make = trim((string) ($c['make'] ?? ''));

                if ($this->findDuplicate($tid, $name, $make)) {
                    continue;
                }

                Database::insertTenant('component_library', [
                    'name'         => $name,
                    'make'         => $make !== '' ? $make : null,
                    'default_unit' => trim((string) ($c['default_unit'] ?? '')) ?: null,
                    'default_qty'  => $this->normalizeQty($c['default_qty'] ?? null),
                    'category'     => trim((string) ($c['category'] ?? '')) ?: null,
                ]);
            }
        }

        $rows = Database::fetchAll(
            'SELECT component_id, name, make, default_unit, default_qty, category
             FROM component_library WHERE tenant_id = ? ORDER BY category, name',
            [$tid]
        );
        Response::success($rows, 'Components synced');
    }

    public function destroy(Request $request): void
    {
        $id  = (int) $request->param('id');
        $tid = Database::tenantId();

        $existing = Database::fetch(
            'SELECT component_id FROM component_library WHERE component_id = ? AND tenant_id = ?',
            [$id, $tid]
        );
        if (!$existing) {
            Response::error('Component not found', 404);
        }

        Database::execute('DELETE FROM component_library WHERE component_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(['component_id' => $id], 'Deleted');
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** Case-insensitive dedup on (name, make) within the tenant. */
    private function findDuplicate(int $tid, string $name, string $make): ?array
    {
        return Database::fetch(
            'SELECT component_id, name, make, default_unit, default_qty, category
             FROM component_library
             WHERE tenant_id = ? AND LOWER(name) = LOWER(?)
               AND LOWER(COALESCE(make, "")) = LOWER(?)
             LIMIT 1',
            [$tid, $name, $make]
        ) ?: null;
    }

    private function normalizeQty($value): float
    {
        if ($value === null || $value === '') {
            return 1.0;
        }
        return (float) $value;
    }
}
