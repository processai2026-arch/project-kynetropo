<?php
declare(strict_types=1);

/**
 * AI Command Bar Controller
 * POST /admin/ops/ai-command/parse   — parse natural-language prompt → preview + intent token
 * POST /admin/ops/ai-command/execute — execute intent by token
 * GET  /admin/ops/ai-command/log     — last 50 commands for this tenant
 */
class AdminOpsAiCommandController
{
    // Allowed method+path prefixes — whitelist prevents the AI from calling arbitrary endpoints
    private const ALLOWED_PATHS = [
        'PUT /api/admin/ops/projects/',
        'PUT /api/admin/ops/clients/',
        'PUT /api/admin/ops/meetings/',
        'PUT /api/admin/ops/bugs/',
        'POST /api/admin/ops/projects',
        'POST /api/admin/ops/clients',
        'POST /api/admin/ops/meetings',
        'POST /api/admin/ops/bugs',
        'POST /api/admin/ops/finance/payments',
        'POST /api/admin/ops/finance/expenses',
    ];

    // ─── Parse ───────────────────────────────────────────────────────────────
    public function parse(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $tenantId = Database::tenantId();
        $body     = $request->body();
        $prompt   = trim((string)($body['prompt'] ?? ''));

        if (!$prompt)                Response::error('Prompt is required', 422);
        if (mb_strlen($prompt) > 500) Response::error('Prompt must be 500 characters or fewer', 422);

        $projects = Database::fetchAll(
            'SELECT id, name, stage, health, client_id FROM ops_projects WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 20',
            [$tenantId]
        );
        $clients = Database::fetchAll(
            'SELECT id, name, stage FROM ops_clients WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 20',
            [$tenantId]
        );
        $bugs = Database::fetchAll(
            "SELECT id, description, priority FROM ops_bugs WHERE tenant_id = ? AND status != 'closed' ORDER BY created_at DESC LIMIT 20",
            [$tenantId]
        );

        $projectList = implode("\n", array_map(
            fn($p) => "  - ID:{$p['id']} \"{$p['name']}\" (stage:{$p['stage']}, health:{$p['health']}, client_id:{$p['client_id']})",
            $projects
        ));
        $clientList = implode("\n", array_map(
            fn($c) => "  - ID:{$c['id']} \"{$c['name']}\" (stage:{$c['stage']})",
            $clients
        ));
        $bugList = implode("\n", array_map(
            fn($b) => "  - ID:{$b['id']} \"{$b['description']}\" ({$b['priority']})",
            $bugs
        ));

        $today = date('Y-m-d');

        $systemPrompt = <<<SYSPROMPT
You are an AI assistant for a project management ERP. Parse the user's natural-language command and return a JSON object that describes the exact API call to make.

TODAY: {$today}

PROJECTS (id, name, stage, health, client_id):
{$projectList}

CLIENTS (id, name, stage):
{$clientList}

OPEN BUGS (id, description, priority):
{$bugList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API CATALOG — every action you can perform:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[PROJECTS]
POST /api/admin/ops/projects
  Create a new project.
  Required: {"name":"<text>","client_id":<int>}
  Optional: {"health":"green"|"yellow"|"red","priority":"low"|"medium"|"high"|"critical","quoted":<number>,"deadline":"YYYY-MM-DD","current_work":"<text>","next_action":"<text>","owner":"<name>"}
  client_id must come from the CLIENTS list above.

PUT /api/admin/ops/projects/{id}
  Update any project field. Common uses:
  - Set current work:    {"current_work":"<text>","current_work_due":"YYYY-MM-DD"}
  - Set next action:     {"next_action":"<text>","next_action_due":"YYYY-MM-DD"}
  - Set health:          {"health":"green"|"yellow"|"red"}
  - Set stage:           {"stage":"<stage name>"}
  - Set blocker:         {"blocker":"<text>"}
  - Set priority:        {"priority":"low"|"medium"|"high"|"critical"}
  - Set deadline:        {"deadline":"YYYY-MM-DD"}
  - Set founder note:    {"founder_note":"<text>"}
  You can combine multiple fields in one PUT body.

[CLIENTS]
POST /api/admin/ops/clients
  Create a new client.
  Required: {"name":"<text>"}
  Optional: {"phone":"<text>","email":"<text>","health":"green"|"yellow"|"red","owner":"<name>","source":"<text>","notes":"<text>"}

PUT /api/admin/ops/clients/{id}
  Update any client field. Common uses:
  - Set health:          {"health":"green"|"yellow"|"red"}
  - Set stage:           {"stage":"<stage name>"}
  - Set notes:           {"notes":"<text>"}
  - Set next followup:   {"next_followup":"YYYY-MM-DD"}

[MEETINGS]
POST /api/admin/ops/meetings
  Schedule a new meeting.
  Required: {"client_id":<int>,"date":"YYYY-MM-DD HH:MM:SS"}
  Optional: {"project_id":<int>,"type":"google_meet"|"in_person"|"phone_call"|"whatsapp_call","agenda":"<text>","booked_by":"AI Assistant"}
  Default type: google_meet

PUT /api/admin/ops/meetings/{id}
  Update a meeting.
  - Set followup date:   {"next_followup":"YYYY-MM-DD"}
  - Update agenda:       {"agenda":"<text>"}
  - Set outcome:         {"outcome":"<text>"}

[BUGS]
POST /api/admin/ops/bugs
  Create a new bug report.
  Required: {"project_id":<int>,"description":"<text>"}
  Optional: {"module":"<text>","type":"bug"|"feature_request"|"change_request","priority":"p0_critical"|"p1_high"|"p2_medium"|"p3_low","reported_by":"<name>","target_date":"YYYY-MM-DD","steps_to_repro":"<text>"}
  project_id must come from the PROJECTS list above.

PUT /api/admin/ops/bugs/{id}
  Update a bug.
  - Change status:       {"status":"open"|"in_progress"|"fixed"|"retest"|"closed"|"wont_fix"}
  - Change priority:     {"priority":"low"|"medium"|"high"|"critical"}
  - Set assignee:        {"assigned_to":"<name>"}

POST /api/admin/ops/bugs/{id}/comments
  Add a comment: {"comment":"<text>","due_date":"YYYY-MM-DD","added_by":"AI Assistant"}

[FINANCE]
POST /api/admin/ops/finance/payments
  Log a payment received.
  Required: {"project_id":<int>,"client_id":<int>,"amount":<number>,"type":"advance"|"mid"|"final"|"amc"|"other"}
  Optional: {"mode":"bank_transfer"|"cash"|"upi"|"cheque"|"other","payment_date":"YYYY-MM-DD","recorded_by":"AI Assistant"}
  Note: client_id is in the PROJECTS list above (client_id column).

POST /api/admin/ops/finance/expenses
  Log a business expense.
  Required: {"amount":<number>,"category":"hosting"|"tools"|"travel"|"marketing"|"salary"|"pitch"|"other"}
  Optional: {"description":"<text>","project_id":<int>,"date":"YYYY-MM-DD","added_by":"AI Assistant"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY this JSON (no explanation, no markdown):
{
  "method": "PUT"|"POST",
  "path": "/api/admin/ops/...",
  "body": { ... },
  "preview": "<one clear sentence, e.g. 'Set health for VTT Gold to red'>",
  "confidence": "high"|"medium"|"low",
  "clarification_needed": null or "<question if ambiguous>"
}

RULES:
- Fill path IDs from the entity lists above — never use placeholder values like {id}.
- For payments: include client_id from the PROJECTS list (client_id column).
- For meetings: client_id must come from the CLIENTS list. Match client name from the user prompt.
- Dates always YYYY-MM-DD. Meeting date+time: YYYY-MM-DD HH:MM:SS. Resolve relative dates from TODAY={$today}.
- health must be exactly "green", "yellow", or "red".
- If the command is completely unrecognisable, return: {"method":null,"path":null,"body":{},"preview":"","confidence":"low","clarification_needed":"<what you need>"}
SYSPROMPT;

        $groqResult = $this->callGroq($systemPrompt, $prompt);

        if (!$groqResult['ok']) {
            Database::insert('ops_ai_command_log', [
                'tenant_id'  => $tenantId,
                'raw_prompt' => $prompt,
                'executed'   => 0,
                'error'      => 'groq_error: ' . ($groqResult['error'] ?? 'unknown'),
            ]);
            Response::error('AI service unavailable. Please try again.', 503);
        }

        $parsed     = $groqResult['data'];
        $method     = strtoupper(trim((string)($parsed['method'] ?? '')));
        $path       = trim((string)($parsed['path'] ?? ''));
        $apiBody    = $parsed['body'] ?? [];
        $preview    = $parsed['preview'] ?? '';
        $confidence = $parsed['confidence'] ?? 'high';
        $clarification = $parsed['clarification_needed'] ?? null;

        if (!$method || !$path) {
            Database::insert('ops_ai_command_log', [
                'tenant_id'  => $tenantId,
                'raw_prompt' => $prompt,
                'executed'   => 0,
                'error'      => 'unknown_intent',
            ]);
            Response::success([
                'success'              => false,
                'preview'              => $preview ?: "I didn't understand that command.",
                'clarification_needed' => $clarification ?: "Try: \"set current work for VTT Gold to build list page\" or \"log ₹50,000 payment for Stabilus\"",
            ]);
        }

        // Whitelist check
        if (!$this->isAllowedPath($method, $path)) {
            Database::insert('ops_ai_command_log', [
                'tenant_id'  => $tenantId,
                'raw_prompt' => $prompt,
                'executed'   => 0,
                'error'      => 'blocked_path: ' . $method . ' ' . $path,
            ]);
            Response::error("That action is not permitted via AI command.", 403);
        }

        if ($confidence === 'low' || $clarification) {
            Database::insert('ops_ai_command_log', [
                'tenant_id'  => $tenantId,
                'raw_prompt' => $prompt,
                'executed'   => 0,
                'error'      => 'clarification_needed',
            ]);
            Response::success([
                'success'              => false,
                'method'               => $method,
                'path'                 => $path,
                'body'                 => $apiBody,
                'preview'              => $preview,
                'confidence'           => $confidence,
                'clarification_needed' => $clarification,
            ]);
        }

        $token = bin2hex(random_bytes(32));

        Database::insert('ops_ai_intents', [
            'tenant_id'   => $tenantId,
            'token'       => $token,
            'intent_type' => strtolower(str_replace(['/', ' '], '_', $method . '_' . $path)),
            'payload'     => json_encode(['method' => $method, 'path' => $path, 'body' => $apiBody]),
            'preview'     => $preview,
            'expires_at'  => date('Y-m-d H:i:s', time() + 90),
        ]);

        Database::insert('ops_ai_command_log', [
            'tenant_id'  => $tenantId,
            'raw_prompt' => $prompt,
            'intent_type' => $method . ' ' . $path,
            'payload'    => json_encode($apiBody),
            'executed'   => 0,
        ]);

        Response::success([
            'success'              => true,
            'token'                => $token,
            'method'               => $method,
            'path'                 => $path,
            'preview'              => $preview,
            'confidence'           => $confidence,
            'clarification_needed' => null,
        ]);
    }

    // ─── Execute ─────────────────────────────────────────────────────────────
    public function execute(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $tenantId = Database::tenantId();
        $body     = $request->body();
        $token    = trim((string)($body['token'] ?? ''));

        if (!$token) Response::error('Token is required', 422);

        // Extract Bearer JWT so internal API calls carry the same auth
        $authHeader = '';
        if (function_exists('getallheaders')) {
            $hdrs = getallheaders();
            $authHeader = $hdrs['Authorization'] ?? $hdrs['authorization'] ?? '';
        }
        if (!$authHeader) $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $jwt = str_starts_with($authHeader, 'Bearer ') ? substr($authHeader, 7) : '';
        if (!$jwt) Response::error('Authorization token missing', 401);

        $baseUrl = $this->getAppUrl();

        // Clean up expired unused tokens
        Database::query(
            'DELETE FROM ops_ai_intents WHERE expires_at < NOW() AND used = 0 AND tenant_id = ?',
            [$tenantId]
        );

        $intent = Database::fetch(
            'SELECT * FROM ops_ai_intents WHERE token = ? AND tenant_id = ? LIMIT 1',
            [$token, $tenantId]
        );

        if (!$intent)        Response::error('Command not found — it may have expired', 404);
        if ($intent['used']) Response::error('This command was already executed', 409);
        if (strtotime($intent['expires_at']) < time()) Response::error('Command expired — please re-enter your command', 410);

        $payload = json_decode($intent['payload'], true) ?? [];
        $method  = strtoupper(trim((string)($payload['method'] ?? '')));
        $path    = trim((string)($payload['path'] ?? ''));
        $apiBody = $payload['body'] ?? [];
        $preview = $intent['preview'];

        if (!$method || !$path) Response::error('Invalid intent payload', 422);

        // Re-check whitelist at execution time (defence in depth)
        if (!$this->isAllowedPath($method, $path)) {
            Response::error('Blocked path: ' . $method . ' ' . $path, 403);
        }

        // Mark used immediately to prevent double-execution
        Database::query(
            'UPDATE ops_ai_intents SET used = 1 WHERE token = ? AND tenant_id = ?',
            [$token, $tenantId]
        );

        try {
            $this->apiCall($method, $baseUrl . $path, $apiBody, $jwt);
        } catch (\Throwable $e) {
            // Unmark so user can retry
            Database::query(
                'UPDATE ops_ai_intents SET used = 0 WHERE token = ? AND tenant_id = ?',
                [$token, $tenantId]
            );
            Response::error('Execution failed: ' . $e->getMessage(), 500);
        }

        Database::query(
            'UPDATE ops_ai_command_log SET executed = 1 WHERE tenant_id = ? AND intent_type = ? AND executed = 0 ORDER BY created_at DESC LIMIT 1',
            [$tenantId, $method . ' ' . $path]
        );

        Response::success([
            'message'          => $preview . ' — Done!',
            'refreshDashboard' => true,
        ]);
    }

    // ─── Log ─────────────────────────────────────────────────────────────────
    public function log(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $tenantId = Database::tenantId();

        $rows = Database::fetchAll(
            'SELECT id, raw_prompt, intent_type, executed, error, executed_by, created_at
             FROM ops_ai_command_log
             WHERE tenant_id = ?
             ORDER BY created_at DESC
             LIMIT 50',
            [$tenantId]
        );

        Response::success(array_map(fn($r) => [
            'id'          => (int)$r['id'],
            'raw_prompt'  => $r['raw_prompt'],
            'intent_type' => $r['intent_type'],
            'executed'    => (int)$r['executed'],
            'error'       => $r['error'],
            'executed_by' => $r['executed_by'],
            'created_at'  => $r['created_at'],
        ], $rows));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function isAllowedPath(string $method, string $path): bool
    {
        $key = $method . ' ' . $path;
        foreach (self::ALLOWED_PATHS as $prefix) {
            if (str_starts_with($key, $prefix)) return true;
        }
        return false;
    }

    private function getAppUrl(): string
    {
        $envPath = dirname(__DIR__, 3) . '/.env';
        if (file_exists($envPath)) {
            foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
                [$k, $v] = array_map('trim', explode('=', $line, 2));
                if ($k === 'APP_URL') return rtrim(trim($v, '"\''), '/');
            }
        }
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    private function apiCall(string $method, string $url, array $body, string $jwt): array
    {
        $payload = json_encode($body);
        $context = stream_context_create([
            'http' => [
                'method'        => $method,
                'header'        => implode("\r\n", [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $jwt,
                    'Content-Length: ' . strlen($payload),
                ]),
                'content'       => $payload,
                'timeout'       => 15,
                'ignore_errors' => true,
            ],
        ]);

        $raw = @file_get_contents($url, false, $context);

        $status = 0;
        if (!empty($http_response_header)) {
            preg_match('/HTTP\/\d\.\d\s+(\d+)/', $http_response_header[0], $m);
            $status = (int)($m[1] ?? 0);
        }

        if ($raw === false || ($status > 0 && $status >= 400)) {
            $errBody = $raw ? (json_decode($raw, true)['message'] ?? $raw) : 'Network error';
            throw new \RuntimeException("API {$method} {$url} failed ({$status}): " . substr((string)$errBody, 0, 200));
        }

        return json_decode($raw, true) ?? [];
    }

    private function callGroq(string $systemPrompt, string $userPrompt): array
    {
        $apiKey = '';
        $envPath = dirname(__DIR__, 3) . '/.env';
        if (file_exists($envPath)) {
            foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
                [$k, $v] = array_map('trim', explode('=', $line, 2));
                if ($k === 'groq_api_key' || $k === 'GROQ_API_KEY') {
                    $apiKey = trim($v, '"\'');
                    break;
                }
            }
        }
        if (!$apiKey) $apiKey = getenv('groq_api_key') ?: getenv('GROQ_API_KEY') ?: '';
        if (!$apiKey) return ['ok' => false, 'error' => 'GROQ API key not configured in .env'];

        $payload = json_encode([
            'model'           => 'llama-3.3-70b-versatile',
            'messages'        => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => $userPrompt],
            ],
            'temperature'     => 0,
            'max_tokens'      => 500,
            'response_format' => ['type' => 'json_object'],
        ]);

        $context = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => implode("\r\n", [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Length: ' . strlen($payload),
                ]),
                'content'       => $payload,
                'timeout'       => 20,
                'ignore_errors' => true,
            ],
        ]);

        $response = @file_get_contents('https://api.groq.com/openai/v1/chat/completions', false, $context);
        if ($response === false) return ['ok' => false, 'error' => 'Network error reaching Groq API'];

        $json = json_decode($response, true);
        if (!$json || !isset($json['choices'][0]['message']['content'])) {
            return ['ok' => false, 'error' => 'Unexpected Groq response: ' . substr($response, 0, 200)];
        }

        $content = trim($json['choices'][0]['message']['content']);
        // Strip markdown code fences if present
        $content = preg_replace('/^```(?:json)?\s*/i', '', $content);
        $content = preg_replace('/\s*```$/i', '', $content);
        $content = trim($content);

        $parsed = json_decode($content, true);
        // Fallback: extract first {...} block in case of mixed prose+JSON
        if (!is_array($parsed)) {
            if (preg_match('/\{[\s\S]*\}/s', $content, $m)) {
                $parsed = json_decode($m[0], true);
            }
        }
        if (!is_array($parsed)) {
            return ['ok' => false, 'error' => 'Groq returned non-JSON: ' . substr($content, 0, 200)];
        }

        return ['ok' => true, 'data' => $parsed];
    }
}
