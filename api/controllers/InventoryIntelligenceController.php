<?php
declare(strict_types=1);

class InventoryIntelligenceController
{
    /** GET /admin/inventory/intelligence/health-scores */
    public function getAllHealthScores(Request $request): void
    {
        $engine = new InventoryIntelligence();
        Response::success($engine->calculateAllHealthScores());
    }

    /** GET /admin/inventory/intelligence/health/{productId} */
    public function getProductHealth(Request $request): void
    {
        $productId = (int)$request->param('productId');
        if ($productId <= 0) {
            Response::error('Invalid product ID', 400);
        }
        if (InventoryProduct::findById($productId) === null) {
            Response::error('Product not found', 404);
        }

        $engine = new InventoryIntelligence();
        try {
            $result = $engine->calculateHealthScore($productId);
        } catch (Throwable $e) {
            error_log('Health score error: ' . $e->getMessage());
            Response::error('Could not calculate health score', 500);
        }

        Response::success($result);
    }

    /** GET /admin/inventory/intelligence/dead-stock?days=90 */
    public function getDeadStock(Request $request): void
    {
        $days = (int)$request->query('days', 90);
        if ($days <= 0) {
            $days = 90;
        }

        $engine = new InventoryIntelligence();
        Response::success($engine->detectDeadStock($days));
    }

    /** GET /admin/inventory/intelligence/dead-stock/value */
    public function getDeadStockValue(Request $request): void
    {
        $engine = new InventoryIntelligence();
        Response::success($engine->calculateDeadStockValue());
    }

    /** GET /admin/inventory/intelligence/runout */
    public function getAllRunouts(Request $request): void
    {
        $engine = new InventoryIntelligence();
        Response::success($engine->predictAllRunouts());
    }

    /** GET /admin/inventory/intelligence/runout/{productId} */
    public function getProductRunout(Request $request): void
    {
        $productId = (int)$request->param('productId');
        if ($productId <= 0) {
            Response::error('Invalid product ID', 400);
        }
        if (InventoryProduct::findById($productId) === null) {
            Response::error('Product not found', 404);
        }

        $engine = new InventoryIntelligence();
        try {
            $result = $engine->predictStockRunout($productId);
        } catch (Throwable $e) {
            error_log('Runout prediction error: ' . $e->getMessage());
            Response::error('Could not predict stock runout', 500);
        }

        Response::success($result);
    }

    /** GET /admin/inventory/intelligence/abnormal?days=7 */
    public function getAbnormalMovements(Request $request): void
    {
        $days = (int)$request->query('days', 7);
        if ($days <= 0) {
            $days = 7;
        }

        $engine = new InventoryIntelligence();
        Response::success($engine->detectAbnormalMovements($days));
    }

    /** GET /admin/inventory/intelligence/summary */
    public function getIntelligenceSummary(Request $request): void
    {
        $engine = new InventoryIntelligence();
        Response::success($engine->getSummary());
    }
}
