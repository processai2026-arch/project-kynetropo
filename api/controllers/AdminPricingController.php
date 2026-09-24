<?php
declare(strict_types=1);

/**
 * Admin Pricing Controller — manages product_configurations (size-based pricing)
 *
 * GET    /admin/products/{id}/configurations          — list all configs for a product
 * POST   /admin/products/{id}/configurations          — add a new size/purpose/price config
 * PUT    /admin/products/{id}/configurations/{cid}   — update price, size, purpose, availability
 * DELETE /admin/products/{id}/configurations/{cid}   — delete a configuration
 * GET/POST /admin/price-lists                         — list/create reusable lists
 * GET/PUT/DELETE /admin/price-lists/{id}              — manage one list
 * PUT /admin/price-lists/{id}/items                   — replace products and tiers
 * GET /admin/pricing/resolve                          — resolve product/quantity/date price
 */
class AdminPricingController
{
    // ─── GET /admin/products/{id}/configurations ──────────────────────────────

    public function index(Request $request): void
    {
        $productId = (int)$request->param('id');
        if ($productId <= 0) {
            Response::error('Invalid product ID', 400);
        }

        $product = Product::findById($productId);
        if (!$product) {
            Response::error('Product not found', 404);
        }

        // Admin sees ALL configs (including unavailable) by default
        $isAvail = $request->query('is_available', 'all');
        $configs = Product::getConfigurations($productId, [
            'size'         => $request->query('size'),
            'purpose'      => $request->query('purpose'),
            'is_available' => $isAvail,
        ]);

        Response::success([
            'product'        => $product,
            'configurations' => $configs,
            'total'          => count($configs),
        ]);
    }

    // ─── POST /admin/products/{id}/configurations ─────────────────────────────

    public function store(Request $request): void
    {
        $productId = (int)$request->param('id');
        if ($productId <= 0) {
            Response::error('Invalid product ID', 400);
        }

        $product = Product::findById($productId);
        if (!$product) {
            Response::error('Product not found', 404);
        }

        Validator::make($request->only(['size', 'purpose', 'price']), [
            'size'    => 'required|string|max:50',
            'purpose' => 'required|string|max:100',
            'price'   => 'required|numeric',
        ])->validate();

        $size    = trim((string)$request->input('size'));
        $purpose = trim((string)$request->input('purpose'));
        $price   = (float)$request->input('price');

        if ($price <= 0) {
            Response::error('Price must be greater than 0', 400);
        }

        try {
            $configId = Product::createConfig($productId, $size, $purpose, $price);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }

        $config = Product::getConfigById($configId);
        Response::success($config, 'Configuration created successfully', 201);
    }

    // ─── PUT /admin/products/{id}/configurations/{cid} ───────────────────────

    public function update(Request $request): void
    {
        $productId = (int)$request->param('id');
        $configId  = (int)$request->param('cid');

        if ($productId <= 0 || $configId <= 0) {
            Response::error('Invalid product or configuration ID', 400);
        }

        $config = Product::getConfigById($configId);
        if (!$config || (int)$config['product_id'] !== $productId) {
            Response::error('Configuration not found for this product', 404);
        }

        $allowed = ['size', 'purpose', 'price', 'is_available'];
        $input   = $request->only($allowed);

        if (empty($input)) {
            Response::error('Provide at least one field to update (size, purpose, price, is_available)', 400);
        }

        Validator::make($input, [
            'size'    => 'string|max:50',
            'purpose' => 'string|max:100',
            'price'   => 'numeric',
        ])->validate();

        if (isset($input['price']) && (float)$input['price'] <= 0) {
            Response::error('Price must be greater than 0', 400);
        }

        try {
            Product::updateConfig($configId, $input);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }

        $updated = Product::getConfigById($configId);
        Response::success($updated, 'Configuration updated successfully');
    }

    // ─── DELETE /admin/products/{id}/configurations/{cid} ────────────────────

    public function destroy(Request $request): void
    {
        $productId = (int)$request->param('id');
        $configId  = (int)$request->param('cid');

        if ($productId <= 0 || $configId <= 0) {
            Response::error('Invalid product or configuration ID', 400);
        }

        $config = Product::getConfigById($configId);
        if (!$config || (int)$config['product_id'] !== $productId) {
            Response::error('Configuration not found for this product', 404);
        }

        Product::deleteConfig($configId);
        Response::success(null, 'Configuration deleted successfully');
    }

    // ─── Reusable price lists ────────────────────────────────────────────────

    public function priceLists(Request $request): void
    {
        $rows = Database::fetchAll(
            'SELECT pl.*,
                    (SELECT COUNT(*) FROM price_list_items pli
                     WHERE pli.price_list_id = pl.price_list_id AND pli.tenant_id = pl.tenant_id) AS product_count,
                    (SELECT COUNT(*) FROM price_list_quantity_tiers plt
                     JOIN price_list_items pli2 ON pli2.price_list_item_id = plt.price_list_item_id AND pli2.tenant_id = plt.tenant_id
                     WHERE pli2.price_list_id = pl.price_list_id AND plt.tenant_id = pl.tenant_id) AS tier_count
             FROM price_lists pl
             WHERE pl.tenant_id = ?
             ORDER BY pl.is_active DESC, pl.priority DESC, pl.effective_from DESC, pl.name',
            [Database::tenantId()]
        );
        foreach ($rows as &$row) $row['is_active'] = (bool)$row['is_active'];
        unset($row);
        Response::success(['price_lists' => $rows, 'total' => count($rows)]);
    }

    public function showPriceList(Request $request): void
    {
        Response::success($this->priceListPayload($this->requirePriceListId($request)));
    }

    public function storePriceList(Request $request): void
    {
        $data = $this->validatePriceList($request, true);
        $items = $request->input('items', []);
        if (!is_array($items)) Response::error('items must be an array', 400);
        $items = $this->normalisePriceListItems($items);

        Database::beginTransaction();
        try {
            $priceListId = Database::insertTenant('price_lists', $data + [
                'created_by' => isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            $this->replacePriceListItems($priceListId, $items);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
        Response::success($this->priceListPayload($priceListId), 'Price list created successfully', 201);
    }

    public function updatePriceList(Request $request): void
    {
        $priceListId = $this->requirePriceListId($request);
        $data = $this->validatePriceList($request, false);
        if ($data === []) Response::error('Provide at least one price-list field', 400);
        $current = Database::fetch(
            'SELECT effective_from, effective_to FROM price_lists WHERE price_list_id = ? AND tenant_id = ?',
            [$priceListId, Database::tenantId()]
        );
        $effectiveFrom = $data['effective_from'] ?? $current['effective_from'];
        $effectiveTo = array_key_exists('effective_to', $data) ? $data['effective_to'] : $current['effective_to'];
        if ($effectiveTo !== null && $effectiveTo < $effectiveFrom) {
            Response::error('effective_to must be on or after effective_from', 400);
        }

        $fields = [];
        $values = [];
        foreach ($data as $key => $value) {
            $fields[] = $key . ' = ?';
            $values[] = $value;
        }
        $values[] = $priceListId;
        $values[] = Database::tenantId();
        Database::execute(
            'UPDATE price_lists SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE price_list_id = ? AND tenant_id = ?',
            $values
        );
        Response::success($this->priceListPayload($priceListId), 'Price list updated successfully');
    }

    public function replacePriceListItemsAction(Request $request): void
    {
        $priceListId = $this->requirePriceListId($request);
        $items = $request->input('items');
        if (!is_array($items)) Response::error('items must be an array', 400);
        $items = $this->normalisePriceListItems($items);

        Database::beginTransaction();
        try {
            Database::execute(
                'DELETE FROM price_list_items WHERE price_list_id = ? AND tenant_id = ?',
                [$priceListId, Database::tenantId()]
            );
            $this->replacePriceListItems($priceListId, $items);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
        Response::success($this->priceListPayload($priceListId), 'Price-list items updated successfully');
    }

    public function destroyPriceList(Request $request): void
    {
        $priceListId = $this->requirePriceListId($request);
        Database::execute(
            'DELETE FROM price_lists WHERE price_list_id = ? AND tenant_id = ?',
            [$priceListId, Database::tenantId()]
        );
        Response::success(null, 'Price list deleted successfully');
    }

    public function resolvePrice(Request $request): void
    {
        $productId = (int)$request->query('product_id', 0);
        $quantity = (float)$request->query('quantity', 1);
        $date = (string)$request->query('date', date('Y-m-d'));
        $requestedListId = (int)$request->query('price_list_id', 0);
        if ($productId <= 0 || !Product::findById($productId)) Response::error('Valid product_id is required', 400);
        if ($quantity <= 0) Response::error('quantity must be greater than zero', 400);
        $this->assertDate($date, 'date');

        $params = [$productId, Database::tenantId(), $date, $date];
        $listFilter = '';
        if ($requestedListId > 0) {
            $listFilter = ' AND pl.price_list_id = ?';
            $params[] = $requestedListId;
        }
        $item = Database::fetch(
            'SELECT pl.price_list_id, pl.name AS price_list_name, pli.price_list_item_id, pli.unit_price
             FROM price_lists pl
             JOIN price_list_items pli ON pli.price_list_id = pl.price_list_id AND pli.tenant_id = pl.tenant_id
             WHERE pli.product_id = ? AND pl.tenant_id = ? AND pl.is_active = 1
               AND pl.effective_from <= ? AND (pl.effective_to IS NULL OR pl.effective_to >= ?)' . $listFilter . '
             ORDER BY pl.priority DESC, pl.effective_from DESC, pl.price_list_id DESC
             LIMIT 1',
            $params
        );

        if ($item) {
            $tier = Database::fetch(
                'SELECT price_tier_id, min_quantity, max_quantity, unit_price
                 FROM price_list_quantity_tiers
                 WHERE price_list_item_id = ? AND tenant_id = ?
                   AND min_quantity <= ? AND (max_quantity IS NULL OR max_quantity >= ?)
                 ORDER BY min_quantity DESC LIMIT 1',
                [(int)$item['price_list_item_id'], Database::tenantId(), $quantity, $quantity]
            );
            $unitPrice = (float)($tier['unit_price'] ?? $item['unit_price']);
            Response::success([
                'product_id' => $productId,
                'quantity' => $quantity,
                'date' => $date,
                'unit_price' => $unitPrice,
                'total_price' => round($unitPrice * $quantity, 4),
                'source' => $tier ? 'quantity_tier' : 'price_list',
                'price_list_id' => (int)$item['price_list_id'],
                'price_list_name' => $item['price_list_name'],
                'tier' => $tier,
            ]);
        }

        if ($requestedListId > 0) Response::error('No effective price found in the requested price list', 404);

        $kit = Database::fetch(
            'SELECT SUM(kc.quantity * p.base_price) AS computed_price
             FROM product_kit_components kc
             JOIN products p ON p.product_id = kc.component_product_id AND p.tenant_id = kc.tenant_id
             WHERE kc.kit_product_id = ? AND kc.tenant_id = ?',
            [$productId, Database::tenantId()]
        );
        $product = Product::findById($productId);
        $hasKitPrice = $kit && $kit['computed_price'] !== null;
        $unitPrice = $hasKitPrice ? (float)$kit['computed_price'] : (float)$product['base_price'];
        Response::success([
            'product_id' => $productId,
            'quantity' => $quantity,
            'date' => $date,
            'unit_price' => $unitPrice,
            'total_price' => round($unitPrice * $quantity, 4),
            'source' => $hasKitPrice ? 'kit_computed' : 'product_base',
            'price_list_id' => null,
            'price_list_name' => null,
            'tier' => null,
        ]);
    }

    private function requirePriceListId(Request $request): int
    {
        $id = (int)$request->param('id');
        if ($id <= 0 || !Database::fetch('SELECT price_list_id FROM price_lists WHERE price_list_id = ? AND tenant_id = ?', [$id, Database::tenantId()])) {
            Response::error('Price list not found', 404);
        }
        return $id;
    }

    private function validatePriceList(Request $request, bool $creating): array
    {
        $allowed = ['name', 'description', 'effective_from', 'effective_to', 'priority', 'is_active'];
        $input = $request->only($allowed);
        if ($creating && (trim((string)($input['name'] ?? '')) === '' || empty($input['effective_from']))) {
            Response::error('name and effective_from are required', 400);
        }
        $data = [];
        if (array_key_exists('name', $input)) {
            $name = trim((string)$input['name']);
            if ($name === '' || strlen($name) > 150) Response::error('Valid name is required', 400);
            $data['name'] = Request::sanitize($name);
        }
        if (array_key_exists('description', $input)) $data['description'] = $input['description'] === null ? null : Request::sanitize((string)$input['description']);
        if (array_key_exists('effective_from', $input)) {
            $this->assertDate((string)$input['effective_from'], 'effective_from');
            $data['effective_from'] = $input['effective_from'];
        }
        if (array_key_exists('effective_to', $input)) {
            if ($input['effective_to'] !== null && $input['effective_to'] !== '') $this->assertDate((string)$input['effective_to'], 'effective_to');
            $data['effective_to'] = ($input['effective_to'] === '' ? null : $input['effective_to']);
        }
        $from = $data['effective_from'] ?? null;
        $to = $data['effective_to'] ?? null;
        if ($from && $to && $to < $from) Response::error('effective_to must be on or after effective_from', 400);
        if (array_key_exists('priority', $input)) $data['priority'] = (int)$input['priority'];
        if (array_key_exists('is_active', $input)) $data['is_active'] = (int)filter_var($input['is_active'], FILTER_VALIDATE_BOOLEAN);
        return $data;
    }

    private function normalisePriceListItems(array $items): array
    {
        $seenProducts = [];
        $normalised = [];
        foreach ($items as $item) {
            $productId = (int)($item['product_id'] ?? 0);
            $unitPrice = (float)($item['unit_price'] ?? -1);
            $tiers = $item['tiers'] ?? [];
            if ($productId <= 0 || !Product::findById($productId) || $unitPrice < 0 || !is_array($tiers)) {
                Response::error('Each item requires a valid product, non-negative unit_price, and tiers array', 400);
            }
            if (isset($seenProducts[$productId])) Response::error('A product can appear only once per price list', 400);
            $seenProducts[$productId] = true;
            $lastMax = null;
            usort($tiers, fn(array $a, array $b): int => (float)($a['min_quantity'] ?? 0) <=> (float)($b['min_quantity'] ?? 0));
            $cleanTiers = [];
            foreach ($tiers as $tier) {
                $min = (float)($tier['min_quantity'] ?? 0);
                $max = ($tier['max_quantity'] ?? null) === null || $tier['max_quantity'] === '' ? null : (float)$tier['max_quantity'];
                $price = (float)($tier['unit_price'] ?? -1);
                if ($min <= 0 || ($max !== null && $max < $min) || $price < 0 || ($lastMax !== null && $min <= $lastMax)) {
                    Response::error('Quantity tiers must be positive, ordered, non-overlapping ranges with non-negative prices', 400);
                }
                $cleanTiers[] = [
                    'min_quantity' => $min,
                    'max_quantity' => $max,
                    'unit_price' => $price,
                ];
                $lastMax = $max;
                if ($max === null) $lastMax = INF;
            }
            $normalised[] = ['product_id' => $productId, 'unit_price' => $unitPrice, 'tiers' => $cleanTiers];
        }
        return $normalised;
    }

    private function replacePriceListItems(int $priceListId, array $items): void
    {
        foreach ($items as $item) {
            $itemId = Database::insertTenant('price_list_items', [
                'price_list_id' => $priceListId,
                'product_id' => $item['product_id'],
                'unit_price' => $item['unit_price'],
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            foreach ($item['tiers'] as $tier) {
                Database::insertTenant('price_list_quantity_tiers', [
                    'price_list_item_id' => $itemId,
                    'min_quantity' => $tier['min_quantity'],
                    'max_quantity' => $tier['max_quantity'],
                    'unit_price' => $tier['unit_price'],
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
            }
        }
    }

    private function priceListPayload(int $priceListId): array
    {
        $list = Database::fetch('SELECT * FROM price_lists WHERE price_list_id = ? AND tenant_id = ?', [$priceListId, Database::tenantId()]);
        $items = Database::fetchAll(
            'SELECT pli.*, p.product_name, p.unit
             FROM price_list_items pli JOIN products p ON p.product_id = pli.product_id AND p.tenant_id = pli.tenant_id
             WHERE pli.price_list_id = ? AND pli.tenant_id = ? ORDER BY p.product_name',
            [$priceListId, Database::tenantId()]
        );
        foreach ($items as &$item) {
            $item['tiers'] = Database::fetchAll(
                'SELECT price_tier_id, min_quantity, max_quantity, unit_price
                 FROM price_list_quantity_tiers WHERE price_list_item_id = ? AND tenant_id = ? ORDER BY min_quantity',
                [(int)$item['price_list_item_id'], Database::tenantId()]
            );
        }
        unset($item);
        $list['is_active'] = (bool)$list['is_active'];
        $list['items'] = $items;
        return $list;
    }

    private function assertDate(string $date, string $field): void
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$parsed || $parsed->format('Y-m-d') !== $date) Response::error($field . ' must use YYYY-MM-DD', 400);
    }
}
