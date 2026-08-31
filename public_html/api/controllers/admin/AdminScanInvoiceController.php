<?php
declare(strict_types=1);

/**
 * Admin Scan Invoice Controller
 *
 * POST   /admin/scan-invoices/upload        — upload file + start AI extraction
 * POST   /admin/scan-invoices/manual        — create invoice manually (no file)
 * GET    /admin/scan-invoices/{id}/status   — polling: returns processing status
 * PUT    /admin/scan-invoices/{id}/approve  — approve + full cascade (9 steps)
 * GET    /admin/scan-invoices/{id}/download — stream uploaded file
 * GET    /admin/scan-invoices               — list with filters
 * GET    /admin/scan-invoices/{id}          — single invoice + line items
 * PUT    /admin/scan-invoices/{id}          — update header fields
 * DELETE /admin/scan-invoices/{id}          — delete + remove file
 */
class AdminScanInvoiceController
{
    private const ALLOWED_MIME = ['application/pdf','image/jpeg','image/jpg','image/png'];
    private const EXT_MAP      = [
        'application/pdf' => 'pdf',
        'image/jpeg'      => 'jpg',
        'image/jpg'       => 'jpg',
        'image/png'       => 'png',
    ];
    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    // ─── POST /admin/scan-invoices/upload ─────────────────────────────────────
    public function upload(Request $request): void
    {
        $tid = Database::tenantId();
        if (empty($_FILES['file'])) {
            Response::error('file is required', 422);
        }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('File upload error: ' . $file['error'], 422);
        }
        if ($file['size'] > self::MAX_BYTES) {
            Response::error('File too large (max 10 MB)', 422);
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            Response::error('Only PDF, JPG, and PNG files are accepted', 422);
        }
        $ext    = self::EXT_MAP[$mime] ?? 'pdf';
        $dir    = ROOT_PATH . '/storage/invoices/' . $tid . '/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $marketplace = $request->input('marketplace') ?: 'other';
        if (!in_array($marketplace, ['amazon','flipkart','meesho','other'], true)) $marketplace = 'other';

        // Accept invoice_type, is_credit_sale, credit_days from upload request
        $invoiceType   = $request->input('invoice_type') ?: 'sale';
        $isCreditSale  = $request->input('is_credit_sale') ? 1 : 0;
        $creditDays    = max(1, (int)($request->input('credit_days') ?? 30));
        $isDamaged     = $request->input('is_damaged') ? 1 : 0;
        if (!in_array($invoiceType, ['sale','purchase','return','commission'], true)) $invoiceType = 'sale';
        // Also accept shipping/commission in case they are known at upload time
        $shipping    = (float)($request->input('shipping_charges')  ?? 0);
        $commission  = (float)($request->input('commission_amount') ?? 0);

        // Create invoice record first to get the ID for the filename
        $invoiceId = Database::insert(
            'INSERT INTO scan_invoices
                (tenant_id, file_path, file_type, original_filename, marketplace, invoice_type,
                 is_damaged, is_credit_sale, credit_days, shipping_charges, commission_amount,
                 processing_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())',
            [$tid, 'pending', $ext, Request::sanitize(basename($file['name'])), $marketplace,
             $invoiceType, $isDamaged, $isCreditSale, $creditDays, $shipping, $commission]
        );

        $filename = $invoiceId . '.' . $ext;
        $fullPath = $dir . $filename;
        $relPath  = 'storage/invoices/' . $tid . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
            Database::execute('DELETE FROM scan_invoices WHERE invoice_id = ? AND tenant_id = ?', [$invoiceId, $tid]);
            Response::error('Failed to store file', 500);
        }

        Database::execute(
            'UPDATE scan_invoices SET file_path = ?, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?',
            [$relPath, $invoiceId, $tid]
        );

        // Check if PDF has multiple pages — if so, split and process each page separately
        if ($ext === 'pdf') {
            $pageCount = $this->getPdfPageCount($fullPath);
            if ($pageCount > 1) {
                // Delete the placeholder record we created before we knew about pages
                Database::execute('DELETE FROM scan_invoices WHERE invoice_id = ? AND tenant_id = ?', [$invoiceId, $tid]);

                $baseName = pathinfo(Request::sanitize(basename($file['name'])), PATHINFO_FILENAME);
                $invoiceIds = [];
                for ($page = 1; $page <= $pageCount; $page++) {
                    $pageInvoiceId = Database::insert(
                        'INSERT INTO scan_invoices
                            (tenant_id, file_path, file_type, original_filename, marketplace, invoice_type,
                             is_damaged, is_credit_sale, credit_days, shipping_charges, commission_amount,
                             processing_status, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())',
                        [$tid, $relPath, $ext,
                         $baseName . "_page{$page}.pdf",
                         $marketplace, $invoiceType, $isDamaged, $isCreditSale, $creditDays, $shipping, $commission]
                    );
                    $invoiceIds[] = $pageInvoiceId;
                }

                // Return immediately after creating records — client polls /status
                // Process pages sequentially in background via output buffering trick
                Response::success([
                    'multi_page'   => true,
                    'page_count'   => $pageCount,
                    'invoice_ids'  => $invoiceIds,
                    'invoice_id'   => $invoiceIds[0],
                ], "PDF has {$pageCount} pages — processing each as separate invoice", 202);

                // Flush response to client, then keep processing in background
                if (function_exists('fastcgi_finish_request')) {
                    fastcgi_finish_request();
                } else {
                    ob_end_flush();
                    flush();
                }

                // Process pages with rate-limit-safe pacing (2s between each)
                set_time_limit(300); // 5 min for large PDFs
                $service = $this->processingService();
                foreach ($invoiceIds as $idx => $pageInvoiceId) {
                    $service->processPage($pageInvoiceId, $fullPath, $idx + 1, $tid);
                    if ($idx < count($invoiceIds) - 1) {
                        sleep(2); // 2s gap prevents Groq rate limit
                    }
                }
                return;
            }
        }

        // Single file / single-page PDF: check for pre-extracted data from client parser
        $preExtracted = $request->input('pre_extracted');
        if ($preExtracted) {
            $extractedData = is_string($preExtracted) ? json_decode($preExtracted, true) : null;
            if (is_array($extractedData)) {
                // Client-side parser succeeded — store directly as review, skip AI
                $invNumber = $extractedData['invoice_number'] ?? null;
                $invDate   = $extractedData['invoice_date'] ?? null;
                $total     = (float)($extractedData['total_amount'] ?? 0);
                $tax       = (float)($extractedData['tax_amount'] ?? 0);
                $subtotal  = (float)($extractedData['subtotal'] ?? 0);
                $confidence = (float)($extractedData['ai_confidence_score'] ?? 85);

                Database::execute(
                    'UPDATE scan_invoices
                     SET processing_status = "review", invoice_number = ?, invoice_date = ?,
                         total_amount = ?, tax_amount = ?, subtotal = ?,
                         ai_confidence_score = ?,
                         extracted_data = ?, validated_data = ?,
                         processed_at = NOW(), error_message = ?, updated_at = NOW()
                     WHERE invoice_id = ? AND tenant_id = ?',
                    [
                        $invNumber, $invDate, $total, $tax, $subtotal, $confidence,
                        json_encode($extractedData, JSON_UNESCAPED_UNICODE),
                        json_encode($extractedData, JSON_UNESCAPED_UNICODE),
                        '{"stage":"complete","progress":100}',
                        $invoiceId, $tid,
                    ]
                );

                // Insert line items so approve cascade writes GST records, journal entries etc.
                $lineItems = $extractedData['line_items'] ?? [];
                foreach ($lineItems as $li) {
                    $sku = trim((string)($li['sku'] ?? '')) ?: null;
                    $productId = null;
                    if ($sku) {
                        $p = Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku]);
                        if ($p) $productId = (int)$p['product_id'];
                    }
                    Database::insert(
                        'INSERT INTO scan_invoice_line_items
                            (invoice_id, product_id, sku, product_name, hsn_code,
                             quantity, unit_price, discount, taxable_value,
                             cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                             igst_rate, igst_amount, total_amount, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                        [
                            $invoiceId, $productId, $sku,
                            Request::sanitize((string)($li['product_name'] ?? '')),
                            $li['hsn_code'] ?? null,
                            (float)($li['quantity'] ?? 1),
                            (float)($li['unit_price'] ?? 0),
                            (float)($li['discount'] ?? 0),
                            (float)($li['taxable_value'] ?? 0),
                            (float)($li['cgst_rate'] ?? 0),
                            (float)($li['cgst_amount'] ?? 0),
                            (float)($li['sgst_rate'] ?? 0),
                            (float)($li['sgst_amount'] ?? 0),
                            (float)($li['igst_rate'] ?? 0),
                            (float)($li['igst_amount'] ?? 0),
                            (float)($li['total_amount'] ?? 0),
                        ]
                    );
                }

                $row = $this->findOrFail($invoiceId, $tid);
                Response::success($row, 'Invoice parsed and ready for review', 202);
                return;
            }
        }

        // No pre-extracted data — run server-side AI processing
        $service = $this->processingService();
        $service->process($invoiceId, $fullPath, $ext, $tid);

        $row = $this->findOrFail($invoiceId, $tid);
        Response::success($row, 'Invoice uploaded and processing', 202);
    }

    // ─── POST /admin/scan-invoices/upload-page ────────────────────────────────
    // Accepts a single page from a multi-page PDF + optional pre_extracted JSON
    public function uploadPage(Request $request): void
    {
        $tid = Database::tenantId();
        if (empty($_FILES['file'])) Response::error('file is required', 422);
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) Response::error('Upload error: ' . $file['error'], 422);
        if ($file['size'] > self::MAX_BYTES)   Response::error('File too large (max 10 MB)', 422);

        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!in_array($mime, self::ALLOWED_MIME, true)) Response::error('Only PDF, JPG, PNG files accepted', 422);
        $ext = self::EXT_MAP[$mime] ?? 'pdf';

        $marketplace  = $request->input('marketplace') ?: 'other';
        $invoiceType  = $request->input('invoice_type') ?: 'sale';
        $isCreditSale = $request->input('is_credit_sale') ? 1 : 0;
        $creditDays   = max(1, (int)($request->input('credit_days') ?? 30));
        $pageNum      = max(1, (int)($request->input('pdf_page') ?? 1));

        $dir = ROOT_PATH . '/storage/invoices/' . $tid . '/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $invoiceId = Database::insert(
            'INSERT INTO scan_invoices
                (tenant_id, file_path, file_type, original_filename, marketplace, invoice_type,
                 is_credit_sale, credit_days, pdf_page, processing_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", NOW())',
            [$tid, 'pending', $ext,
             Request::sanitize(basename($file['name'])) . "_page{$pageNum}",
             $marketplace, $invoiceType, $isCreditSale, $creditDays, $pageNum]
        );

        $filename = $invoiceId . '_p' . $pageNum . '.' . $ext;
        $fullPath = $dir . $filename;
        $relPath  = 'storage/invoices/' . $tid . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
            Database::execute('DELETE FROM scan_invoices WHERE invoice_id = ? AND tenant_id = ?', [$invoiceId, $tid]);
            Response::error('Failed to store file', 500);
        }

        Database::execute(
            'UPDATE scan_invoices SET file_path = ?, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?',
            [$relPath, $invoiceId, $tid]
        );

        // Check for pre-extracted data from client parser
        $preExtracted = $request->input('pre_extracted');
        if ($preExtracted) {
            $extractedData = is_string($preExtracted) ? json_decode($preExtracted, true) : null;
            if (is_array($extractedData)) {
                $invNumber  = $extractedData['invoice_number'] ?? null;
                $invDate    = $extractedData['invoice_date'] ?? null;
                $total      = (float)($extractedData['total_amount'] ?? 0);
                $tax        = (float)($extractedData['tax_amount'] ?? 0);
                $subtotal   = (float)($extractedData['subtotal'] ?? 0);
                $confidence = (float)($extractedData['ai_confidence_score'] ?? 85);

                Database::execute(
                    'UPDATE scan_invoices
                     SET processing_status = "review", invoice_number = ?, invoice_date = ?,
                         total_amount = ?, tax_amount = ?, subtotal = ?,
                         ai_confidence_score = ?,
                         extracted_data = ?, validated_data = ?,
                         processed_at = NOW(), error_message = ?, updated_at = NOW()
                     WHERE invoice_id = ? AND tenant_id = ?',
                    [
                        $invNumber, $invDate, $total, $tax, $subtotal, $confidence,
                        json_encode($extractedData, JSON_UNESCAPED_UNICODE),
                        json_encode($extractedData, JSON_UNESCAPED_UNICODE),
                        '{"stage":"complete","progress":100}',
                        $invoiceId, $tid,
                    ]
                );

                // Insert line items into scan_invoice_line_items so approve cascade works correctly
                $lineItems = $extractedData['line_items'] ?? [];
                foreach ($lineItems as $li) {
                    $sku = trim((string)($li['sku'] ?? '')) ?: null;
                    $productId = null;
                    if ($sku) {
                        $p = Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku]);
                        if ($p) $productId = (int)$p['product_id'];
                    }
                    Database::insert(
                        'INSERT INTO scan_invoice_line_items
                            (invoice_id, product_id, sku, product_name, hsn_code,
                             quantity, unit_price, discount, taxable_value,
                             cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                             igst_rate, igst_amount, total_amount, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                        [
                            $invoiceId, $productId, $sku,
                            Request::sanitize((string)($li['product_name'] ?? '')),
                            $li['hsn_code'] ?? null,
                            (float)($li['quantity'] ?? 1),
                            (float)($li['unit_price'] ?? 0),
                            (float)($li['discount'] ?? 0),
                            (float)($li['taxable_value'] ?? 0),
                            (float)($li['cgst_rate'] ?? 0),
                            (float)($li['cgst_amount'] ?? 0),
                            (float)($li['sgst_rate'] ?? 0),
                            (float)($li['sgst_amount'] ?? 0),
                            (float)($li['igst_rate'] ?? 0),
                            (float)($li['igst_amount'] ?? 0),
                            (float)($li['total_amount'] ?? 0),
                        ]
                    );
                }

                Response::success(['invoice_id' => $invoiceId], 'Page parsed and ready for review', 201);
                return;
            }
        }

        // No parser data — queue for AI processing
        $service = $this->processingService();
        $service->processPage($invoiceId, $fullPath, 1, $tid);
        Response::success(['invoice_id' => $invoiceId], 'Page uploaded for AI processing', 202);
    }

    private function getPdfPageCount(string $filePath): int
    {
        // Strategy 1: pure-PHP regex on first 64KB — no shell needed
        $chunk = @file_get_contents($filePath, false, null, 0, 65536);
        if ($chunk && preg_match_all('/\/Count\s+(\d+)/', $chunk, $m)) {
            $count = max(array_map('intval', $m[1]));
            if ($count > 0) return $count;
        }

        // Strategy 2: Imagick pingImage — counts pages without full render
        if (extension_loaded('imagick')) {
            try {
                $im = new \Imagick();
                $im->pingImage($filePath);
                $count = $im->getNumberImages();
                $im->destroy();
                if ($count > 0) return $count;
            } catch (\Throwable $_) {}
        }

        return 1;
    }

    // ─── POST /admin/scan-invoices/manual ────────────────────────────────────
    public function storeManual(Request $request): void
    {
        $tid         = Database::tenantId();
        $invNumber   = trim((string)($request->input('invoice_number') ?? ''));
        $marketplace = $request->input('marketplace') ?: 'other';
        if (!in_array($marketplace, ['amazon','flipkart','meesho','other'], true)) $marketplace = 'other';
        $invoiceType  = $request->input('invoice_type') ?: 'sale';
        if (!in_array($invoiceType, ['sale','purchase','return','commission'], true)) $invoiceType = 'sale';
        $isCreditSale = $request->input('is_credit_sale') ? 1 : 0;
        $creditDays   = max(1, (int)($request->input('credit_days') ?? 30));
        $shipping     = (float)($request->input('shipping_charges') ?? 0);
        $commission   = (float)($request->input('commission_amount') ?? 0);

        // Compute totals from line items if provided
        $lineItems   = (array)($request->input('line_items') ?? []);
        $subtotal    = (float)($request->input('subtotal') ?? 0);
        $taxAmount   = (float)($request->input('tax_amount') ?? 0);
        $totalAmt    = (float)($request->input('total_amount') ?? 0);

        if (!empty($lineItems) && $totalAmt == 0) {
            $subtotal  = 0; $taxAmount = 0; $totalAmt = 0;
            foreach ($lineItems as $li) {
                $qty   = (float)($li['qty'] ?? 1);
                $price = (float)($li['unit_price'] ?? 0);
                $gstR  = (float)($li['gst_rate'] ?? 0);
                $base  = round($qty * $price, 2);
                $gst   = round($base * $gstR / 100, 2);
                $subtotal  += $base;
                $taxAmount += $gst;
                $totalAmt  += $base + $gst;
            }
            $totalAmt = round($totalAmt + $shipping, 2);
        }

        $invoiceId = Database::insert(
            'INSERT INTO scan_invoices
                (tenant_id, file_path, file_type, original_filename, invoice_number, invoice_date,
                 marketplace, invoice_type, is_credit_sale, credit_days, vendor_name, vendor_gstin,
                 subtotal, tax_amount, total_amount, shipping_charges, commission_amount,
                 processing_status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "approved", NOW())',
            [
                $tid, 'manual', 'pdf', 'manual-entry.pdf',
                $invNumber ?: null,
                $request->input('invoice_date') ?: null,
                $marketplace, $invoiceType, $isCreditSale, $creditDays,
                $request->input('vendor_name') ? Request::sanitize((string)$request->input('vendor_name')) : null,
                $request->input('vendor_gstin') ? strtoupper(trim((string)$request->input('vendor_gstin'))) : null,
                (float)($request->input('subtotal') ?? 0),
                (float)($request->input('tax_amount') ?? 0),
                $totalAmt, $shipping, $commission,
            ]
        );

        // ── Post-insert cascade for special invoice types ──────────────────────
        // Commission manual entries: auto-post the commission amount to expenses
        if ($invoiceType === 'commission' && $commission > 0) {
            $invDate = $request->input('invoice_date') ?: date('Y-m-d');
            Database::insert(
                'INSERT INTO marketplace_expenses
                    (tenant_id, invoice_id, category, description, amount, expense_date, marketplace, created_at)
                 VALUES (?, ?, "Marketplace Commission", ?, ?, ?, ?, NOW())',
                [
                    $tid, $invoiceId,
                    ucfirst($marketplace) . ' Commission — ' . ($invNumber ?: 'Invoice #' . $invoiceId),
                    $commission, $invDate, $marketplace,
                ]
            );
        }

        // Credit sale manual entries: create outstanding receivable
        if ($isCreditSale && $invoiceType === 'sale' && $totalAmt > 0) {
            $invDate2 = $request->input('invoice_date') ?: date('Y-m-d');
            $dueDate  = date('Y-m-d', strtotime($invDate2 . ' +' . $creditDays . ' days'));
            $partyName = $request->input('customer_name') ? Request::sanitize((string)$request->input('customer_name'))
                : ($request->input('vendor_name') ? Request::sanitize((string)$request->input('vendor_name')) : 'Cash Sale');
            Database::execute('DELETE FROM outstanding_entries WHERE invoice_id = ? AND tenant_id = ?', [$invoiceId, $tid]);
            Database::insert(
                'INSERT INTO outstanding_entries
                    (tenant_id, invoice_id, type, party_name, invoice_number, invoice_date,
                     due_date, total_amount, paid_amount, balance_amount, credit_days, created_at)
                 VALUES (?, ?, "receivable", ?, ?, ?, ?, ?, 0, ?, ?, NOW())',
                [$tid, $invoiceId, $partyName, $invNumber ?: null, $invDate2, $dueDate, $totalAmt, $totalAmt, $creditDays]
            );
        }

        // Credit purchase: create outstanding payable
        if ($isCreditSale && $invoiceType === 'purchase' && $totalAmt > 0) {
            $invDate3 = $request->input('invoice_date') ?: date('Y-m-d');
            $dueDate3 = date('Y-m-d', strtotime($invDate3 . ' +' . $creditDays . ' days'));
            $vendorName = $request->input('vendor_name') ? Request::sanitize((string)$request->input('vendor_name')) : 'Vendor';
            Database::execute('DELETE FROM outstanding_entries WHERE invoice_id = ? AND tenant_id = ?', [$invoiceId, $tid]);
            Database::insert(
                'INSERT INTO outstanding_entries
                    (tenant_id, invoice_id, type, party_name, invoice_number, invoice_date,
                     due_date, total_amount, paid_amount, balance_amount, credit_days, created_at)
                 VALUES (?, ?, "payable", ?, ?, ?, ?, ?, 0, ?, ?, NOW())',
                [$tid, $invoiceId, $vendorName, $invNumber ?: null, $invDate3, $dueDate3, $totalAmt, $totalAmt, $creditDays]
            );
        }

        // Insert line items + GST records for manual purchase/sale entries
        $lineItemsInput = $request->input('line_items');
        $lineItemsArr = is_string($lineItemsInput) ? json_decode($lineItemsInput, true) : (is_array($lineItemsInput) ? $lineItemsInput : []);
        if (!empty($lineItemsArr) && is_array($lineItemsArr)) {
            $invDate4 = $request->input('invoice_date') ?: date('Y-m-d');
            $vendorGstin4 = $request->input('vendor_gstin') ? strtoupper(trim((string)$request->input('vendor_gstin'))) : null;

            // Compute FY/quarter/month for GST records
            $invDateObj4 = new \DateTimeImmutable($invDate4);
            $month4      = (int)$invDateObj4->format('n');
            $year4       = (int)$invDateObj4->format('Y');
            $fyStart4    = ($month4 >= 4) ? $year4 : $year4 - 1;
            $fyString4   = $fyStart4 . '-' . substr((string)($fyStart4 + 1), 2);
            $quarter4    = match(true) { in_array($month4,[4,5,6])=>1, in_array($month4,[7,8,9])=>2, in_array($month4,[10,11,12])=>3, default=>4 };
            $supplyType4 = $this->determineSupplyType($vendorGstin4, null);

            foreach ($lineItemsArr as $li) {
                if (!is_array($li)) continue;
                $sku4        = trim((string)($li['sku'] ?? '')) ?: null;
                $qty4        = (float)($li['qty'] ?? $li['quantity'] ?? 1);
                $price4      = (float)($li['unit_price'] ?? 0);
                $taxable4    = (float)($li['taxable_value'] ?? round($qty4 * $price4, 2));
                $igstR4      = (float)($li['igst_rate'] ?? 0);
                $igstA4      = (float)($li['igst_amount'] ?? round($taxable4 * $igstR4 / 100, 2));
                $cgstR4      = (float)($li['cgst_rate'] ?? 0);
                $cgstA4      = (float)($li['cgst_amount'] ?? round($taxable4 * $cgstR4 / 100, 2));
                $sgstR4      = (float)($li['sgst_rate'] ?? 0);
                $sgstA4      = (float)($li['sgst_amount'] ?? round($taxable4 * $sgstR4 / 100, 2));
                $lineTotal4  = round($taxable4 + $igstA4 + $cgstA4 + $sgstA4, 2);
                $totalTax4   = $igstA4 + $cgstA4 + $sgstA4;

                // Insert scan_invoice_line_items
                $productId4 = null;
                if ($sku4) {
                    $p4 = Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku4]);
                    if ($p4) $productId4 = (int)$p4['product_id'];
                }
                Database::insert(
                    'INSERT INTO scan_invoice_line_items
                        (invoice_id, product_id, sku, product_name, hsn_code, quantity, unit_price, discount,
                         taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                         total_amount, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                    [
                        $invoiceId, $productId4, $sku4,
                        Request::sanitize((string)($li['product_name'] ?? '')),
                        $li['hsn_code'] ?? null,
                        $qty4, $price4, $taxable4,
                        $cgstR4, $cgstA4, $sgstR4, $sgstA4, $igstR4, $igstA4,
                        $lineTotal4,
                    ]
                );

                // Insert gst_records if there's tax
                if ($totalTax4 > 0 || $taxable4 > 0) {
                    Database::insert(
                        'INSERT INTO gst_records
                            (tenant_id, invoice_id, gstin_supplier, gstin_recipient, hsn_code,
                             taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                             igst_rate, igst_amount, total_tax, supply_type,
                             transaction_date, financial_year, quarter, month, created_at)
                         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                        [
                            $tid, $invoiceId,
                            $vendorGstin4,
                            $li['hsn_code'] ?? null,
                            $taxable4,
                            $cgstR4, $cgstA4, $sgstR4, $sgstA4, $igstR4, $igstA4,
                            $totalTax4,
                            $supplyType4,
                            $invDate4, $fyString4, $quarter4, $month4,
                        ]
                    );
                }
            }
        }

        Response::success($this->findOrFail($invoiceId, $tid), 'Manual invoice created', 201);
    }

    // ─── GET /admin/scan-invoices/{id}/status ────────────────────────────────
    public function status(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $row = Database::fetch(
            'SELECT invoice_id, processing_status, ai_confidence_score, error_message FROM scan_invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tid]
        );
        if (!$row) Response::error('Invoice not found', 404);

        $stageData = [];
        if ($row['error_message']) {
            $stageData = json_decode((string)$row['error_message'], true) ?: [];
        }
        $progress = $stageData['progress'] ?? match ($row['processing_status']) {
            'pending'    => 5,
            'processing' => 30,
            'review', 'approved' => 100,
            'error'      => 0,
            default      => 50,
        };

        Response::success([
            'invoice_id'        => (int)$row['invoice_id'],
            'status'            => $row['processing_status'],
            'stage'             => $stageData['stage'] ?? $row['processing_status'],
            'progress'          => $progress,
            'ai_confidence_score' => $row['ai_confidence_score'] ? (float)$row['ai_confidence_score'] : null,
        ]);
    }

    // ─── PUT /admin/scan-invoices/{id}/approve — Full cascade with 3-tier inventory ─────
    public function approve(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $inv = $this->findOrFail($id, $tid);

        // ── Idempotent: already approved → return immediately ────────────────
        if ($inv['processing_status'] === 'approved') {
            Response::success($inv, 'Invoice already approved');
            return;
        }

        if (!in_array($inv['processing_status'], ['review','pending'], true)) {
            Response::error('Invoice must be in review or pending status to approve', 422);
        }

        $validated = $request->input('validated_data');
        if (!is_array($validated)) {
            $validated = is_string($request->input('validated_data'))
                ? json_decode($request->input('validated_data'), true)
                : null;
        }
        if (!is_array($validated)) {
            $validated = $inv['validated_data'] ? json_decode((string)$inv['validated_data'], true) : [];
        }

        $lineItems    = (array)($validated['line_items'] ?? []);
        $invDate      = $validated['invoice_date'] ?? $inv['invoice_date'] ?? date('Y-m-d');
        $subtotal     = (float)($validated['subtotal']     ?? $inv['subtotal']);
        $taxAmount    = (float)($validated['tax_amount']   ?? $inv['tax_amount']);
        $totalAmount  = (float)($validated['total_amount'] ?? $inv['total_amount']);
        $vendorGstin  = $validated['vendor_gstin'] ?? $inv['vendor_gstin'];
        $shipping     = (float)($validated['shipping_charges']  ?? $inv['shipping_charges'] ?? 0);
        $commission   = (float)($validated['commission_amount'] ?? $inv['commission_amount'] ?? 0);
        $custName     = $validated['customer_name'] ?? null;
        $custGstin    = $validated['customer_gstin'] ?? null;
        $marketplace  = $inv['marketplace'];
        $invoiceType  = $inv['invoice_type'] ?? 'sale';
        $isCreditSale = (int)($inv['is_credit_sale'] ?? 0);
        $creditDays   = (int)($inv['credit_days'] ?? 30);
        $isDamaged    = (int)($inv['is_damaged'] ?? 0);

        // GST supply type: use GSTIN state codes if available
        $supplyType = $this->determineSupplyType($vendorGstin, $custGstin);

        // Ensure invoice_payments table exists BEFORE starting transaction
        // (CREATE TABLE causes implicit commit in MySQL — must run outside transaction)
        $this->ensurePaymentsTable();

        Database::beginTransaction();
        try {
            // ─ Step 1: Update invoice ──────────────────────────────────────────
            Database::execute(
                'UPDATE scan_invoices
                 SET invoice_number = COALESCE(?, invoice_number),
                     invoice_date   = COALESCE(?, invoice_date),
                     vendor_name    = COALESCE(?, vendor_name),
                     vendor_gstin   = COALESCE(?, vendor_gstin),
                     subtotal = ?, tax_amount = ?, total_amount = ?,
                     shipping_charges = ?, commission_amount = ?,
                     processing_status = "approved", approved_at = NOW(), updated_at = NOW()
                 WHERE invoice_id = ? AND tenant_id = ?',
                [
                    $validated['invoice_number'] ?? null,
                    $invDate,
                    $validated['vendor_name'] ?? null,
                    $vendorGstin,
                    $subtotal, $taxAmount, $totalAmount, $shipping, $commission,
                    $id, $tid,
                ]
            );

            // ─ Step 2: Rebuild line items ──────────────────────────────────────
            Database::execute('DELETE FROM scan_invoice_line_items WHERE invoice_id = ?', [$id]);
            foreach ($lineItems as $item) {
                $sku       = trim((string)($item['sku'] ?? '')) ?: null;
                $qty       = (float)($item['quantity']     ?? 0);
                $price     = (float)($item['unit_price']   ?? 0);
                $discount  = (float)($item['discount']     ?? 0);
                $taxable   = (float)($item['taxable_value'] ?? round($qty * $price - $discount, 2));
                $cgstR     = (float)($item['cgst_rate']    ?? 0); $cgstA = (float)($item['cgst_amount'] ?? round($taxable * $cgstR / 100, 2));
                $sgstR     = (float)($item['sgst_rate']    ?? 0); $sgstA = (float)($item['sgst_amount'] ?? round($taxable * $sgstR / 100, 2));
                $igstR     = (float)($item['igst_rate']    ?? 0); $igstA = (float)($item['igst_amount'] ?? round($taxable * $igstR / 100, 2));
                $lineTotal = (float)($item['total_amount'] ?? round($taxable + $cgstA + $sgstA + $igstA, 2));
                $productName = Request::sanitize(trim((string)($item['product_name'] ?? '')));

                // Find product_id via SKU for FK reference
                $productId = null;
                if ($sku) {
                    $p = Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku]);
                    if ($p) $productId = (int)$p['product_id'];
                }

                Database::insert(
                    'INSERT INTO scan_invoice_line_items
                        (invoice_id, product_id, sku, product_name, hsn_code, quantity, unit_price, discount,
                         taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                         total_amount, confidence_score, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                    [
                        $id, $productId, $sku, $productName, $item['hsn_code'] ?? null,
                        $qty, $price, $discount, $taxable,
                        $cgstR, $cgstA, $sgstR, $sgstA, $igstR, $igstA,
                        $lineTotal, $item['confidence_score'] ?? null,
                    ]
                );

                // ─ Step 3: Inventory deduction — 3-tier lookup ────────────────
                if ($qty > 0) {
                    $this->deductInventory($tid, $id, $productName, $sku, $qty, $isDamaged, $invoiceType);
                }
            }

            // ─ Step 4: Customer upsert ────────────────────────────────────────
            $customerId   = null;
            $custAddress  = $validated['customer_address'] ?? null;
            $custCity = $custState = $custPincode = null;
            if ($custAddress) {
                // Flipkart format: "..., Alappuzha - 689511, IN-KL"
                if (preg_match('/([A-Za-z][A-Za-z\s]+?)\s*[-–]\s*(\d{6}),?\s*IN[-–]([A-Z]{2})\s*$/i', $custAddress, $am)) {
                    $custCity    = trim($am[1]);
                    $custPincode = trim($am[2]);
                    $custState   = 'IN-' . trim($am[3]);
                }
                // Generic: "... City - Pincode, STATE" or "City, STATE PINCODE"
                elseif (preg_match('/,?\s*([A-Z][A-Za-z\s]+?)\s*[-–,]\s*(\d{6})\s*(?:,\s*([A-Z]{2,}))?\s*$/i', $custAddress, $am)) {
                    $custCity    = trim($am[1]);
                    $custPincode = trim($am[2]);
                    if (!empty($am[3])) $custState = trim($am[3]);
                }
                // Last resort: just pincode
                elseif (preg_match('/(\d{6})/', $custAddress, $am)) {
                    $custPincode = trim($am[1]);
                }
            }
            if ($custName) {
                $existCust = $custGstin
                    ? Database::fetch('SELECT customer_id FROM invoice_customers WHERE tenant_id = ? AND gstin = ? LIMIT 1', [$tid, strtoupper($custGstin)])
                    : Database::fetch('SELECT customer_id FROM invoice_customers WHERE tenant_id = ? AND name = ? LIMIT 1', [$tid, $custName]);
                if ($existCust) {
                    $customerId = (int)$existCust['customer_id'];
                    // Update name + fill in address if not already set
                    $sets = ['name = ?', 'updated_at = NOW()'];
                    $ups  = [Request::sanitize($custName)];
                    if ($custAddress) { $sets[] = 'address_line1 = COALESCE(NULLIF(address_line1,""), ?)'; $ups[] = Request::sanitize($custAddress); }
                    if ($custCity)    { $sets[] = 'city = COALESCE(NULLIF(city,""), ?)';                   $ups[] = Request::sanitize($custCity); }
                    if ($custState)   { $sets[] = 'state = COALESCE(NULLIF(state,""), ?)';                 $ups[] = Request::sanitize($custState); }
                    if ($custPincode) { $sets[] = 'pincode = COALESCE(NULLIF(pincode,""), ?)';             $ups[] = $custPincode; }
                    $ups[] = $customerId; $ups[] = $tid;
                    Database::execute('UPDATE invoice_customers SET ' . implode(', ', $sets) . ' WHERE customer_id = ? AND tenant_id = ?', $ups);
                } else {
                    $customerId = Database::insert(
                        'INSERT INTO invoice_customers (tenant_id, name, gstin, customer_type, address_line1, city, state, pincode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                        [$tid, Request::sanitize($custName), $custGstin ? strtoupper($custGstin) : null, $custGstin ? 'b2b' : 'b2c',
                         $custAddress ? Request::sanitize($custAddress) : null,
                         $custCity ? Request::sanitize($custCity) : null,
                         $custState ? Request::sanitize($custState) : null,
                         $custPincode ?: null]
                    );
                }
                Database::execute('UPDATE scan_invoices SET customer_id = ?, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?',
                    [$customerId, $id, $tid]);
            }

            // ─ Step 5: Sales order (only for sale/commission/return types) ────
            if (in_array($invoiceType, ['sale','commission','return'], true)) {
                $netRevenue = round($totalAmount - $shipping - $commission, 2);
                $orderStatus = $invoiceType === 'return' ? 'returned' : 'completed';
                Database::insert(
                    'INSERT INTO marketplace_sales_orders
                        (tenant_id, invoice_id, customer_id, order_number, order_date, marketplace,
                         subtotal, discount, tax_amount, shipping_charges, commission_amount,
                         total_amount, net_revenue, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NOW())',
                    [$tid, $id, $customerId, 'SO-' . $id, $invDate ?: date('Y-m-d'), $marketplace,
                     $subtotal, $taxAmount, $shipping, $commission, $totalAmount, $netRevenue, $orderStatus]
                );
                // Update customer lifetime_revenue
                if ($customerId && $invoiceType === 'sale') {
                    Database::execute(
                        'UPDATE invoice_customers SET lifetime_revenue = lifetime_revenue + ?, updated_at = NOW() WHERE customer_id = ? AND tenant_id = ?',
                        [$totalAmount, $customerId, $tid]
                    );
                }
                // Auto-record payment — every approved sale creates a "received" payment entry
                if ($invoiceType === 'sale' && $totalAmount > 0) {
                    $custNameForPmt = $custName ?: ($validated['vendor_name'] ?? null);
                    Database::insert(
                        'INSERT INTO invoice_payments
                            (tenant_id, invoice_id, payment_date, amount, payment_method, payment_type, party_name, notes, created_at)
                         VALUES (?, ?, ?, ?, ?, "received", ?, ?, NOW())',
                        [$tid, $id, $invDate ?: date('Y-m-d'), $totalAmount, $marketplace,
                         $custNameForPmt, 'Auto-recorded on invoice approval']
                    );
                }
            }

            // ─ Step 5b: Credit Sale → Outstanding Entry ───────────────────────
            // Allow B2C sales (no customer GSTIN) — use customer name if available,
            // fall back to vendor name or "Cash Sale" for anonymous B2C
            if ($isCreditSale && $invoiceType === 'sale') {
                $partyName = $custName ?: ($validated['vendor_name'] ?? $inv['vendor_name'] ?? 'Cash Sale');
                $dueDate   = date('Y-m-d', strtotime(($invDate ?: date('Y-m-d')) . ' +' . $creditDays . ' days'));
                // Remove existing entry for this invoice if re-approving
                Database::execute('DELETE FROM outstanding_entries WHERE invoice_id = ? AND tenant_id = ?', [$id, $tid]);
                Database::insert(
                    'INSERT INTO outstanding_entries
                        (tenant_id, invoice_id, type, party_name, party_gstin, invoice_number,
                         invoice_date, due_date, total_amount, paid_amount, balance_amount, credit_days, created_at)
                     VALUES (?, ?, "receivable", ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())',
                    [$tid, $id, $partyName, $custGstin, $validated['invoice_number'] ?? null,
                     $invDate, $dueDate, $totalAmount, $totalAmount, $creditDays]
                );
            }

            // ─ Step 5c: Commission invoice → auto-post to expenses ────────────
            if ($invoiceType === 'commission' && $commission > 0) {
                Database::insert(
                    'INSERT INTO marketplace_expenses
                        (tenant_id, invoice_id, category, description, amount, expense_date, marketplace, created_at)
                     VALUES (?, ?, "Marketplace Commission", ?, ?, ?, ?, NOW())',
                    [$tid, $id,
                     ucfirst($marketplace) . ' Commission — ' . ($validated['invoice_number'] ?? 'Invoice #' . $id),
                     $commission, $invDate ?: date('Y-m-d'), $marketplace]
                );
            }

            // ─ Step 6: GST records (one per line item) ────────────────────────
            $invDateObj = new \DateTimeImmutable($invDate ?: date('Y-m-d'));
            $month      = (int)$invDateObj->format('n');
            $year       = (int)$invDateObj->format('Y');
            $fyStart    = ($month >= 4) ? $year : $year - 1;
            $fyString   = $fyStart . '-' . substr((string)($fyStart + 1), 2);
            $quarter    = match (true) {
                in_array($month, [4,5,6])    => 1,
                in_array($month, [7,8,9])    => 2,
                in_array($month, [10,11,12]) => 3,
                default                      => 4,
            };

            $insertedItems = Database::fetchAll(
                'SELECT line_item_id, cgst_amount, sgst_amount, igst_amount, taxable_value, hsn_code,
                        cgst_rate, sgst_rate, igst_rate
                 FROM scan_invoice_line_items WHERE invoice_id = ?', [$id]
            );
            foreach ($insertedItems as $li) {
                $totalTax = (float)$li['cgst_amount'] + (float)$li['sgst_amount'] + (float)$li['igst_amount'];
                if ($totalTax <= 0 && (float)$li['taxable_value'] <= 0) continue;
                Database::insert(
                    'INSERT INTO gst_records
                        (tenant_id, invoice_id, line_item_id, gstin_supplier, gstin_recipient, hsn_code,
                         taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                         total_tax, supply_type, transaction_date, financial_year, quarter, month, created_at)
                     SELECT tenant_id, ?, ?, ?, ?, hsn_code,
                            taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                            (cgst_amount + sgst_amount + igst_amount), ?, ?, ?, ?, ?, NOW()
                     FROM scan_invoice_line_items WHERE line_item_id = ?',
                    [$id, (int)$li['line_item_id'], $vendorGstin, $custGstin,
                     $supplyType, $invDate ?: date('Y-m-d'), $fyString, $quarter, $month,
                     (int)$li['line_item_id']]
                );
            }

            // ─ Step 7: Journal entries ────────────────────────────────────────
            $entryDate = $invDate ?: date('Y-m-d');
            if ($subtotal > 0) {
                Database::insert(
                    'INSERT INTO invoice_journal_entries
                        (tenant_id, invoice_id, entry_date, entry_number, description, debit_account, credit_account, amount, created_at)
                     VALUES (?, ?, ?, ?, ?, "Accounts Receivable", "Sales Revenue", ?, NOW())',
                    [$tid, $id, $entryDate, 'JE-' . $id . '-01', 'Sales from invoice #' . $id, $subtotal]
                );
            }
            if ($taxAmount > 0) {
                Database::insert(
                    'INSERT INTO invoice_journal_entries
                        (tenant_id, invoice_id, entry_date, entry_number, description, debit_account, credit_account, amount, created_at)
                     VALUES (?, ?, ?, ?, ?, "Tax Receivable", "GST Payable", ?, NOW())',
                    [$tid, $id, $entryDate, 'JE-' . $id . '-02', 'GST for invoice #' . $id, $taxAmount]
                );
            }
            if ($commission > 0) {
                Database::insert(
                    'INSERT INTO invoice_journal_entries
                        (tenant_id, invoice_id, entry_date, entry_number, description, debit_account, credit_account, amount, created_at)
                     VALUES (?, ?, ?, ?, ?, "Marketplace Commission Expense", "Accounts Payable", ?, NOW())',
                    [$tid, $id, $entryDate, 'JE-' . $id . '-03', 'Commission for invoice #' . $id, $commission]
                );
            }

            // ─ Step 8: Notifications (already handled inside deductInventory) ─

            // ─ Step 9: Audit log ──────────────────────────────────────────────
            $userId = $request->user['user_id'] ?? null;
            Database::insert(
                'INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, new_value, ip_address, created_at)
                 VALUES (?, ?, "invoice_approved", "scan_invoices", ?, ?, ?, NOW())',
                [$tid, $userId, $id,
                 json_encode(['total_amount' => $totalAmount, 'marketplace' => $marketplace, 'invoice_type' => $invoiceType]),
                 $request->ip() ?? null]
            );

            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            error_log('[InvoiceApprove] ' . $e->getMessage() . ' line ' . $e->getLine());
            Response::error('Approval failed: ' . $e->getMessage(), 500);
        }

        Response::success($this->findOrFail($id, $tid), 'Invoice approved successfully');
    }

    /**
     * 3-tier inventory deduction:
     * Tier 1 — Product name mapping (primary, supports combo)
     * Tier 2 — SKU exact match
     * Tier 3 — No match → notification
     *
     * @param int    $isDamaged  1 = route to damaged_stock instead of current_stock
     * @param string $invoiceType 'return' = add stock, 'sale'/'commission' = deduct
     */
    private function deductInventory(int $tid, int $invoiceId, string $productName, ?string $sku, float $qty, int $isDamaged, string $invoiceType): void
    {
        $isReturn = ($invoiceType === 'return');
        $qty      = (int)round($qty);
        if ($qty <= 0) return;

        // Tier 1 — product name mapping
        $normalized = AdminProductMappingController::normalizeName($productName);
        $mapping = Database::fetch(
            'SELECT mapping_id FROM product_mappings WHERE tenant_id = ? AND invoice_product_name = ? LIMIT 1',
            [$tid, $normalized]
        );

        if ($mapping) {
            $items = Database::fetchAll(
                'SELECT product_id, quantity FROM product_mapping_items WHERE mapping_id = ? AND tenant_id = ?',
                [(int)$mapping['mapping_id'], $tid]
            );
            foreach ($items as $mapItem) {
                $deductQty = (int)round((float)$mapItem['quantity'] * $qty);
                $this->applyStockChange($tid, $invoiceId, (int)$mapItem['product_id'], $deductQty, $isReturn, $isDamaged, $invoiceType);
            }
            return;
        }

        // Tier 2 — SKU exact match
        if ($sku) {
            $prod = Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku]);
            if ($prod) {
                $this->applyStockChange($tid, $invoiceId, (int)$prod['product_id'], $qty, $isReturn, $isDamaged, $invoiceType);
                return;
            }
        }

        // Tier 3 — no match → notification
        Database::insert(
            'INSERT INTO invoice_notifications (tenant_id, type, title, message, data, created_at) VALUES (?, "inventory_warning", ?, ?, ?, NOW())',
            [
                $tid,
                'Product Not Found',
                "Product '{$productName}' not found in inventory. Create a product mapping to track stock.",
                json_encode(['product_name' => $productName, 'sku' => $sku, 'invoice_id' => $invoiceId]),
            ]
        );
    }

    private function applyStockChange(int $tid, int $invoiceId, int $productId, int $qty, bool $isReturn, int $isDamaged, string $invoiceType): void
    {
        $prod = Database::fetch(
            'SELECT product_id, current_stock, min_stock_level, damaged_stock, sku FROM invoice_products WHERE product_id = ? AND tenant_id = ? LIMIT 1',
            [$productId, $tid]
        );
        if (!$prod) return;

        $before = (int)$prod['current_stock'];
        $txType = $isReturn ? 'return' : ($invoiceType === 'purchase' ? 'purchase' : 'sale');

        if ($isReturn && $isDamaged) {
            // Damaged return → add to damaged_stock, NOT current_stock
            $damagedBefore = (int)($prod['damaged_stock'] ?? 0);
            $damagedAfter  = $damagedBefore + $qty;
            Database::execute(
                'UPDATE invoice_products SET damaged_stock = ?, updated_at = NOW() WHERE product_id = ? AND tenant_id = ?',
                [$damagedAfter, $productId, $tid]
            );
            Database::insert(
                'INSERT INTO invoice_inventory_transactions
                    (tenant_id, product_id, invoice_id, transaction_type, quantity_change, stock_before, stock_after, notes, created_at)
                 VALUES (?, ?, ?, "return", ?, ?, ?, "Damaged return - added to damaged_stock", NOW())',
                [$tid, $productId, $invoiceId, $qty, $damagedBefore, $damagedAfter]
            );
            return;
        }

        if ($isReturn) {
            // Regular return → restore current_stock
            $after = $before + $qty;
        } elseif ($invoiceType === 'purchase') {
            $after = $before + $qty;
        } else {
            $after = max(0, $before - $qty);
        }

        Database::execute(
            'UPDATE invoice_products SET current_stock = ?, updated_at = NOW() WHERE product_id = ? AND tenant_id = ?',
            [$after, $productId, $tid]
        );
        Database::insert(
            'INSERT INTO invoice_inventory_transactions
                (tenant_id, product_id, invoice_id, transaction_type, quantity_change, stock_before, stock_after, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [$tid, $productId, $invoiceId, $txType, ($isReturn || $invoiceType === 'purchase') ? $qty : -$qty, $before, $after]
        );

        // Low stock notification
        $minLevel = (int)($prod['min_stock_level'] ?? 5);
        if (!$isReturn && $after <= $minLevel && $after >= 0) {
            $type = $after === 0 ? 'inventory_warning' : 'low_stock';
            $msg  = $after === 0
                ? "Product SKU '{$prod['sku']}' is now out of stock."
                : "Product SKU '{$prod['sku']}' has only {$after} units left (min: {$minLevel}).";
            Database::insert(
                'INSERT INTO invoice_notifications (tenant_id, type, title, message, data, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [$tid, $type, $after === 0 ? 'Out of Stock' : 'Low Stock Alert', $msg,
                 json_encode(['product_id' => $productId, 'stock_after' => $after, 'min_level' => $minLevel])]
            );
        }
    }

    /**
     * Determine GST supply type using GSTIN state codes.
     * Intra-state → 'b2b' (CGST+SGST), Inter-state → 'b2b_igst'
     * No GSTINs → 'b2c'
     */
    private function determineSupplyType(?string $vendorGstin, ?string $custGstin): string
    {
        if (!$vendorGstin || !$custGstin) return 'b2c';
        $supplierState  = substr(strtoupper($vendorGstin), 0, 2);
        $recipientState = substr(strtoupper($custGstin), 0, 2);
        // Both are numeric state codes → same state = intra-state (CGST+SGST)
        if ($supplierState === $recipientState) return 'b2b';
        return 'b2b';  // inter-state still b2b for supply_type enum; IGST determined by rates
    }

    // ─── POST /admin/scan-invoices/auto-approve ──────────────────────────────
    // Auto-approves all invoices in 'review' status.
    // For each invoice: checks if all line item product names have mappings.
    // If all mapped → approves. If any unmapped → skips with 'mapping_required' status tag.
    public function autoApprove(Request $request): void
    {
        $tid = Database::tenantId();

        // Get all invoices in review status
        $reviewInvoices = Database::fetchAll(
            'SELECT invoice_id, invoice_type, is_credit_sale, credit_days,
                    validated_data, extracted_data, vendor_gstin
             FROM scan_invoices
             WHERE tenant_id = ? AND processing_status = "review"
             ORDER BY created_at ASC',
            [$tid]
        );

        $approved   = [];
        $skipped    = [];
        $errors     = [];

        foreach ($reviewInvoices as $inv) {
            $invoiceId = (int)$inv['invoice_id'];

            // Get line items to check mappings
            $validated   = $inv['validated_data'] ? json_decode((string)$inv['validated_data'], true) : [];
            $extracted   = $inv['extracted_data']  ? json_decode((string)$inv['extracted_data'],  true) : [];
            $lineItems   = (array)($validated['line_items'] ?? $extracted['line_items'] ?? []);

            // Check every product name has a mapping or SKU
            $unmappedNames = [];
            foreach ($lineItems as $item) {
                $productName = (string)($item['product_name'] ?? '');
                $sku         = trim((string)($item['sku'] ?? ''));

                // Tier 1: product name mapping
                $normalized  = AdminProductMappingController::normalizeName($productName);
                $hasMapping  = Database::fetch(
                    'SELECT mapping_id FROM product_mappings WHERE tenant_id = ? AND invoice_product_name = ? LIMIT 1',
                    [$tid, $normalized]
                );
                if ($hasMapping) continue;

                // Tier 2: SKU exists in catalog
                if ($sku) {
                    $hasSku = Database::fetch(
                        'SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1',
                        [$tid, $sku]
                    );
                    if ($hasSku) continue;
                }

                // Neither found — unmapped
                $unmappedNames[] = $productName;
            }

            if (!empty($unmappedNames)) {
                // Mark as needing mapping — add tag to error_message JSON
                Database::execute(
                    'UPDATE scan_invoices SET error_message = ?, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?',
                    [json_encode(['mapping_required' => true, 'unmapped' => $unmappedNames]), $invoiceId, $tid]
                );
                $skipped[] = ['invoice_id' => $invoiceId, 'unmapped' => $unmappedNames];
                continue;
            }

            // All products mapped → approve
            try {
                // Simulate approve request
                $fakeRequest = clone $request;
                $result = $this->approveInvoice($invoiceId, $tid, $validated ?: $extracted, $request);
                $approved[] = $invoiceId;
            } catch (\Throwable $e) {
                error_log('[AutoApprove] Invoice #' . $invoiceId . ' failed: ' . $e->getMessage());
                $errors[] = ['invoice_id' => $invoiceId, 'error' => $e->getMessage()];
            }
        }

        Response::success([
            'approved'       => $approved,
            'approved_count' => count($approved),
            'skipped'        => $skipped,
            'skipped_count'  => count($skipped),
            'errors'         => $errors,
            'error_count'    => count($errors),
        ], count($approved) . ' invoice(s) approved, ' . count($skipped) . ' need mapping');
    }

    // Internal approve helper used by autoApprove
    private function approveInvoice(int $id, int $tid, array $validated, Request $request): void
    {
        $inv = $this->findOrFail($id, $tid);
        if ($inv['processing_status'] === 'approved') return;

        $lineItems    = (array)($validated['line_items'] ?? []);
        $invDate      = $validated['invoice_date'] ?? $inv['invoice_date'] ?? date('Y-m-d');
        $subtotal     = (float)($validated['subtotal']     ?? $inv['subtotal']);
        $taxAmount    = (float)($validated['tax_amount']   ?? $inv['tax_amount']);
        $totalAmount  = (float)($validated['total_amount'] ?? $inv['total_amount']);
        $vendorGstin  = $validated['vendor_gstin'] ?? $inv['vendor_gstin'];
        $shipping     = (float)($validated['shipping_charges']  ?? $inv['shipping_charges'] ?? 0);
        $commission   = (float)($validated['commission_amount'] ?? $inv['commission_amount'] ?? 0);
        $custName     = $validated['customer_name'] ?? null;
        $custGstin    = $validated['customer_gstin'] ?? null;
        $marketplace  = $inv['marketplace'];
        $invoiceType  = $inv['invoice_type'] ?? 'sale';
        $isCreditSale = (int)($inv['is_credit_sale'] ?? 0);
        $creditDays   = (int)($inv['credit_days'] ?? 30);
        $isDamaged    = (int)($inv['is_damaged'] ?? 0);
        $supplyType   = $this->determineSupplyType($vendorGstin, $custGstin);

        // Ensure table outside transaction to avoid MySQL implicit commit
        $this->ensurePaymentsTable();

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE scan_invoices SET processing_status = "approved", approved_at = NOW(), updated_at = NOW(),
                 error_message = NULL WHERE invoice_id = ? AND tenant_id = ?',
                [$id, $tid]
            );

            Database::execute('DELETE FROM scan_invoice_line_items WHERE invoice_id = ?', [$id]);
            foreach ($lineItems as $item) {
                $sku        = trim((string)($item['sku'] ?? '')) ?: null;
                $qty        = (float)($item['quantity']     ?? 0);
                $price      = (float)($item['unit_price']   ?? 0);
                $discount   = (float)($item['discount']     ?? 0);
                $taxable    = (float)($item['taxable_value'] ?? round($qty * $price - $discount, 2));
                $cgstR      = (float)($item['cgst_rate'] ?? 0); $cgstA = (float)($item['cgst_amount'] ?? round($taxable * $cgstR / 100, 2));
                $sgstR      = (float)($item['sgst_rate'] ?? 0); $sgstA = (float)($item['sgst_amount'] ?? round($taxable * $sgstR / 100, 2));
                $igstR      = (float)($item['igst_rate'] ?? 0); $igstA = (float)($item['igst_amount'] ?? round($taxable * $igstR / 100, 2));
                $lineTotal  = round($taxable + $cgstA + $sgstA + $igstA, 2);
                $productId  = null;
                if ($sku) {
                    $p = Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku]);
                    if ($p) $productId = (int)$p['product_id'];
                }
                Database::insert(
                    'INSERT INTO scan_invoice_line_items
                        (invoice_id, product_id, sku, product_name, hsn_code, quantity, unit_price, discount,
                         taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
                         total_amount, confidence_score, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                    [$id, $productId, $sku, Request::sanitize(trim((string)($item['product_name'] ?? ''))),
                     $item['hsn_code'] ?? null, $qty, $price, $discount, $taxable,
                     $cgstR, $cgstA, $sgstR, $sgstA, $igstR, $igstA, $lineTotal, $item['confidence_score'] ?? null]
                );
                if ($qty > 0) $this->deductInventory($tid, $id, (string)($item['product_name'] ?? ''), $sku, $qty, $isDamaged, $invoiceType);
            }

            // Customer, sales order, outstanding, GST, journal — reuse the same logic
            $customerId = null;
            $custAddress2 = $validated['customer_address'] ?? null;
            $custCity2 = $custState2 = $custPincode2 = null;
            if ($custAddress2) {
                // Flipkart: "..., Alappuzha - 689511, IN-KL"
                if (preg_match('/([A-Za-z][A-Za-z\s]+?)\s*[-–]\s*(\d{6}),?\s*IN[-–]([A-Z]{2})\s*$/i', $custAddress2, $am2)) {
                    $custCity2    = trim($am2[1]);
                    $custPincode2 = trim($am2[2]);
                    $custState2   = 'IN-' . trim($am2[3]);
                } elseif (preg_match('/,?\s*([A-Z][A-Za-z\s]+?)\s*[-–,]\s*(\d{6})\s*(?:,\s*([A-Z]{2,}))?\s*$/i', $custAddress2, $am2)) {
                    $custCity2    = trim($am2[1]);
                    $custPincode2 = trim($am2[2]);
                    if (!empty($am2[3])) $custState2 = trim($am2[3]);
                } elseif (preg_match('/(\d{6})/', $custAddress2, $am2)) {
                    $custPincode2 = trim($am2[1]);
                }
            }
            if ($custName) {
                $existCust = $custGstin
                    ? Database::fetch('SELECT customer_id FROM invoice_customers WHERE tenant_id = ? AND gstin = ? LIMIT 1', [$tid, strtoupper($custGstin)])
                    : Database::fetch('SELECT customer_id FROM invoice_customers WHERE tenant_id = ? AND name = ? LIMIT 1', [$tid, $custName]);
                if ($existCust) {
                    $customerId = (int)$existCust['customer_id'];
                    $sets2 = ['name = ?', 'updated_at = NOW()']; $ups2 = [Request::sanitize($custName)];
                    if ($custAddress2) { $sets2[] = 'address_line1 = COALESCE(NULLIF(address_line1,""), ?)'; $ups2[] = Request::sanitize($custAddress2); }
                    if ($custCity2)    { $sets2[] = 'city = COALESCE(NULLIF(city,""), ?)';                   $ups2[] = Request::sanitize($custCity2); }
                    if ($custState2)   { $sets2[] = 'state = COALESCE(NULLIF(state,""), ?)';                 $ups2[] = Request::sanitize($custState2); }
                    if ($custPincode2) { $sets2[] = 'pincode = COALESCE(NULLIF(pincode,""), ?)';             $ups2[] = $custPincode2; }
                    $ups2[] = $customerId; $ups2[] = $tid;
                    Database::execute('UPDATE invoice_customers SET ' . implode(', ', $sets2) . ' WHERE customer_id = ? AND tenant_id = ?', $ups2);
                } else {
                    $customerId = Database::insert(
                        'INSERT INTO invoice_customers (tenant_id, name, gstin, customer_type, address_line1, city, state, pincode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                        [$tid, Request::sanitize($custName), $custGstin ? strtoupper($custGstin) : null, $custGstin ? 'b2b' : 'b2c',
                         $custAddress2 ? Request::sanitize($custAddress2) : null,
                         $custCity2 ? Request::sanitize($custCity2) : null,
                         $custState2 ? Request::sanitize($custState2) : null,
                         $custPincode2 ?: null]
                    );
                }
                Database::execute('UPDATE scan_invoices SET customer_id = ? WHERE invoice_id = ? AND tenant_id = ?', [$customerId, $id, $tid]);
            }

            if (in_array($invoiceType, ['sale','commission','return'], true)) {
                $netRevenue  = round($totalAmount - $shipping - $commission, 2);
                $orderStatus = $invoiceType === 'return' ? 'returned' : 'completed';
                Database::insert(
                    'INSERT INTO marketplace_sales_orders (tenant_id, invoice_id, customer_id, order_number, order_date, marketplace, subtotal, discount, tax_amount, shipping_charges, commission_amount, total_amount, net_revenue, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NOW())',
                    [$tid, $id, $customerId, 'SO-' . $id, $invDate ?: date('Y-m-d'), $marketplace, $subtotal, $taxAmount, $shipping, $commission, $totalAmount, $netRevenue, $orderStatus]
                );
                if ($customerId && $invoiceType === 'sale') {
                    Database::execute(
                        'UPDATE invoice_customers SET lifetime_revenue = lifetime_revenue + ?, updated_at = NOW() WHERE customer_id = ? AND tenant_id = ?',
                        [$totalAmount, $customerId, $tid]
                    );
                }
                // Auto-record payment (autoApprove path)
                if ($invoiceType === 'sale' && $totalAmount > 0) {
                    $custNameForPmt2 = $custName ?: ($validated['vendor_name'] ?? null);
                    Database::insert(
                        'INSERT INTO invoice_payments
                            (tenant_id, invoice_id, payment_date, amount, payment_method, payment_type, party_name, notes, created_at)
                         VALUES (?, ?, ?, ?, ?, "received", ?, ?, NOW())',
                        [$tid, $id, $invDate ?: date('Y-m-d'), $totalAmount, $marketplace,
                         $custNameForPmt2, 'Auto-recorded on invoice approval']
                    );
                }
            }

            if ($isCreditSale && $invoiceType === 'sale') {
                $partyName = $custName ?: ($validated['vendor_name'] ?? $inv['vendor_name'] ?? 'Cash Sale');
                $dueDate   = date('Y-m-d', strtotime(($invDate ?: date('Y-m-d')) . ' +' . $creditDays . ' days'));
                Database::execute('DELETE FROM outstanding_entries WHERE invoice_id = ? AND tenant_id = ?', [$id, $tid]);
                Database::insert(
                    'INSERT INTO outstanding_entries (tenant_id, invoice_id, type, party_name, party_gstin, invoice_number, invoice_date, due_date, total_amount, paid_amount, balance_amount, credit_days, created_at) VALUES (?, ?, "receivable", ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())',
                    [$tid, $id, $partyName, $custGstin, $validated['invoice_number'] ?? null, $invDate, $dueDate, $totalAmount, $totalAmount, $creditDays]
                );
            }

            // GST records
            $invDateObj = new \DateTimeImmutable($invDate ?: date('Y-m-d'));
            $month      = (int)$invDateObj->format('n');
            $year       = (int)$invDateObj->format('Y');
            $fyStart    = ($month >= 4) ? $year : $year - 1;
            $fyString   = $fyStart . '-' . substr((string)($fyStart + 1), 2);
            $quarter    = match (true) { in_array($month,[4,5,6])=>1, in_array($month,[7,8,9])=>2, in_array($month,[10,11,12])=>3, default=>4 };
            $insertedItems = Database::fetchAll('SELECT line_item_id, cgst_amount, sgst_amount, igst_amount, taxable_value FROM scan_invoice_line_items WHERE invoice_id = ?', [$id]);
            foreach ($insertedItems as $li) {
                $totalTax = (float)$li['cgst_amount'] + (float)$li['sgst_amount'] + (float)$li['igst_amount'];
                if ($totalTax <= 0 && (float)$li['taxable_value'] <= 0) continue;
                Database::insert(
                    'INSERT INTO gst_records (tenant_id, invoice_id, line_item_id, gstin_supplier, gstin_recipient, hsn_code, taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_tax, supply_type, transaction_date, financial_year, quarter, month, created_at) SELECT tenant_id, ?, ?, ?, ?, hsn_code, taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, (cgst_amount+sgst_amount+igst_amount), ?, ?, ?, ?, ?, NOW() FROM scan_invoice_line_items WHERE line_item_id = ?',
                    [$id, (int)$li['line_item_id'], $vendorGstin, $custGstin, $supplyType, $invDate ?: date('Y-m-d'), $fyString, $quarter, $month, (int)$li['line_item_id']]
                );
            }

            $entryDate = $invDate ?: date('Y-m-d');
            if ($subtotal > 0) Database::insert('INSERT INTO invoice_journal_entries (tenant_id, invoice_id, entry_date, entry_number, description, debit_account, credit_account, amount, created_at) VALUES (?, ?, ?, ?, ?, "Accounts Receivable", "Sales Revenue", ?, NOW())', [$tid, $id, $entryDate, 'JE-'.$id.'-01', 'Auto-approved invoice #'.$id, $subtotal]);
            if ($taxAmount > 0) Database::insert('INSERT INTO invoice_journal_entries (tenant_id, invoice_id, entry_date, entry_number, description, debit_account, credit_account, amount, created_at) VALUES (?, ?, ?, ?, ?, "Tax Receivable", "GST Payable", ?, NOW())', [$tid, $id, $entryDate, 'JE-'.$id.'-02', 'GST invoice #'.$id, $taxAmount]);

            $userId = $request->user['user_id'] ?? null;
            Database::insert('INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, new_value, created_at) VALUES (?, ?, "invoice_auto_approved", "scan_invoices", ?, ?, NOW())', [$tid, $userId, $id, json_encode(['total_amount' => $totalAmount])]);

            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    // ─── GET /admin/scan-invoices/{id}/download ──────────────────────────────
    // Called from <img src> / <iframe src> — browser cannot send Authorization header.
    // Accepts ?token= query param as fallback for image/PDF preview in browser.
    public function download(Request $request): void
    {
        // Validate token from query string if not already set by middleware
        $tid = null;
        try {
            $tid = Database::tenantId();
        } catch (\Throwable $e) {
            // Middleware didn't set tenant — try token from query param
            $token = $request->query('token');
            if (!$token) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Unauthorized']);
                exit;
            }
            // Validate JWT manually
            try {
                $payload = JWT::decode($token);
                if ($payload === null) throw new \RuntimeException('Invalid token');
                $tid = isset($payload['tid']) ? (int)$payload['tid'] : FOUNDING_TENANT_ID;
            } catch (\Throwable $e2) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Invalid token']);
                exit;
            }
        }

        $id  = (int)$request->param('id');
        $inv = Database::fetch(
            'SELECT file_path, file_type, original_filename FROM scan_invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tid]
        );
        if (!$inv) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Not found']); exit; }

        $fullPath = ROOT_PATH . '/' . ltrim((string)$inv['file_path'], '/');
        if (!file_exists($fullPath)) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'File not found']); exit; }

        $mime = $inv['file_type'] === 'pdf' ? 'application/pdf' : 'image/' . $inv['file_type'];
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . basename($fullPath) . '"');
        header('Content-Length: ' . filesize($fullPath));
        // Allow browser to cache the file for 10 minutes (image previews)
        header('Cache-Control: private, max-age=600');
        readfile($fullPath);
        exit;
    }

    // ─── GET /admin/scan-invoices ─────────────────────────────────────────────
    public function index(Request $request): void
    {
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(500, max(1, (int)($request->query('limit') ?: $request->query('per_page') ?: 20)));
        $tid    = Database::tenantId();
        $where  = ['i.tenant_id = ?'];
        $params = [$tid];

        if ($search = $request->query('search')) {
            $like    = '%' . trim($search) . '%';
            $where[] = '(i.invoice_number LIKE ? OR i.vendor_name LIKE ?)';
            $params[] = $like; $params[] = $like;
        }
        if ($mp = $request->query('marketplace')) {
            if (in_array($mp, ['amazon','flipkart','meesho','other'], true)) {
                $where[] = 'i.marketplace = ?'; $params[] = $mp;
            }
        }
        if ($status = $request->query('status')) {
            if (in_array($status, ['pending','processing','review','approved','rejected','error'], true)) {
                $where[] = 'i.processing_status = ?'; $params[] = $status;
            }
        }
        if ($invType = $request->query('invoice_type')) {
            if (in_array($invType, ['sale','purchase','return','commission'], true)) {
                $where[] = 'i.invoice_type = ?'; $params[] = $invType;
            }
        }
        if ($from = $request->query('from_date')) { $where[] = 'i.invoice_date >= ?'; $params[] = $from; }
        if ($to   = $request->query('to_date'))   { $where[] = 'i.invoice_date <= ?'; $params[] = $to; }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM scan_invoices i WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT i.*,
                    c.name AS customer_name
             FROM scan_invoices i
             LEFT JOIN invoice_customers c ON c.customer_id = i.customer_id AND c.tenant_id = i.tenant_id
             WHERE $wc
             ORDER BY i.created_at DESC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) {
            $r['subtotal']      = (float)$r['subtotal'];
            $r['tax_amount']    = (float)$r['tax_amount'];
            $r['total_amount']  = (float)$r['total_amount'];
            if ($r['ai_confidence_score']) $r['ai_confidence_score'] = (float)$r['ai_confidence_score'];
            if ($r['extracted_data']) $r['extracted_data'] = json_decode((string)$r['extracted_data'], true);
            if ($r['validated_data']) $r['validated_data'] = json_decode((string)$r['validated_data'], true);
        }
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    // ─── GET /admin/scan-invoices/{id} ───────────────────────────────────────
    public function show(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $inv = $this->findOrFail($id, $tid);

        $items = Database::fetchAll(
            'SELECT * FROM scan_invoice_line_items WHERE invoice_id = ? ORDER BY line_item_id ASC',
            [$id]
        );
        foreach ($items as &$it) {
            foreach (['quantity','unit_price','discount','taxable_value','cgst_rate','cgst_amount','sgst_rate','sgst_amount','igst_rate','igst_amount','total_amount'] as $f) {
                if (isset($it[$f])) $it[$f] = (float)$it[$f];
            }
        }
        $inv['line_items'] = $items;
        Response::success($inv);
    }

    // ─── PUT /admin/scan-invoices/{id} ───────────────────────────────────────
    public function update(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $this->findOrFail($id, $tid);

        $allowed = ['invoice_number','invoice_date','marketplace','vendor_name','vendor_gstin','processing_status'];
        $sets = []; $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if (in_array($col, ['vendor_name'], true)) $val = Request::sanitize(trim((string)$val));
            elseif ($col === 'vendor_gstin') $val = strtoupper(trim((string)$val));
            elseif ($col === 'processing_status' && !in_array($val, ['pending','processing','review','approved','rejected','error'], true)) continue;
            elseif ($col === 'marketplace' && !in_array($val, ['amazon','flipkart','meesho','other'], true)) continue;
            $sets[] = "$col = ?"; $params[] = $val;
        }
        if (empty($sets)) Response::error('No fields to update', 400);
        $sets[] = 'updated_at = NOW()'; $params[] = $id; $params[] = $tid;
        Database::execute('UPDATE scan_invoices SET ' . implode(', ', $sets) . ' WHERE invoice_id = ? AND tenant_id = ?', $params);
        Response::success($this->findOrFail($id, $tid), 'Invoice updated');
    }

    // ─── DELETE /admin/scan-invoices/{id} ────────────────────────────────────
    public function destroy(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $inv = $this->findOrFail($id, $tid);

        $filePath = $inv['file_path'];
        if ($filePath && $filePath !== 'manual' && $filePath !== 'pending') {
            $full = ROOT_PATH . '/' . ltrim($filePath, '/');
            if (file_exists($full)) @unlink($full);
        }
        Database::execute('DELETE FROM scan_invoices WHERE invoice_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(null, 'Invoice deleted');
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private function ensurePaymentsTable(): void
    {
        Database::execute(
            'CREATE TABLE IF NOT EXISTS `invoice_payments` (
              `payment_id`      INT(11) NOT NULL AUTO_INCREMENT,
              `tenant_id`       INT NOT NULL,
              `invoice_id`      INT(11) DEFAULT NULL,
              `payment_date`    DATE NOT NULL,
              `amount`          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `payment_method`  VARCHAR(50) NOT NULL DEFAULT "bank_transfer",
              `payment_type`    ENUM("received","paid","refund") NOT NULL DEFAULT "received",
              `party_name`      VARCHAR(255) DEFAULT NULL,
              `notes`           TEXT DEFAULT NULL,
              `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `updated_at`      DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`payment_id`),
              KEY `idx_inv_payments_tenant` (`tenant_id`),
              KEY `idx_inv_payments_tenant_date` (`tenant_id`, `payment_date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            []
        );
    }

    private function processingService(): InvoiceProcessingService
    {
        return new InvoiceProcessingService();
    }

    private function findOrFail(int $id, int $tid): array
    {
        if ($id <= 0) Response::error('Invalid ID', 400);
        $row = Database::fetch(
            'SELECT i.*, c.name AS customer_name
             FROM scan_invoices i
             LEFT JOIN invoice_customers c ON c.customer_id = i.customer_id AND c.tenant_id = i.tenant_id
             WHERE i.invoice_id = ? AND i.tenant_id = ? LIMIT 1',
            [$id, $tid]
        );
        if (!$row) Response::error('Invoice not found', 404);
        $row['subtotal']     = (float)$row['subtotal'];
        $row['tax_amount']   = (float)$row['tax_amount'];
        $row['total_amount'] = (float)$row['total_amount'];
        if ($row['ai_confidence_score']) $row['ai_confidence_score'] = (float)$row['ai_confidence_score'];
        if ($row['extracted_data']) $row['extracted_data'] = json_decode((string)$row['extracted_data'], true);
        if ($row['validated_data']) $row['validated_data'] = json_decode((string)$row['validated_data'], true);
        return $row;
    }
}
