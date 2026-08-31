<?php
declare(strict_types=1);

/**
 * Invoice Processing Service — AI extraction via Groq API + Gemini fallback
 *
 * Layer 1 — Groq Vision (llama-4-scout-17b) — primary
 * Layer 2 — JSON Repair — repairs truncated responses from long invoices
 * Layer 3 — Gemini 2.0 Flash — fallback when all Groq models fail
 *
 * After extraction: 3-pass validation engine auto-corrects quantities
 *
 * Usage:
 *   $service = new InvoiceProcessingService();
 *   $result  = $service->process($invoiceId, $filePath, $fileType, $tenantId);
 */
class InvoiceProcessingService
{
    private const VISION_MODELS = [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.2-11b-vision-preview',
        'llama-3.2-90b-vision-preview',
    ];
    private const TEXT_MODELS = [
        'llama-3.1-8b-instant',
        'gemma2-9b-it',
        'llama-3.3-70b-versatile',
    ];
    private const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
    private const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    private const GSTIN_REGEX = '/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/';
    private const MAX_EXEC_SECS = 90;
    // Grand total reconciliation tolerance in rupees
    private const TOTAL_TOLERANCE = 8.0;

    private string $groqKey;
    private string $geminiKey;

    public function __construct()
    {
        $this->groqKey   = defined('GROQ_API_KEY') ? GROQ_API_KEY : (defined('groq_api_key') ? groq_api_key : '');
        $this->geminiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
    }

    // ─── Process a specific page from a multi-page PDF ────────────────────────
    // Extracts text for the given page number only, then runs AI extraction
    public function processPage(int $invoiceId, string $filePath, int $pageNum, int $tenantId): array
    {
        set_time_limit(self::MAX_EXEC_SECS);
        $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"reading_image","progress":20}');

        $extracted = null;

        // Use Imagick to render this specific page, then send to Groq Vision
        if (!empty($this->groqKey)) {
            try {
                $extracted = $this->extractFromPdfPageAsImage($filePath, $pageNum);
            } catch (\Throwable $e) {
                error_log('[ProcessPage] Groq failed page ' . $pageNum . ': ' . $e->getMessage());
            }
        }

        // Gemini fallback — also via Imagick image
        if ($extracted === null && !empty($this->geminiKey)) {
            try {
                $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"gemini_fallback","progress":50}');
                $jpgPath = $this->pdfPageToJpegViaImagick($filePath, $pageNum);
                if ($jpgPath) {
                    $extracted = $this->extractWithGeminiFromJpeg($jpgPath);
                    @unlink($jpgPath);
                }
            } catch (\Throwable $e) {
                error_log('[ProcessPage] Gemini fallback failed page ' . $pageNum . ': ' . $e->getMessage());
            }
        }

        if ($extracted === null) {
            $this->updateStatus($invoiceId, $tenantId, 'error', '{"stage":"error","progress":0,"message":"All AI models failed for page ' . $pageNum . '"}');
            return ['success' => false, 'error' => 'All AI models failed for page ' . $pageNum];
        }

        $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"validating","progress":70}');
        $validated  = $this->validateExtracted($extracted);
        $confidence = $validated['ai_confidence_score'] ?? 0;

        Database::execute(
            'UPDATE scan_invoices
             SET processing_status = ?, ai_confidence_score = ?, extracted_data = ?,
                 validated_data = ?, processed_at = NOW(), error_message = ?, updated_at = NOW()
             WHERE invoice_id = ? AND tenant_id = ?',
            [
                'review', $confidence,
                json_encode($extracted, JSON_UNESCAPED_UNICODE),
                json_encode($validated, JSON_UNESCAPED_UNICODE),
                '{"stage":"complete","progress":100}',
                $invoiceId, $tenantId,
            ]
        );

        return ['success' => true, 'status' => 'review', 'confidence' => $confidence];
    }

    // Extract text from a single page — shell disabled, return fallback immediately
    private function pdfPageToText(string $filePath, int $pageNum): string
    {
        return '[PDF TEXT EXTRACTION FAILED — USE VISION FALLBACK]';
    }

    // Convert a single PDF page to JPEG using Imagick (shell_exec not available)
    private function extractFromPdfPageAsImage(string $filePath, int $pageNum): ?array
    {
        if (!extension_loaded('imagick')) return null;
        try {
            $im = new \Imagick();
            $im->setResolution(150, 150);
            // [N-1] = zero-indexed page
            $im->readImage($filePath . '[' . ($pageNum - 1) . ']');
            $im->setImageFormat('jpeg');
            $im->setImageCompressionQuality(85);
            $im->setImageBackgroundColor('white');
            $im->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
            $im->setImageColorspace(\Imagick::COLORSPACE_SRGB);

            $tmpImg = sys_get_temp_dir() . '/inv_page_' . $pageNum . '_' . uniqid() . '.jpg';
            $im->writeImage($tmpImg);
            $im->destroy();

            if (file_exists($tmpImg) && filesize($tmpImg) > 1000) {
                try {
                    $result = $this->extractFromImage($tmpImg);
                    @unlink($tmpImg);
                    return $result;
                } catch (\Throwable $e) {
                    @unlink($tmpImg);
                    error_log('[processPage] Imagick extract failed page ' . $pageNum . ': ' . $e->getMessage());
                }
            }
        } catch (\Throwable $e) {
            error_log('[processPage] Imagick page render failed: ' . $e->getMessage());
        }
        return null;
    }

    // Extract text from a page via Gemini (text input path)
    private function extractFromTextViaGemini(string $text): ?array
    {
        $prompt  = $this->extractionPrompt();
        $payload = [
            'contents' => [['parts' => [
                ['text' => $prompt . "\n\n---\nINVOICE TEXT:\n" . substr($text, 0, 4000)],
            ]]],
            'generationConfig' => ['maxOutputTokens' => 4096, 'temperature' => 0.1],
        ];
        $url = self::GEMINI_URL . '?key=' . $this->geminiKey;
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 60,
        ]);
        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200 || !$raw) return null;
        $resp = json_decode((string)$raw, true);
        $txt  = $resp['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!$txt) return null;
        return $this->parseJsonResponse($txt);
    }

    // ─── Main entry point ─────────────────────────────────────────────────────

    public function process(int $invoiceId, string $filePath, string $fileType, int $tenantId): array
    {
        set_time_limit(self::MAX_EXEC_SECS);

        $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"starting","progress":5}');

        $isImage = in_array(strtolower($fileType), ['jpg','jpeg','png'], true);

        // ─ Layer 1+2: Try Groq (with JSON repair fallback for truncated responses)
        $extracted = null;
        if (!empty($this->groqKey)) {
            try {
                if ($isImage) {
                    $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"reading_image","progress":20}');
                    $extracted = $this->extractFromImage($filePath);
                } else {
                    // PDF: convert to image via Imagick then use Groq Vision
                    // (shell_exec/exec are disabled on this host; text extraction not available)
                    $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"reading_image","progress":20}');
                    $pdfAsJpg = $this->pdfToJpegViaImagick($filePath);
                    if ($pdfAsJpg) {
                        $extracted = $this->extractFromImage($pdfAsJpg);
                        @unlink($pdfAsJpg);
                    }
                }
            } catch (\Throwable $e) {
                error_log('[Groq] Invoice #' . $invoiceId . ' failed: ' . $e->getMessage());
            }
        }

        // ─ Layer 3: Gemini fallback if Groq failed entirely
        if ($extracted === null) {
            if (!empty($this->geminiKey)) {
                try {
                    $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"gemini_fallback","progress":35}');
                    $extracted = $this->extractWithGemini($filePath, $isImage);
                } catch (\Throwable $e) {
                    error_log('[Gemini] Invoice #' . $invoiceId . ' also failed: ' . $e->getMessage());
                }
            }
        }

        if ($extracted === null) {
            $this->updateStatus($invoiceId, $tenantId, 'error', '{"stage":"error","progress":0,"message":"All AI models failed"}');
            return ['success' => false, 'error' => 'All AI extraction models failed. Please enter data manually.'];
        }

        // ─ 3-pass validation + quantity correction
        $this->updateStatus($invoiceId, $tenantId, 'processing', '{"stage":"validating","progress":70}');
        $validated  = $this->validateExtracted($extracted);
        $confidence = $validated['ai_confidence_score'] ?? 0;

        Database::execute(
            'UPDATE scan_invoices
             SET processing_status = ?, ai_confidence_score = ?, extracted_data = ?,
                 validated_data = ?, processed_at = NOW(), error_message = ?, updated_at = NOW()
             WHERE invoice_id = ? AND tenant_id = ?',
            [
                'review',
                $confidence,
                json_encode($extracted, JSON_UNESCAPED_UNICODE),
                json_encode($validated, JSON_UNESCAPED_UNICODE),
                '{"stage":"complete","progress":100}',
                $invoiceId,
                $tenantId,
            ]
        );

        return ['success' => true, 'status' => 'review', 'confidence' => $confidence];
    }

    // ─── Layer 1: Groq Vision ─────────────────────────────────────────────────

    private function extractFromImage(string $filePath): array
    {
        if (!file_exists($filePath)) throw new \RuntimeException('Invoice file not found: ' . $filePath);
        $mime  = mime_content_type($filePath) ?: 'image/jpeg';
        $b64   = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($filePath));
        $prompt = $this->extractionPrompt();

        foreach (self::VISION_MODELS as $model) {
            $payload = [
                'model'           => $model,
                'response_format' => ['type' => 'json_object'],
                'messages'        => [
                    ['role' => 'system', 'content' => 'You are a JSON-only invoice parser. Return only a valid JSON object.'],
                    ['role' => 'user',   'content' => [
                        ['type' => 'text',      'text'      => $prompt],
                        ['type' => 'image_url', 'image_url' => ['url' => $b64]],
                    ]],
                ],
                'temperature' => 0.1,
                'max_tokens'  => 4000,
            ];
            $result = $this->callGroq($payload);
            if ($result !== null) return $result;
        }
        throw new \RuntimeException('All Groq vision models failed');
    }

    private function extractFromText(string $text): array
    {
        $prompt = $this->extractionPrompt();
        foreach (self::TEXT_MODELS as $model) {
            $payload = [
                'model'           => $model,
                'response_format' => ['type' => 'json_object'],
                'messages'        => [
                    ['role' => 'system', 'content' => 'You are a JSON-only invoice parser. Return only a valid JSON object.'],
                    ['role' => 'user',   'content' => $prompt . "\n\n---\nINVOICE TEXT:\n" . substr($text, 0, 4000)],
                ],
                'temperature' => 0.1,
                'max_tokens'  => 4000,
            ];
            $result = $this->callGroq($payload);
            if ($result !== null) return $result;
        }
        throw new \RuntimeException('All Groq text models failed');
    }

    private function callGroq(array $payload): ?array
    {
        // Retry up to 3 times with backoff on rate limit (429)
        $retries = 3;
        $waitSecs = 5;
        for ($attempt = 0; $attempt < $retries; $attempt++) {
            $ch = curl_init(self::GROQ_URL);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => json_encode($payload),
                CURLOPT_HTTPHEADER     => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $this->groqKey,
                ],
                CURLOPT_TIMEOUT => 30,
            ]);
            $raw  = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 429) {
                // Rate limited — wait and retry
                error_log('[Groq] Rate limited (attempt ' . ($attempt+1) . '), waiting ' . $waitSecs . 's');
                sleep($waitSecs);
                $waitSecs *= 2; // exponential backoff: 5s, 10s, 20s
                continue;
            }

            if ($code !== 200 || !$raw) return null;

            $resp = json_decode((string)$raw, true);
            $text = $resp['choices'][0]['message']['content'] ?? null;
            if (!$text) return null;

            return $this->parseJsonResponse((string)$text);
        }
        return null; // all retries exhausted
    }

    // ─── Layer 2: JSON Repair ──────────────────────────────────────────────────

    /**
     * Parse and repair potentially truncated JSON from LLM responses.
     * Long invoices sometimes cause Groq to truncate mid-JSON.
     */
    private function parseJsonResponse(string $raw): ?array
    {
        // Strip markdown fences
        $raw = trim(preg_replace('/^```(?:json)?\s*|\s*```\s*$/i', '', trim($raw)));

        // Direct parse first
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;

        // Try to extract first {...} block
        if (preg_match('/\{.*\}/s', $raw, $m)) {
            $data = json_decode($m[0], true);
            if (is_array($data)) return $data;
        }

        // JSON repair: strip incomplete trailing key-value, balance braces
        $repaired = $this->repairJson($raw);
        if ($repaired !== null) return $repaired;

        return null;
    }

    private function repairJson(string $raw): ?array
    {
        // Remove trailing incomplete key: "some_key":  (no value before end)
        $raw = preg_replace('/"[^"]+"\s*:\s*$/', '', $raw);
        // Remove trailing comma before closing brace/bracket
        $raw = preg_replace('/,\s*([\}\]])/', '$1', $raw);
        // Balance open array brackets
        $opens  = substr_count($raw, '[') - substr_count($raw, ']');
        $raw   .= str_repeat(']', max(0, $opens));
        // Balance open object braces
        $opens  = substr_count($raw, '{') - substr_count($raw, '}');
        $raw   .= str_repeat('}', max(0, $opens));

        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    // ─── Layer 3: Gemini Fallback ─────────────────────────────────────────────

    private function extractWithGemini(string $filePath, bool $isImage): array
    {
        if (!file_exists($filePath)) throw new \RuntimeException('File not found for Gemini: ' . $filePath);

        $url    = self::GEMINI_URL . '?key=' . $this->geminiKey;
        $prompt = $this->extractionPrompt();

        if ($isImage) {
            $mime    = mime_content_type($filePath) ?: 'image/jpeg';
            $b64data = base64_encode(file_get_contents($filePath));
            $payload = [
                'contents' => [['parts' => [
                    ['text' => $prompt],
                    ['inline_data' => ['mime_type' => $mime, 'data' => $b64data]],
                ]]],
                'generationConfig' => ['maxOutputTokens' => 4096, 'temperature' => 0.1],
            ];
        } else {
            // PDF: convert to JPEG via Imagick then send as image to Gemini
            $jpgPath = $this->pdfToJpegViaImagick($filePath);
            if ($jpgPath) {
                $b64data = base64_encode(file_get_contents($jpgPath));
                @unlink($jpgPath);
                $payload = [
                    'contents' => [['parts' => [
                        ['text' => $prompt],
                        ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $b64data]],
                    ]]],
                    'generationConfig' => ['maxOutputTokens' => 4096, 'temperature' => 0.1],
                ];
            } else {
                // Last resort: send placeholder text so Gemini returns empty structure
                $payload = [
                    'contents' => [['parts' => [
                        ['text' => $prompt . "\n\n---\nINVOICE TEXT:\n[Unable to extract PDF content]"],
                    ]]],
                    'generationConfig' => ['maxOutputTokens' => 4096, 'temperature' => 0.1],
                ];
            }
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 60,
        ]);
        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code !== 200 || !$raw) {
            throw new \RuntimeException('Gemini API returned HTTP ' . $code);
        }

        $resp = json_decode((string)$raw, true);
        $text = $resp['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!$text) throw new \RuntimeException('Gemini returned empty response');

        $parsed = $this->parseJsonResponse($text);
        if ($parsed === null) throw new \RuntimeException('Gemini response could not be parsed as JSON');

        return $parsed;
    }

    // ─── 3-Pass Validation Engine ─────────────────────────────────────────────

    private function validateExtracted(array $data): array
    {
        // Normalize confidence scores: if all 0–1, scale to 0–100
        $confidence = $data['field_confidence'] ?? [];
        if (is_array($confidence) && !empty($confidence)) {
            $maxVal = max(array_map('floatval', array_values($confidence)));
            if ($maxVal <= 1.0) {
                foreach ($confidence as $k => $v) { $confidence[$k] = round((float)$v * 100, 1); }
            }
        }

        // Validate GSTIN — cap confidence if invalid
        foreach (['vendor_gstin', 'customer_gstin'] as $field) {
            if (!empty($data[$field]) && !preg_match(self::GSTIN_REGEX, strtoupper((string)$data[$field]))) {
                if (isset($confidence[$field])) $confidence[$field] = min((float)$confidence[$field], 45.0);
            }
        }

        // Build line items with base values first
        $lineItems = [];
        foreach ((array)($data['line_items'] ?? []) as $item) {
            $qty      = (float)($item['quantity']     ?? 0);
            $price    = (float)($item['unit_price']   ?? 0);
            $discount = (float)($item['discount']     ?? 0);
            $taxable  = (float)($item['taxable_value'] ?? 0);

            if ($taxable <= 0 && $qty > 0 && $price > 0) {
                $taxable = round($qty * $price - $discount, 2);
            }

            $cgstR = (float)($item['cgst_rate']  ?? 0);
            $sgstR = (float)($item['sgst_rate']  ?? 0);
            $igstR = (float)($item['igst_rate']  ?? 0);
            $cgstA = (float)($item['cgst_amount'] ?? round($taxable * $cgstR / 100, 2));
            $sgstA = (float)($item['sgst_amount'] ?? round($taxable * $sgstR / 100, 2));
            $igstA = (float)($item['igst_amount'] ?? round($taxable * $igstR / 100, 2));
            $total = round($taxable + $cgstA + $sgstA + $igstA, 2);

            $lineItems[] = [
                'product_name'     => (string)($item['product_name'] ?? $item['description'] ?? ''),
                'sku'              => $item['sku'] ?? null,
                'hsn_code'         => $item['hsn_code'] ?? null,
                'quantity'         => $qty,
                'unit_price'       => $price,
                'discount'         => $discount,
                'taxable_value'    => $taxable,
                'cgst_rate'        => $cgstR, 'cgst_amount' => $cgstA,
                'sgst_rate'        => $sgstR, 'sgst_amount' => $sgstA,
                'igst_rate'        => $igstR, 'igst_amount' => $igstA,
                'total_amount'     => $total,
                'confidence_score' => (float)($item['confidence_score'] ?? $item['confidence'] ?? 70),
            ];
        }

        $invoiceTotal = (float)($data['total_amount'] ?? 0);
        $subtotal     = (float)($data['subtotal']     ?? 0);
        $taxAmount    = (float)($data['tax_amount']   ?? 0);

        // ── Pass 1: Per-line quantity correction ──────────────────────────────
        // If taxable_value ÷ unit_price = a whole integer ≠ current qty → correct qty
        foreach ($lineItems as &$item) {
            if ($item['unit_price'] <= 0 || $item['taxable_value'] <= 0) continue;
            $derived = $item['taxable_value'] / $item['unit_price'];
            $rounded = round($derived);
            if (
                $rounded >= 1 && $rounded <= 999 &&
                abs($derived - $rounded) < 0.01 &&   // it's a clean integer
                abs($rounded - $item['quantity']) > 0.001  // different from extracted qty
            ) {
                $item['quantity']     = $rounded;
                $item['total_amount'] = round($item['taxable_value'] +
                    $item['cgst_amount'] + $item['sgst_amount'] + $item['igst_amount'], 2);
            }
        }
        unset($item);

        // ── Pass 2: Single-item grand total back-calculation ──────────────────
        // If only 1 line item and its total differs from invoice total → recalc taxable
        if (count($lineItems) === 1 && $invoiceTotal > 0) {
            $li       = &$lineItems[0];
            $taxRate  = ($li['cgst_rate'] + $li['sgst_rate'] + $li['igst_rate']) / 100;
            $taxable  = $taxRate > 0 ? round($invoiceTotal / (1 + $taxRate), 2) : $invoiceTotal;
            if (abs($taxable - $li['taxable_value']) > 0.5) {
                $li['taxable_value'] = $taxable;
                $li['cgst_amount']   = round($taxable * $li['cgst_rate'] / 100, 2);
                $li['sgst_amount']   = round($taxable * $li['sgst_rate'] / 100, 2);
                $li['igst_amount']   = round($taxable * $li['igst_rate'] / 100, 2);
                $li['total_amount']  = round($taxable + $li['cgst_amount'] + $li['sgst_amount'] + $li['igst_amount'], 2);
                // Back-calc qty from new taxable if unit_price known
                if ($li['unit_price'] > 0) {
                    $li['quantity'] = round($taxable / $li['unit_price']);
                }
            }
            unset($li);
        }

        // ── Pass 3: Multi-item grand total reconciliation ─────────────────────
        // If sum of line totals differs from invoice total by > tolerance → adjust best candidate
        if ($invoiceTotal > 0 && count($lineItems) > 1) {
            $lineSum = array_sum(array_column($lineItems, 'total_amount'));
            $diff    = $invoiceTotal - $lineSum;
            if (abs($diff) > self::TOTAL_TOLERANCE) {
                // Find best candidate: item where taxable/unit_price ratio is closest to an integer
                $bestIdx   = 0;
                $bestScore = PHP_FLOAT_MAX;
                foreach ($lineItems as $idx => $li) {
                    if ($li['unit_price'] <= 0) continue;
                    $ratio = $li['taxable_value'] / $li['unit_price'];
                    $score = abs($ratio - round($ratio));
                    if ($score < $bestScore) { $bestScore = $score; $bestIdx = $idx; }
                }
                $li       = &$lineItems[$bestIdx];
                $taxRate  = ($li['cgst_rate'] + $li['sgst_rate'] + $li['igst_rate']) / 100;
                $newTotal = $li['total_amount'] + $diff;
                if ($newTotal > 0) {
                    $newTaxable         = $taxRate > 0 ? round($newTotal / (1 + $taxRate), 2) : $newTotal;
                    $li['taxable_value'] = $newTaxable;
                    $li['cgst_amount']   = round($newTaxable * $li['cgst_rate'] / 100, 2);
                    $li['sgst_amount']   = round($newTaxable * $li['sgst_rate'] / 100, 2);
                    $li['igst_amount']   = round($newTaxable * $li['igst_rate'] / 100, 2);
                    $li['total_amount']  = round($newTaxable + $li['cgst_amount'] + $li['sgst_amount'] + $li['igst_amount'], 2);
                    if ($li['unit_price'] > 0) {
                        $li['quantity'] = max(1, round($newTaxable / $li['unit_price']));
                    }
                }
                unset($li);
            }
        }

        // Recalculate invoice totals from (possibly corrected) line items
        if (!empty($lineItems)) {
            $subtotal  = round(array_sum(array_column($lineItems, 'taxable_value')), 2);
            $taxAmount = round(array_sum(array_map(fn($li) =>
                $li['cgst_amount'] + $li['sgst_amount'] + $li['igst_amount'], $lineItems)), 2);
            if ($invoiceTotal <= 0) {
                $invoiceTotal = round($subtotal + $taxAmount, 2);
            }
        }

        $aiScore = !empty($confidence) ? round(array_sum($confidence) / count($confidence), 1) : 50.0;

        return [
            'invoice_number'    => $data['invoice_number']   ?? null,
            'invoice_date'      => $data['invoice_date']     ?? null,
            'vendor_name'       => $data['vendor_name']      ?? null,
            'vendor_gstin'      => $data['vendor_gstin']     ?? null,
            'customer_name'     => $data['customer_name']    ?? null,
            'customer_gstin'    => $data['customer_gstin']   ?? null,
            'customer_address'  => $data['customer_address'] ?? null,
            'shipping_charges'  => (float)($data['shipping_charges']  ?? 0),
            'commission_amount' => (float)($data['commission_amount'] ?? 0),
            'subtotal'          => $subtotal,
            'tax_amount'        => $taxAmount,
            'total_amount'      => $invoiceTotal,
            'line_items'        => $lineItems,
            'field_confidence'  => $confidence,
            'ai_confidence_score' => $aiScore,
        ];
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    // Convert a specific page (1-indexed) of PDF to JPEG via Imagick
    private function pdfPageToJpegViaImagick(string $filePath, int $pageNum): ?string
    {
        if (!extension_loaded('imagick') || !file_exists($filePath)) return null;
        try {
            $im = new \Imagick();
            $im->setResolution(150, 150);
            $im->readImage($filePath . '[' . ($pageNum - 1) . ']');
            $im->setImageFormat('jpeg');
            $im->setImageCompressionQuality(85);
            $im->setImageBackgroundColor('white');
            $im->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
            $im->setImageColorspace(\Imagick::COLORSPACE_SRGB);
            $tmpPath = sys_get_temp_dir() . '/inv_p' . $pageNum . '_' . uniqid() . '.jpg';
            $im->writeImage($tmpPath);
            $im->destroy();
            return (file_exists($tmpPath) && filesize($tmpPath) > 500) ? $tmpPath : null;
        } catch (\Throwable $e) {
            error_log('[pdfPageToJpeg] page ' . $pageNum . ': ' . $e->getMessage());
            return null;
        }
    }

    // Send a JPEG file to Gemini Vision
    private function extractWithGeminiFromJpeg(string $jpgPath): ?array
    {
        if (!file_exists($jpgPath)) return null;
        $b64data = base64_encode(file_get_contents($jpgPath));
        $payload = [
            'contents' => [['parts' => [
                ['text' => $this->extractionPrompt()],
                ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $b64data]],
            ]]],
            'generationConfig' => ['maxOutputTokens' => 4096, 'temperature' => 0.1],
        ];
        $url = self::GEMINI_URL . '?key=' . $this->geminiKey;
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 60,
        ]);
        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200 || !$raw) return null;
        $resp = json_decode((string)$raw, true);
        $txt  = $resp['candidates'][0]['content']['parts'][0]['text'] ?? null;
        return $txt ? $this->parseJsonResponse($txt) : null;
    }

    // Convert first page of PDF to JPEG via Imagick, return temp file path
    private function pdfToJpegViaImagick(string $filePath): ?string
    {
        if (!extension_loaded('imagick') || !file_exists($filePath)) return null;
        try {
            $im = new \Imagick();
            $im->setResolution(150, 150);
            $im->readImage($filePath . '[0]');
            $im->setImageFormat('jpeg');
            $im->setImageCompressionQuality(85);
            $im->setImageBackgroundColor('white');
            $im->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
            $im->setImageColorspace(\Imagick::COLORSPACE_SRGB);
            $tmpPath = sys_get_temp_dir() . '/inv_img_' . uniqid() . '.jpg';
            $im->writeImage($tmpPath);
            $im->destroy();
            return (file_exists($tmpPath) && filesize($tmpPath) > 500) ? $tmpPath : null;
        } catch (\Throwable $e) {
            error_log('[pdfToJpeg] Imagick failed: ' . $e->getMessage());
            return null;
        }
    }

    private function pdfToText(string $filePath): string
    {
        // shell_exec and exec are disabled on this host — skip text extraction,
        // fall through to Groq Vision which works via HTTP (no shell needed)
        return '[PDF TEXT EXTRACTION FAILED — USE VISION FALLBACK]';
    }

    private function updateStatus(int $invoiceId, int $tenantId, string $status, string $stageMsgJson): void
    {
        Database::execute(
            'UPDATE scan_invoices SET processing_status = ?, error_message = ?, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?',
            [$status, $stageMsgJson, $invoiceId, $tenantId]
        );
    }

    private function extractionPrompt(): string
    {
        return <<<'PROMPT'
You are an expert Indian invoice data extractor. Extract ALL line items — never skip any.
Return ONLY a valid JSON object with no extra text, markdown, or explanation.

RULES:
1. Extract EVERY line item — no skipping even if many items
2. Verify Qty: taxable_value ÷ unit_price should ≈ qty. If not, trust taxable_value
3. "Pack of 3" or "Set of 2" in product name ≠ quantity — read the actual Qty column
4. Amazon ASINs in brackets e.g. (B0GN2XVLHS) → extract as sku field
5. Extract line_items FIRST in JSON so they're never truncated

JSON structure:
{
  "line_items": [
    {
      "product_name": "string",
      "sku": "string or null",
      "hsn_code": "string or null",
      "quantity": 1,
      "unit_price": 0,
      "discount": 0,
      "taxable_value": 0,
      "cgst_rate": 0, "cgst_amount": 0,
      "sgst_rate": 0, "sgst_amount": 0,
      "igst_rate": 0, "igst_amount": 0,
      "total_amount": 0,
      "confidence": 85
    }
  ],
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "vendor_name": "string or null",
  "vendor_gstin": "string or null",
  "customer_name": "string or null",
  "customer_gstin": "string or null",
  "customer_address": "string or null",
  "shipping_charges": 0,
  "commission_amount": 0,
  "subtotal": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "field_confidence": {
    "invoice_number": 90,
    "invoice_date": 90,
    "vendor_name": 85,
    "vendor_gstin": 80,
    "line_items": 90,
    "totals": 95
  }
}
PROMPT;
    }
}
