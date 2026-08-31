<?php
declare(strict_types=1);

/**
 * AI Chat Controller — multi-turn conversational interface
 * POST /admin/ops/ai-chat/message    — send a message, get structured reply
 * GET  /admin/ops/ai-chat/entities   — search entities to attach as context
 */
class AdminOpsAiChatController
{
    public function message(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $tenantId = Database::tenantId();
        $body     = $request->body();

        $userMessage   = trim((string)($body['message'] ?? ''));
        $history       = $body['history'] ?? [];
        $context       = $body['context'] ?? [];
        $pendingIntent = $body['pending_intent'] ?? null;

        if (!$userMessage) Response::error('Message is required', 422);
        if (mb_strlen($userMessage) > 1000) Response::error('Message too long', 422);

        // Build context section for system prompt
        $contextSection = '';
        if (!empty($context)) {
            $contextSection = "\n\nATTACHED CONTEXT (live data the user has pinned):\n";
            foreach ($context as $ctx) {
                $type = $ctx['type'] ?? '';
                $id   = (int)($ctx['id'] ?? 0);
                if (!$type || !$id) continue;
                $record = $this->fetchEntity($type, $id, $tenantId);
                if ($record) {
                    $contextSection .= "- {$type} #{$id}: " . json_encode($record) . "\n";
                }
            }
        }

        // Fetch entity lists — include client_id on projects so AI can build payment bodies
        $projects = Database::fetchAll(
            'SELECT id, name, stage, health, client_id FROM ops_projects WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 30',
            [$tenantId]
        );
        $clients = Database::fetchAll(
            'SELECT id, name, stage, health FROM ops_clients WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 30',
            [$tenantId]
        );
        $openBugs = Database::fetchAll(
            "SELECT id, description, priority, status FROM ops_bugs WHERE tenant_id = ? AND status NOT IN ('closed','wont_fix') ORDER BY created_at DESC LIMIT 20",
            [$tenantId]
        );

        $projectList = implode("\n", array_map(
            fn($p) => "  ID:{$p['id']} \"{$p['name']}\" (stage:{$p['stage']}, health:{$p['health']}, client_id:{$p['client_id']})",
            $projects
        ));
        $clientList = implode("\n", array_map(
            fn($c) => "  ID:{$c['id']} \"{$c['name']}\" (stage:{$c['stage']})",
            $clients
        ));
        $bugList = implode("\n", array_map(
            fn($b) => "  ID:{$b['id']} \"{$b['description']}\" ({$b['priority']}, {$b['status']})",
            $openBugs
        ));

        $today = date('Y-m-d');

        $pendingSection = '';
        if ($pendingIntent) {
            $pendingSection = "\n\nPENDING INTENT (being resolved step by step): " . json_encode($pendingIntent);
        }

        $systemPrompt = <<<SYSPROMPT
You are Kynetropo AI — an intelligent assistant for a project management ERP. You help the user manage projects, clients, meetings, bugs, payments, and expenses through natural conversation.

TODAY: {$today}

PROJECTS (id, name, stage, health, client_id):
{$projectList}

CLIENTS (id, name, stage):
{$clientList}

OPEN BUGS (id, description, priority, status):
{$bugList}
{$contextSection}{$pendingSection}

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
  Update a meeting. Common uses:
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
  Update a bug. Common uses:
  - Change status:       {"status":"open"|"in_progress"|"fixed"|"retest"|"closed"|"wont_fix"}
  - Change priority:     {"priority":"low"|"medium"|"high"|"critical"}
  - Set assignee:        {"assigned_to":"<name>"}

POST /api/admin/ops/bugs/{id}/comments
  Add a comment to a bug.
  Required: {"comment":"<text>"}
  Optional: {"due_date":"YYYY-MM-DD","added_by":"AI Assistant"}

[FINANCE]
POST /api/admin/ops/finance/payments
  Log a payment received from a client.
  Required: {"project_id":<int>,"client_id":<int>,"amount":<number>,"type":"advance"|"mid"|"final"|"amc"|"other"}
  Optional: {"mode":"bank_transfer"|"cash"|"upi"|"cheque"|"other","payment_date":"YYYY-MM-DD","recorded_by":"AI Assistant"}
  Note: client_id is visible in the PROJECTS list above as client_id.

POST /api/admin/ops/finance/expenses
  Log a business expense.
  Required: {"amount":<number>,"category":"hosting"|"tools"|"travel"|"marketing"|"salary"|"pitch"|"other"}
  Optional: {"description":"<text>","project_id":<int>,"date":"YYYY-MM-DD","added_by":"AI Assistant"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE FORMAT — always return valid JSON, nothing else:

1. If you need the user to choose an entity:
{"type":"choices","message":"Which project?","choices":[{"label":"VTT Gold","value":"project:12"},{"label":"Stabilus","value":"project:7"}],"pending_intent":{...all resolved fields so far, including method/path/body...}}

2. If you have enough information to execute:
{"type":"confirm","message":"Here's what I'll do:","preview":"<one clear sentence>","intent":{"method":"PUT","path":"/api/admin/ops/projects/12","body":{"health":"red"}}}

3. If you need more info from the user:
{"type":"question","message":"What date?","pending_intent":{...all resolved fields so far...}}

4. For general conversation or questions (no action):
{"type":"text","message":"..."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES:
- Always fill IDs from the PROJECTS / CLIENTS / BUGS lists above. Never leave them as placeholders.
- For meetings: client_id must come from the CLIENTS list. If user says "schedule meeting with Varam" → find client named Varam → use their ID.
- For payments: client_id is in the PROJECTS list (client_id field). Use it directly — no need to ask.
- For dates: always YYYY-MM-DD. Meeting date+time: YYYY-MM-DD HH:MM:SS. Relative dates resolved from TODAY={$today}.
- health must be exactly "green", "yellow", or "red".
- If user asks for two actions (e.g. "set health AND current work"), pick ONE and tell them to ask for the second separately.
- When user resolves a choices question (picks an entity), produce a "confirm" response. Copy ALL fields from pending_intent.body into intent.body — never lose previously captured values.
- pending_intent must carry forward ALL resolved data between turns: method, path, body fields, dates, amounts.
- Keep messages short and conversational.
SYSPROMPT;

        // Build messages array for Groq
        $messages = [['role' => 'system', 'content' => $systemPrompt]];

        $recentHistory = array_slice((array)$history, -20);
        foreach ($recentHistory as $turn) {
            $role    = ($turn['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $content = (string)($turn['content'] ?? '');
            if ($content) $messages[] = ['role' => $role, 'content' => $content];
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $groqResult = $this->callGroq($messages);

        if (!$groqResult['ok']) {
            Response::error('AI service unavailable: ' . ($groqResult['error'] ?? 'unknown'), 503);
        }

        $parsed = $groqResult['data'];

        // Validate type field
        $validTypes = ['text', 'question', 'choices', 'confirm'];
        if (!isset($parsed['type']) || !in_array($parsed['type'], $validTypes)) {
            $parsed = ['type' => 'text', 'message' => $groqResult['raw'] ?? 'Sorry, I could not understand that.'];
        }

        // If confirm — create an intent token so the frontend can execute it
        if ($parsed['type'] === 'confirm' && isset($parsed['intent'])) {
            $token  = bin2hex(random_bytes(32));
            $intent = $parsed['intent'];
            Database::insert('ops_ai_intents', [
                'tenant_id'   => $tenantId,
                'token'       => $token,
                'intent_type' => strtolower(str_replace(['/', ' '], '_', ($intent['method'] ?? 'unknown') . '_' . ($intent['path'] ?? ''))),
                'payload'     => json_encode([
                    'method' => $intent['method'] ?? 'PUT',
                    'path'   => $intent['path']   ?? '',
                    'body'   => $intent['body']   ?? [],
                ]),
                'preview'    => $parsed['preview'] ?? '',
                'expires_at' => date('Y-m-d H:i:s', time() + 120),
            ]);
            $parsed['token'] = $token;
        }

        Response::success($parsed);
    }

    public function entities(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $tenantId = Database::tenantId();
        $q = trim((string)($request->query('q') ?? ''));

        $results = [];

        $projects = Database::fetchAll(
            "SELECT id, name, stage FROM ops_projects WHERE tenant_id = ? AND name LIKE ? ORDER BY updated_at DESC LIMIT 8",
            [$tenantId, "%{$q}%"]
        );
        foreach ($projects as $p) {
            $results[] = ['type' => 'project', 'id' => (int)$p['id'], 'label' => $p['name'], 'sub' => 'Project · ' . $p['stage']];
        }

        $clients = Database::fetchAll(
            "SELECT id, name, stage FROM ops_clients WHERE tenant_id = ? AND name LIKE ? ORDER BY updated_at DESC LIMIT 8",
            [$tenantId, "%{$q}%"]
        );
        foreach ($clients as $c) {
            $results[] = ['type' => 'client', 'id' => (int)$c['id'], 'label' => $c['name'], 'sub' => 'Client · ' . $c['stage']];
        }

        $bugs = Database::fetchAll(
            "SELECT id, description, priority FROM ops_bugs WHERE tenant_id = ? AND description LIKE ? AND status != 'closed' ORDER BY created_at DESC LIMIT 5",
            [$tenantId, "%{$q}%"]
        );
        foreach ($bugs as $b) {
            $results[] = ['type' => 'bug', 'id' => (int)$b['id'], 'label' => '#' . $b['id'] . ' ' . mb_substr($b['description'], 0, 50), 'sub' => 'Bug · ' . $b['priority']];
        }

        $meetings = Database::fetchAll(
            "SELECT m.id, c.name as client_name, m.date FROM ops_meetings m LEFT JOIN ops_clients c ON c.id = m.client_id WHERE m.tenant_id = ? ORDER BY m.date DESC LIMIT 5",
            [$tenantId]
        );
        foreach ($meetings as $m) {
            $results[] = ['type' => 'meeting', 'id' => (int)$m['id'], 'label' => ($m['client_name'] ?? 'Meeting') . ' · ' . substr($m['date'], 0, 10), 'sub' => 'Meeting'];
        }

        Response::success($results);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function fetchEntity(string $type, int $id, int $tenantId): ?array
    {
        $tableMap = [
            'project' => ['ops_projects', 'id'],
            'client'  => ['ops_clients',  'id'],
            'bug'     => ['ops_bugs',     'id'],
            'meeting' => ['ops_meetings', 'id'],
        ];
        if (!isset($tableMap[$type])) return null;
        [$table, $pk] = $tableMap[$type];
        $row = Database::fetch("SELECT * FROM {$table} WHERE {$pk} = ? AND tenant_id = ? LIMIT 1", [$id, $tenantId]);
        return $row ?: null;
    }

    private function callGroq(array $messages): array
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
        if (!$apiKey) return ['ok' => false, 'error' => 'GROQ API key not configured'];

        $payload = json_encode([
            'model'           => 'llama-3.3-70b-versatile',
            'messages'        => $messages,
            'temperature'     => 0.2,
            'max_tokens'      => 600,
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
                'timeout'       => 25,
                'ignore_errors' => true,
            ],
        ]);

        $response = @file_get_contents('https://api.groq.com/openai/v1/chat/completions', false, $context);
        if ($response === false) return ['ok' => false, 'error' => 'Network error'];

        $json = json_decode($response, true);
        if (!isset($json['choices'][0]['message']['content'])) {
            return ['ok' => false, 'error' => 'Unexpected Groq response'];
        }

        $content = trim($json['choices'][0]['message']['content']);
        $raw = $content;

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
            return ['ok' => true, 'data' => ['type' => 'text', 'message' => $raw], 'raw' => $raw];
        }

        return ['ok' => true, 'data' => $parsed, 'raw' => $raw];
    }
}
