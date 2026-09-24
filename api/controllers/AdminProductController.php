<?php
declare(strict_types=1);

/**
 * Admin Product Controller
 * POST   /admin/products       — Create a new product
 * PUT    /admin/products/{id}  — Update any product field
 * DELETE /admin/products/{id}  — Soft-delete a product
 * GET/POST /admin/products/{id}/variants — List/create child-SKU variants
 * PUT/DELETE /admin/products/{id}/variants/{vid} — Update/delete a variant
 * GET/PUT /admin/products/{id}/kit — Read/replace composite item components
 */
class AdminProductController
{
    // ─── POST /admin/products ─────────────────────────────────────────────────

    public function store(Request $request): void
    {
        Validator::make($request->only(['product_name', 'product_type', 'base_price']), [
            'product_name' => 'required|string|max:200',
            'product_type' => 'required|string|max:50',
            'base_price'   => 'required|numeric',
        ])->validate();

        $data = $request->only([
            'product_name', 'product_type', 'description', 'base_price', 'unit',
            'gcv', 'ash_content', 'moisture_content', 'category',
            'tag', 'tag_color', 'suitable_for', 'image_url', 'is_available', 'configurations',
        ]);

        $isAvail = isset($data['is_available'])
            ? (int)filter_var($data['is_available'], FILTER_VALIDATE_BOOLEAN)
            : 1;

        Database::beginTransaction();
        try {
            $productId = Database::insertTenant('products', [
                'product_name'    => Request::sanitize($data['product_name']),
                'product_type'    => strtolower(trim($data['product_type'])),
                'description'     => $data['description']      ?? null,
                'base_price'      => (float)$data['base_price'],
                'unit'            => $data['unit']             ?? 'kg',
                'gcv'             => $data['gcv']              ?? null,
                'ash_content'     => $data['ash_content']      ?? null,
                'moisture_content'=> $data['moisture_content'] ?? null,
                'category'        => $data['category']         ?? null,
                'tag'             => $data['tag']              ?? null,
                'tag_color'       => $data['tag_color']        ?? null,
                'suitable_for'    => $data['suitable_for']     ?? null,
                'image_url'       => $data['image_url']        ?? null,
                'is_available'    => $isAvail,
                'created_at'      => date('Y-m-d H:i:s'),
            ]);

            // Handle product configurations list
            if (!empty($data['configurations']) && is_array($data['configurations'])) {
                foreach ($data['configurations'] as $config) {
                    if (empty($config['size'])) {
                        continue;
                    }
                    Database::insertTenant('product_configurations', [
                        'product_id'  => $productId,
                        'size'        => Request::sanitize((string)$config['size']),
                        'purpose'     => !empty($config['purpose']) ? Request::sanitize((string)$config['purpose']) : null,
                        'sub_purpose' => !empty($config['sub_purpose']) ? Request::sanitize((string)$config['sub_purpose']) : null,
                        'price'       => (float)($config['price'] ?? 0),
                        'is_available'=> 1,
                        'created_at'  => date('Y-m-d H:i:s'),
                    ]);
                }
            }
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }

        $product = Product::findById($productId);
        Response::success($product, 'Product created successfully', 201);
    }

    // ─── PUT /admin/products/{id} ─────────────────────────────────────────────

    public function update(Request $request): void
    {
        $productId = (int)$request->param('id');
        if ($productId <= 0) {
            Response::error('Invalid product ID', 400);
        }

        $product = Product::findById($productId);
        if (!$product) {
            Response::error('Product not found', 404);
        }

        $allowed = [
            'product_name', 'product_type', 'description', 'base_price', 'unit',
            'gcv', 'ash_content', 'moisture_content', 'category',
            'tag', 'tag_color', 'suitable_for', 'image_url', 'is_available',
        ];

        $input = $request->only([
            'product_name', 'product_type', 'description', 'base_price', 'unit',
            'gcv', 'ash_content', 'moisture_content', 'category',
            'tag', 'tag_color', 'suitable_for', 'image_url', 'is_available', 'configurations',
        ]);
        
        $fields = [];
        $values = [];

        foreach ($allowed as $field) {
            if (!array_key_exists($field, $input)) {
                continue;
            }
            if ($field === 'is_available') {
                $fields[] = 'is_available = ?';
                $values[] = (int)filter_var($input[$field], FILTER_VALIDATE_BOOLEAN);
            } elseif ($field === 'base_price') {
                $fields[] = 'base_price = ?';
                $values[] = (float)$input[$field];
            } else {
                $fields[] = "$field = ?";
                $values[] = Request::sanitize((string)$input[$field]);
            }
        }

        Database::beginTransaction();
        try {
            if (!empty($fields)) {
                $values[] = $productId;
                $values[] = Database::tenantId();
                Database::execute(
                    'UPDATE products SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE product_id = ? AND tenant_id = ?',
                    $values
                );
            }

            if (isset($input['configurations']) && is_array($input['configurations'])) {
                Database::execute('DELETE FROM product_configurations WHERE product_id = ? AND tenant_id = ?', [$productId, Database::tenantId()]);

                foreach ($input['configurations'] as $config) {
                    if (empty($config['size'])) {
                        continue;
                    }
                    Database::insertTenant('product_configurations', [
                        'product_id'  => $productId,
                        'size'        => Request::sanitize((string)$config['size']),
                        'purpose'     => !empty($config['purpose']) ? Request::sanitize((string)$config['purpose']) : null,
                        'sub_purpose' => !empty($config['sub_purpose']) ? Request::sanitize((string)$config['sub_purpose']) : null,
                        'price'       => (float)($config['price'] ?? 0),
                        'is_available'=> 1,
                        'created_at'  => date('Y-m-d H:i:s'),
                    ]);
                }
            }
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Update failed: ' . $e->getMessage() . ' (line ' . $e->getLine() . ' in ' . basename($e->getFile()) . ')', 500);
        }

        Response::success(Product::findById($productId), 'Product updated successfully');
    }

    // ─── DELETE /admin/products/{id} ──────────────────────────────────────────

    public function destroy(Request $request): void
    {
        $productId = (int)$request->param('id');
        if ($productId <= 0) {
            Response::error('Invalid product ID', 400);
        }

        $product = Product::findById($productId);
        if (!$product) {
            Response::error('Product not found', 404);
        }

        // Remove all configurations for this product
        Database::execute(
            'DELETE FROM product_configurations WHERE product_id = ? AND tenant_id = ?',
            [$productId, Database::tenantId()]
        );

        // Soft-delete: mark unavailable and flag deleted
        Database::execute(
            'UPDATE products SET is_available = 0, is_deleted = 1, updated_at = NOW() WHERE product_id = ? AND tenant_id = ?',
            [$productId, Database::tenantId()]
        );

        Response::success(null, 'Product deleted successfully');
    }

    // ─── Product variants ────────────────────────────────────────────────────

    public function variants(Request $request): void
    {
        $productId = $this->requireProduct($request);
        $rows = Database::fetchAll(
            'SELECT pv.variant_id, pv.parent_product_id, pv.child_product_id, pv.sku,
                    pv.attribute_values, pv.is_active, pv.created_at, pv.updated_at,
                    p.product_name, p.product_type, p.base_price, p.unit, p.is_available
             FROM product_variants pv
             JOIN products p ON p.product_id = pv.child_product_id AND p.tenant_id = pv.tenant_id
             WHERE pv.parent_product_id = ? AND pv.tenant_id = ?
             ORDER BY pv.sku',
            [$productId, Database::tenantId()]
        );

        foreach ($rows as &$row) {
            $row['attribute_values'] = json_decode((string)$row['attribute_values'], true) ?: [];
            $row['is_active'] = (bool)$row['is_active'];
        }
        unset($row);

        Response::success(['variants' => $rows, 'total' => count($rows)]);
    }

    public function storeVariant(Request $request): void
    {
        $parentId = $this->requireProduct($request);
        $sku = trim((string)$request->input('sku', ''));
        $attributes = $request->input('attributes', []);
        if ($sku === '' || strlen($sku) > 100 || !is_array($attributes) || $attributes === []) {
            Response::error('SKU and at least one attribute are required', 400);
        }
        $cleanAttributes = $this->cleanAttributes($attributes);

        $parent = Product::findById($parentId);
        $childId = (int)$request->input('child_product_id', 0);

        $newChild = null;
        if ($childId > 0) {
            $child = Product::findById($childId);
            if (!$child || $childId === $parentId) Response::error('Valid child product is required', 400);
        } else {
            $name = trim((string)$request->input('product_name', ''));
            $price = (float)$request->input('base_price', $parent['base_price'] ?? 0);
            if ($name === '' || $price < 0) Response::error('Variant product name and a non-negative base price are required', 400);
            $newChild = ['name' => $name, 'price' => $price];
        }

        Database::beginTransaction();
        try {
            if ($newChild !== null) {
                $childId = Database::insertTenant('products', [
                    'product_name' => Request::sanitize($newChild['name']),
                    'product_type' => (string)$parent['product_type'],
                    'description' => $request->input('description', $parent['description'] ?? null),
                    'base_price' => $newChild['price'],
                    'unit' => $request->input('unit', $parent['unit'] ?? 'kg'),
                    'category' => $parent['category'] ?? null,
                    'is_available' => 1,
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
            }

            $variantId = Database::insertTenant('product_variants', [
                'parent_product_id' => $parentId,
                'child_product_id' => $childId,
                'sku' => Request::sanitize($sku),
                'attribute_values' => json_encode($cleanAttributes, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'is_active' => 1,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            Database::commit();
        } catch (\Throwable $e) {
            if (Database::getInstance()->inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }

        Response::success(['variant_id' => $variantId, 'child_product_id' => $childId], 'Variant created successfully', 201);
    }

    public function updateVariant(Request $request): void
    {
        $parentId = $this->requireProduct($request);
        $variantId = (int)$request->param('vid');
        $variant = $this->findVariant($parentId, $variantId);

        $fields = [];
        $values = [];
        if ($request->input('sku') !== null) {
            $sku = trim((string)$request->input('sku'));
            if ($sku === '' || strlen($sku) > 100) Response::error('Valid SKU is required', 400);
            $fields[] = 'sku = ?';
            $values[] = Request::sanitize($sku);
        }
        if ($request->input('attributes') !== null) {
            $attributes = $request->input('attributes');
            if (!is_array($attributes) || $attributes === []) Response::error('At least one attribute is required', 400);
            $fields[] = 'attribute_values = ?';
            $values[] = json_encode($this->cleanAttributes($attributes), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        }
        if ($request->input('is_active') !== null) {
            $fields[] = 'is_active = ?';
            $values[] = (int)filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN);
        }
        if ($fields === []) Response::error('Provide sku, attributes, or is_active', 400);

        $values[] = $variant['variant_id'];
        $values[] = Database::tenantId();
        Database::execute(
            'UPDATE product_variants SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE variant_id = ? AND tenant_id = ?',
            $values
        );
        Response::success(null, 'Variant updated successfully');
    }

    public function destroyVariant(Request $request): void
    {
        $parentId = $this->requireProduct($request);
        $variant = $this->findVariant($parentId, (int)$request->param('vid'));
        Database::execute(
            'DELETE FROM product_variants WHERE variant_id = ? AND tenant_id = ?',
            [(int)$variant['variant_id'], Database::tenantId()]
        );
        Response::success(null, 'Variant link deleted; the child product was preserved');
    }

    // ─── Composite / kit items ───────────────────────────────────────────────

    public function kit(Request $request): void
    {
        $productId = $this->requireProduct($request);
        Response::success($this->kitPayload($productId));
    }

    public function updateKit(Request $request): void
    {
        $kitId = $this->requireProduct($request);
        $components = $request->input('components', []);
        if (!is_array($components)) Response::error('components must be an array', 400);

        $normalised = [];
        foreach ($components as $component) {
            $componentId = (int)($component['product_id'] ?? 0);
            $quantity = (float)($component['quantity'] ?? 0);
            if ($componentId <= 0 || $componentId === $kitId || $quantity <= 0 || !Product::findById($componentId)) {
                Response::error('Every component requires a different, valid product and quantity greater than zero', 400);
            }
            if (isset($normalised[$componentId])) Response::error('A component product can appear only once', 400);
            if ($this->kitContains($componentId, $kitId)) Response::error('Kit components cannot create a circular BOM', 400);
            $normalised[$componentId] = $quantity;
        }

        Database::beginTransaction();
        try {
            Database::execute(
                'DELETE FROM product_kit_components WHERE kit_product_id = ? AND tenant_id = ?',
                [$kitId, Database::tenantId()]
            );
            foreach ($normalised as $componentId => $quantity) {
                Database::insertTenant('product_kit_components', [
                    'kit_product_id' => $kitId,
                    'component_product_id' => $componentId,
                    'quantity' => $quantity,
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
            }
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }

        Response::success($this->kitPayload($kitId), 'Kit components updated successfully');
    }

    private function requireProduct(Request $request): int
    {
        $productId = (int)$request->param('id');
        if ($productId <= 0 || !Product::findById($productId)) Response::error('Product not found', 404);
        return $productId;
    }

    private function findVariant(int $parentId, int $variantId): array
    {
        $variant = Database::fetch(
            'SELECT * FROM product_variants WHERE variant_id = ? AND parent_product_id = ? AND tenant_id = ?',
            [$variantId, $parentId, Database::tenantId()]
        );
        if (!$variant) Response::error('Variant not found', 404);
        return $variant;
    }

    private function cleanAttributes(array $attributes): array
    {
        $clean = [];
        foreach ($attributes as $name => $value) {
            $name = trim((string)$name);
            $value = trim((string)$value);
            if ($name !== '' && $value !== '') $clean[Request::sanitize($name)] = Request::sanitize($value);
        }
        if ($clean === []) Response::error('At least one non-empty attribute is required', 400);
        return $clean;
    }

    private function kitPayload(int $kitId): array
    {
        $components = Database::fetchAll(
            'SELECT kc.kit_component_id, kc.component_product_id AS product_id, kc.quantity,
                    p.product_name, p.base_price, p.unit,
                    (kc.quantity * p.base_price) AS line_price
             FROM product_kit_components kc
             JOIN products p ON p.product_id = kc.component_product_id AND p.tenant_id = kc.tenant_id
             WHERE kc.kit_product_id = ? AND kc.tenant_id = ?
             ORDER BY p.product_name',
            [$kitId, Database::tenantId()]
        );
        $computed = array_reduce($components, fn(float $sum, array $row): float => $sum + (float)$row['line_price'], 0.0);
        return ['product_id' => $kitId, 'components' => $components, 'computed_price' => round($computed, 4)];
    }

    private function kitContains(int $startProductId, int $wantedProductId): bool
    {
        $pending = [$startProductId];
        $seen = [];
        while ($pending !== []) {
            $current = array_pop($pending);
            if ($current === $wantedProductId) return true;
            if (isset($seen[$current])) continue;
            $seen[$current] = true;
            $children = Database::fetchAll(
                'SELECT component_product_id FROM product_kit_components WHERE kit_product_id = ? AND tenant_id = ?',
                [$current, Database::tenantId()]
            );
            foreach ($children as $child) $pending[] = (int)$child['component_product_id'];
        }
        return false;
    }
}
