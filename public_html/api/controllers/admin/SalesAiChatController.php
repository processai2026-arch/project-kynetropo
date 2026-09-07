<?php
declare(strict_types=1);

/**
 * SalesAiChatController — the Kynetropo Sales AI assistant.
 *
 * A write-capable, conversational assistant for the Sales CRM, built on the
 * same principles as the reference assistant in the wider platform:
 *
 *   POST   /admin/sales-ai/message            — send a message, get a structured reply
 *   POST   /admin/sales-ai/execute            — run a confirmed action by token
 *   GET    /admin/sales-ai/conversations      — this user's recent threads
 *   GET    /admin/sales-ai/conversations/{id} — one thread, in full, to reopen it
 *   DELETE /admin/sales-ai/conversations/{id} — delete a thread
 *
 * READ  — answers a question from live data. The model names a dataset from
 *         READ_DATASETS and supplies filter VALUES which are bound as
 *         parameters into a query written here. The model never writes SQL.
 * WRITE — proposes an action, replayed through the existing REST API with the
 *         caller's own JWT, so every permission check applies to the AI too. A
 *         write is stored as a single-use, expiring token and only runs after
 *         the user confirms — and is re-validated at that moment.
 * MEMORY — the thread lives in the database, not the browser.
 *
 * "Do three things in one prompt" is supported: the model may return several
 * confirm cards in one reply (type:"actions"), each with its own token.
 */
class SalesAiChatController
{
    /** Writes the assistant may propose. Prefix match — see isAllowedPath(). */
    private const ALLOWED_PATHS = [
        'POST /admin/sales/leads',
        'PUT /admin/sales/leads/',
        'POST /admin/sales/calls',
        'POST /admin/sales/followups',
        'POST /admin/sales/meetings',
        'POST /admin/sales/tasks',
        'POST /admin/sales/challenges',
        // CRM
        'POST /admin/crm/leads',
        'PUT /admin/crm/leads/',
        'POST /admin/crm/deals',
        'PUT /admin/crm/deals/',
        'POST /admin/crm/activities',
        // Invoices — money in and reminders only. Deliberately NOT a broad
        // '/admin/invoices/' prefix: that would also match invoice creation,
        // GST and recurring endpoints. The AI may only touch these two tails,
        // matched by the {id} segment in the middle.
        'POST /admin/invoices',   // guarded below by requiring a /payments or /reminders tail
    ];

    /**
     * A second gate specifically for invoices: only the payment and reminder
     * sub-paths are permitted, never bare invoice creation. Applied inside
     * isAllowedPath().
     */
    private const INVOICE_TAILS = ['/payments', '/reminders'];

    private const MAX_ROWS              = 40;
    private const MAX_READ_HOPS         = 2;
    private const MAX_HISTORY_TURNS     = 16;
    private const INTENT_TTL_S          = 900;   // 15 minutes to confirm
    private const CONVERSATION_LIST_MAX = 30;
    private const TRANSCRIPT_MAX        = 200;
    private const MAX_ACTIONS           = 4;     // "do 3 tasks in one prompt", capped

    /**
     * Read catalog. The model names one of these and supplies filter values;
     * the SQL is written here and the values are bound as parameters. `filters`
     * maps a filter key to a WHERE fragment; `like` keys are wrapped in %…%;
     * `flags` are boolean fragments taking no parameter; the first ? is always
     * the tenant id.
     */
    private const READ_DATASETS = [
        'leads' => [
            'label' => 'Sales leads — pipeline, temperature, status, owner, next follow-up',
            'sql'   => "SELECT id, lead_code, name, company, phone, email, source, status, temperature, next_followup_at, next_meeting_at, last_activity_at, last_outcome FROM sales_leads WHERE tenant_id = ?",
            'filters' => [
                'search'      => "(name LIKE ? OR company LIKE ? OR phone LIKE ?)",
                'temperature' => "temperature = ?",
                'status'      => "status = ?",
                'source'      => "source = ?",
            ],
            'like'  => ['search'],
            'search_repeats' => 3,
            'order' => 'ORDER BY last_activity_at DESC',
        ],
        'followups' => [
            'label' => 'Follow-ups — the action queue (due today / overdue / upcoming)',
            'sql'   => "SELECT f.id, f.lead_id, l.name AS lead_name, l.company, f.due_date, f.due_time, f.status, f.purpose, f.outcome_notes FROM sales_followups f LEFT JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id WHERE f.tenant_id = ?",
            'filters' => [
                'status'   => "f.status = ?",
                'lead_id'  => "f.lead_id = ?",
                'due_from' => "f.due_date >= ?",
                'due_to'   => "f.due_date <= ?",
                'overdue'  => "(f.status = 'pending' AND f.due_date < CURDATE())",
            ],
            'flags' => ['overdue'],
            'order' => 'ORDER BY f.due_date ASC',
        ],
        'meetings' => [
            'label' => 'Meetings — scheduled and completed, physical or virtual',
            'sql'   => "SELECT m.id, m.lead_id, l.name AS lead_name, m.title, m.meeting_type, m.meeting_date, m.meeting_time, m.place, m.status, m.outcome FROM sales_meetings m LEFT JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id WHERE m.tenant_id = ?",
            'filters' => [
                'status'    => "m.status = ?",
                'lead_id'   => "m.lead_id = ?",
                'date_from' => "m.meeting_date >= ?",
                'date_to'   => "m.meeting_date <= ?",
            ],
            'order' => 'ORDER BY m.meeting_date DESC',
        ],
        'calls' => [
            'label' => 'Call history — outcome, duration, who and when',
            'sql'   => "SELECT c.id, c.lead_id, l.name AS lead_name, c.call_date, c.call_time, c.duration_minutes, c.outcome, c.called_by_name FROM sales_calls c LEFT JOIN sales_leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id WHERE c.tenant_id = ?",
            'filters' => [
                'lead_id'   => "c.lead_id = ?",
                'outcome'   => "c.outcome = ?",
                'date_from' => "c.call_date >= ?",
                'date_to'   => "c.call_date <= ?",
            ],
            'order' => 'ORDER BY c.call_date DESC, c.call_time DESC',
        ],
        'challenges' => [
            'label' => 'Sales challenges — open, accepted, in progress, completed',
            'sql'   => "SELECT id, challenge_code, title, status, priority, deadline FROM sales_challenges WHERE tenant_id = ?",
            'filters' => [
                'status'   => "status = ?",
                'priority' => "priority = ?",
            ],
            'order' => 'ORDER BY deadline ASC',
        ],
        'crm_leads' => [
            'label' => 'CRM leads — pipeline in the CRM module (status, owner, source)',
            'sql'   => "SELECT lead_id, name, company_name, email, phone, source, status FROM crm_leads WHERE tenant_id = ?",
            'filters' => [
                'search' => "(name LIKE ? OR company_name LIKE ? OR phone LIKE ?)",
                'status' => "status = ?",
                'source' => "source = ?",
            ],
            'like'  => ['search'],
            'search_repeats' => 3,
            'order' => 'ORDER BY created_at DESC',
        ],
        'crm_deals' => [
            'label' => 'CRM deals — value and stage (qualification, proposal, negotiation, won, lost)',
            'sql'   => "SELECT deal_id, title, value, currency, stage, probability, expected_close_date FROM crm_deals WHERE tenant_id = ?",
            'filters' => [
                'stage' => "stage = ?",
                'search' => "title LIKE ?",
                'min_value' => "value >= ?",
            ],
            'like'  => ['search'],
            'order' => 'ORDER BY value DESC',
        ],
        'invoices' => [
            'label' => 'Invoices — totals, amount paid, balance, status (paid / unpaid / overdue)',
            'sql'   => "SELECT invoice_id, invoice_number, customer_name, invoice_date, due_date, total, COALESCE(amount_paid,0) AS amount_paid, COALESCE(payment_status, status) AS payment_status FROM invoices WHERE tenant_id = ?",
            'filters' => [
                'search'  => "(invoice_number LIKE ? OR customer_name LIKE ?)",
                'status'  => "COALESCE(payment_status, status) = ?",
                'overdue' => "(due_date < CURDATE() AND COALESCE(amount_paid,0) < total)",
                'from'    => "invoice_date >= ?",
                'to'      => "invoice_date <= ?",
            ],
            'like'  => ['search'],
            'search_repeats' => 2,
            'flags' => ['overdue'],
            'order' => 'ORDER BY invoice_date DESC',
        ],
    ];

    // ─── message ─────────────────────────────────────────────────────────────
    public function message(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);
        SalesPermissions::assertNotLocked($request->user);

        $tenantId = Database::tenantId();
        $userId   = (int)($request->user['user_id'] ?? 0);

        $userMessage    = trim((string)$request->input('message', ''));
        $pendingIntent  = $request->input('pending_intent');
        $conversationId = (int)$request->input('conversation_id', 0);

        if (!$userMessage)                  Response::error('Message is required', 422);
        if (mb_strlen($userMessage) > 1000) Response::error('Message too long', 422);

        // The thread is the server's, not the browser's. An id that is not this
        // user's own comes back as a fresh thread rather than leaking someone
        // else's chat into the prompt.
        $conversationId = $this->resolveConversation($conversationId, $tenantId, $userId, $userMessage);

        $catalog      = $this->loadCatalog();
        $systemPrompt = $this->buildSystemPrompt($tenantId, $userMessage, $pendingIntent, $catalog);

        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        foreach ($this->loadHistory($conversationId, $tenantId) as $turn) {
            $messages[] = $turn;
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        // Recorded before the model is called, so a thread that dies on a
        // timeout still shows what was asked.
        $this->storeMessage($conversationId, $tenantId, 'user', $userMessage, null);

        // ── Read loop ────────────────────────────────────────────────────────
        // The model may ask for data before it can answer. Each hop runs one
        // whitelisted query and hands the rows back. Bounded by MAX_READ_HOPS.
        $parsed = null;
        for ($hop = 0; $hop <= self::MAX_READ_HOPS; $hop++) {
            $result = $this->callGroq($messages);
            if (!$result['ok']) {
                Response::error($result['error'] ?? 'The assistant is unavailable right now.', 503);
            }
            $parsed = $result['data'];

            if (($parsed['type'] ?? '') !== 'read' || $hop === self::MAX_READ_HOPS) break;

            $dataset = (string)($parsed['dataset'] ?? '');
            $filters = is_array($parsed['filters'] ?? null) ? $parsed['filters'] : [];
            $read    = $this->runDataset($dataset, $filters, $tenantId);

            $messages[] = ['role' => 'assistant', 'content' => json_encode($parsed)];
            $messages[] = ['role' => 'user', 'content' =>
                "DATA[{$dataset}] " . ($read['error'] ?? '')
                . json_encode($read['rows'])
                . "\nNow answer the question in plain words, or ask for the next thing you need."];
        }

        $reply = $this->finalise($parsed, $catalog, $tenantId, $userId, $conversationId);
        $reply['conversation_id'] = $conversationId;

        $this->storeMessage($conversationId, $tenantId, 'assistant',
            (string)($reply['message'] ?? ''), $reply);

        Response::success($reply);
    }

    /**
     * Turn the model's raw JSON into a safe, client-ready reply. A `confirm`
     * becomes one token; an `actions` array becomes several. Everything else
     * (text / question / choices) passes through validated.
     */
    private function finalise($parsed, array $catalog, int $tenantId, int $userId, int $conversationId): array
    {
        $type = is_array($parsed) ? ($parsed['type'] ?? 'text') : 'text';

        if ($type === 'confirm' && isset($parsed['intent'])) {
            $card = $this->armAction($parsed['intent'], (string)($parsed['preview'] ?? ''), $catalog, $tenantId, $userId, $conversationId);
            if (!$card['ok']) {
                return ['type' => 'question', 'message' => $card['error']];
            }
            return [
                'type'    => 'confirm',
                'message' => (string)($parsed['message'] ?? 'Shall I go ahead?'),
                'preview' => $card['preview'],
                'token'   => $card['token'],
                'intent'  => $card['intent'],
            ];
        }

        if ($type === 'actions' && is_array($parsed['actions'] ?? null)) {
            $cards = [];
            foreach (array_slice($parsed['actions'], 0, self::MAX_ACTIONS) as $a) {
                if (!is_array($a) || !isset($a['intent'])) continue;
                $card = $this->armAction($a['intent'], (string)($a['preview'] ?? ''), $catalog, $tenantId, $userId, $conversationId);
                if ($card['ok']) {
                    $cards[] = ['preview' => $card['preview'], 'token' => $card['token'], 'intent' => $card['intent']];
                }
            }
            if (!$cards) {
                return ['type' => 'question', 'message' => (string)($parsed['message'] ?? 'I need a little more detail to do that.')];
            }
            return [
                'type'    => 'actions',
                'message' => (string)($parsed['message'] ?? 'Here is what I will do — confirm each one:'),
                'actions' => $cards,
            ];
        }

        if ($type === 'question') {
            return ['type' => 'question', 'message' => (string)($parsed['message'] ?? 'What would you like to do?'),
                    'pending_intent' => $parsed['pending_intent'] ?? null];
        }

        if ($type === 'choices' && is_array($parsed['choices'] ?? null)) {
            return ['type' => 'choices', 'message' => (string)($parsed['message'] ?? 'Which one?'),
                    'choices' => array_values(array_filter($parsed['choices'], 'is_array')),
                    'pending_intent' => $parsed['pending_intent'] ?? null];
        }

        return ['type' => 'text', 'message' => (string)($parsed['message'] ?? 'Sorry, I could not work that out.')];
    }

    /** Validate one proposed write and mint a single-use confirm token for it. */
    private function armAction($intent, string $preview, array $catalog, int $tenantId, int $userId, int $conversationId): array
    {
        if (!is_array($intent)) return ['ok' => false, 'error' => 'That action was malformed.'];

        $method = strtoupper(trim((string)($intent['method'] ?? '')));
        $path   = trim((string)($intent['path'] ?? ''));
        $body   = is_array($intent['body'] ?? null) ? $intent['body'] : [];

        if (!$method || !$path)                    return ['ok' => false, 'error' => 'That action was incomplete.'];
        if (!$this->isAllowedPath($method, $path))  return ['ok' => false, 'error' => 'I am not allowed to do that here.'];
        if ($this->hasPlaceholder($path))           return ['ok' => false, 'error' => 'I still need to know which record that applies to.'];

        $check = $this->validateIntent($method, $path, $body, $catalog);
        if (!$check['ok']) return ['ok' => false, 'error' => $check['error']];
        $body  = $check['body'];

        $token = bin2hex(random_bytes(32));
        Database::insert('sales_ai_intents', [
            'tenant_id'       => $tenantId,
            'conversation_id' => $conversationId ?: null,
            'user_id'         => $userId ?: null,
            'token'           => $token,
            'intent_type'     => strtolower(str_replace(['/', ' ', '{', '}'], '_', $method . '_' . $path)),
            'payload'         => json_encode(['method' => $method, 'path' => $path, 'body' => $body]),
            'preview'         => mb_substr($preview !== '' ? $preview : ($method . ' ' . $path), 0, 500),
            'expires_at'      => date('Y-m-d H:i:s', time() + self::INTENT_TTL_S),
        ]);

        return [
            'ok'      => true,
            'token'   => $token,
            'preview' => $preview !== '' ? $preview : ($method . ' ' . $path),
            'intent'  => ['method' => $method, 'path' => $path, 'body' => $body],
        ];
    }

    // ─── execute ─────────────────────────────────────────────────────────────
    public function execute(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);
        SalesPermissions::assertNotLocked($request->user);

        $tenantId = Database::tenantId();
        $token    = trim((string)$request->input('token', ''));
        if (!$token) Response::error('Token is required', 422);

        // The write is replayed through the public API with the caller's own
        // JWT, so it faces exactly the checks a human would.
        $authHeader = '';
        if (function_exists('getallheaders')) {
            $hdrs = getallheaders();
            $authHeader = $hdrs['Authorization'] ?? $hdrs['authorization'] ?? '';
        }
        if (!$authHeader) $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $jwt = str_starts_with($authHeader, 'Bearer ') ? substr($authHeader, 7) : '';
        if (!$jwt) Response::error('Authorization token missing', 401);

        Database::query(
            'DELETE FROM sales_ai_intents WHERE expires_at < NOW() AND used = 0 AND tenant_id = ?',
            [$tenantId]
        );

        $intent = Database::fetch(
            'SELECT * FROM sales_ai_intents WHERE token = ? AND tenant_id = ? LIMIT 1',
            [$token, $tenantId]
        );

        if (!$intent)        Response::error('Action not found — it may have expired', 404);
        if ($intent['used']) Response::error('This action was already done', 409);
        if (strtotime($intent['expires_at']) < time()) Response::error('Action expired — please ask again', 410);

        $payload = json_decode($intent['payload'], true) ?? [];
        $method  = strtoupper(trim((string)($payload['method'] ?? '')));
        $path    = trim((string)($payload['path'] ?? ''));
        $apiBody = is_array($payload['body'] ?? null) ? $payload['body'] : [];
        $preview = (string)$intent['preview'];
        $convId  = (int)($intent['conversation_id'] ?? 0);

        if (!$method || !$path)                    Response::error('Invalid action payload', 422);
        if (!$this->isAllowedPath($method, $path))  Response::error('Blocked: ' . $method . ' ' . $path, 403);

        // Re-validate against the data as it is NOW, not as it was when proposed.
        $recheck = $this->validateIntent($method, $path, $apiBody, $this->loadCatalog());
        if (!$recheck['ok']) {
            Response::error('That no longer works: ' . $recheck['error'], 409);
        }
        $apiBody = $recheck['body'];

        // Claim the token before the call so a double-tap cannot double-write.
        Database::query(
            'UPDATE sales_ai_intents SET used = 1, used_at = NOW() WHERE token = ? AND tenant_id = ?',
            [$token, $tenantId]
        );

        try {
            $apiResponse = $this->apiCall($method, $this->getAppUrl() . $path, $apiBody, $jwt);
        } catch (\Throwable $e) {
            Database::query(
                'UPDATE sales_ai_intents SET used = 0, used_at = NULL WHERE token = ? AND tenant_id = ?',
                [$token, $tenantId]
            );
            Response::error('Could not complete that: ' . $this->userSafeError($e->getMessage()), 500);
        }

        if ($convId) {
            Database::query(
                'UPDATE sales_ai_conversations SET write_count = write_count + 1 WHERE id = ? AND tenant_id = ?',
                [$convId, $tenantId]
            );
        }

        Response::success([
            'message'         => $preview . ' — done.',
            'conversation_id' => $convId ?: null,
            'link'            => $this->resolveLink($method, $path, is_array($apiResponse) ? $apiResponse : []),
            'refresh'         => true,
        ]);
    }

    // ─── conversations ───────────────────────────────────────────────────────
    public function conversations(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $rows = Database::fetchAll(
            'SELECT id, title, message_count, write_count, last_message_at, created_at
               FROM sales_ai_conversations
              WHERE tenant_id = ? AND user_id = ?
              ORDER BY last_message_at DESC
              LIMIT ' . self::CONVERSATION_LIST_MAX,
            [Database::tenantId(), (int)($request->user['user_id'] ?? 0)]
        );
        Response::success(array_map(fn($r) => [
            'id'              => (int)$r['id'],
            'title'           => (string)$r['title'],
            'message_count'   => (int)$r['message_count'],
            'write_count'     => (int)$r['write_count'],
            'last_message_at' => $r['last_message_at'],
            'created_at'      => $r['created_at'],
        ], $rows));
    }

    public function conversation(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $id       = (int)$request->param('id');
        $tenantId = Database::tenantId();
        $userId   = (int)($request->user['user_id'] ?? 0);

        $conv = Database::fetch(
            'SELECT id, title, message_count, write_count, last_message_at, created_at
               FROM sales_ai_conversations WHERE id = ? AND tenant_id = ? AND user_id = ? LIMIT 1',
            [$id, $tenantId, $userId]
        );
        if (!$conv) Response::error('Conversation not found', 404);

        $rows = Database::fetchAll(
            'SELECT id, role, content, response, created_at FROM sales_ai_messages
              WHERE conversation_id = ? AND tenant_id = ? ORDER BY id ASC LIMIT ' . self::TRANSCRIPT_MAX,
            [$id, $tenantId]
        );

        Response::success([
            'id'            => (int)$conv['id'],
            'title'         => (string)$conv['title'],
            'message_count' => (int)$conv['message_count'],
            'write_count'   => (int)$conv['write_count'],
            'created_at'    => $conv['created_at'],
            'messages'      => array_map(fn($r) => [
                'id'         => (int)$r['id'],
                'role'       => $r['role'],
                'content'    => (string)$r['content'],
                'response'   => $r['response'] ? json_decode($r['response'], true) : null,
                'created_at' => $r['created_at'],
            ], $rows),
        ]);
    }

    public function deleteConversation(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $id       = (int)$request->param('id');
        $tenantId = Database::tenantId();
        $userId   = (int)($request->user['user_id'] ?? 0);

        $conv = Database::fetch(
            'SELECT id FROM sales_ai_conversations WHERE id = ? AND tenant_id = ? AND user_id = ? LIMIT 1',
            [$id, $tenantId, $userId]
        );
        if (!$conv) Response::error('Conversation not found', 404);

        Database::query('DELETE FROM sales_ai_messages WHERE conversation_id = ? AND tenant_id = ?', [$id, $tenantId]);
        Database::query('DELETE FROM sales_ai_conversations WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Conversation deleted']);
    }

    // ─── memory ──────────────────────────────────────────────────────────────
    private function resolveConversation(int $conversationId, int $tenantId, int $userId, string $firstMessage): int
    {
        if ($conversationId > 0) {
            $own = Database::fetch(
                'SELECT id FROM sales_ai_conversations WHERE id = ? AND tenant_id = ? AND user_id = ? LIMIT 1',
                [$conversationId, $tenantId, $userId]
            );
            if ($own) return (int)$own['id'];
        }
        return Database::insert('sales_ai_conversations', [
            'tenant_id'       => $tenantId,
            'user_id'         => $userId,
            'title'           => $this->titleFrom($firstMessage),
            'last_message_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function titleFrom(string $message): string
    {
        $t = trim((string)preg_replace('/\s+/', ' ', $message));
        return mb_strlen($t) > 60 ? mb_substr($t, 0, 57) . '…' : $t;
    }

    /** The recent turns of a thread, in the shape the model expects. */
    private function loadHistory(int $conversationId, int $tenantId): array
    {
        if ($conversationId <= 0) return [];
        $rows = Database::fetchAll(
            'SELECT role, content FROM sales_ai_messages
              WHERE conversation_id = ? AND tenant_id = ?
              ORDER BY id DESC LIMIT ' . self::MAX_HISTORY_TURNS,
            [$conversationId, $tenantId]
        );
        $turns = [];
        foreach (array_reverse($rows) as $row) {
            $content = (string)$row['content'];
            if ($content === '') continue;
            $turns[] = ['role' => $row['role'] === 'assistant' ? 'assistant' : 'user', 'content' => $content];
        }
        return $turns;
    }

    /** Append one turn. A failure here never costs the user their answer. */
    private function storeMessage(int $conversationId, int $tenantId, string $role, string $content, ?array $response): void
    {
        if ($conversationId <= 0) return;
        try {
            Database::insert('sales_ai_messages', [
                'tenant_id'       => $tenantId,
                'conversation_id' => $conversationId,
                'role'            => $role === 'assistant' ? 'assistant' : 'user',
                'content'         => $content,
                'response'        => $response ? json_encode($response) : null,
            ]);
            Database::query(
                'UPDATE sales_ai_conversations SET message_count = message_count + 1, last_message_at = NOW()
                  WHERE id = ? AND tenant_id = ?',
                [$conversationId, $tenantId]
            );
        } catch (\Throwable $e) {
            error_log('[SalesAi.storeMessage] ' . $e->getMessage());
        }
    }

    // ─── prompt ──────────────────────────────────────────────────────────────
    private function buildSystemPrompt(int $tenantId, string $userMessage, $pendingIntent, array $catalog): string
    {
        $today = date('Y-m-d');

        // A small live snapshot so the model can resolve names to IDs without a
        // read hop for the thing it needs on almost every write.
        $leadLines = '(none yet)';
        $leads = Database::fetchAll(
            "SELECT id, name, company, phone, status, temperature
             FROM sales_leads WHERE tenant_id = ? AND status != 'lost'
             ORDER BY last_activity_at DESC LIMIT 20",
            [$tenantId]
        );
        if ($leads) {
            $leadLines = '';
            foreach ($leads as $l) {
                $leadLines .= "  {$l['id']}|" . $this->aiSafe((string)$l['name']) . '|'
                    . $this->aiSafe((string)$l['company'], 40) . '|'
                    . $this->aiSafe((string)$l['phone'], 20) . '|'
                    . $l['status'] . '|' . $l['temperature'] . "\n";
            }
        }

        $datasetLines = [];
        foreach (self::READ_DATASETS as $name => $spec) {
            $f = array_keys($spec['filters'] ?? []);
            $datasetLines[] = "{$name} — {$spec['label']}" . ($f ? "\n  filters: " . implode(', ', $f) : '');
        }
        $datasetText = implode("\n", $datasetLines);

        $actionLines = [];
        foreach ($catalog as $key => $spec) {
            $req = $this->describeFields($spec['required'] ?? []);
            $opt = $this->describeFields($spec['optional'] ?? []);
            $desc = trim((string)($spec['description'] ?? ''));
            $actionLines[] = "{$key} — {$spec['label']}"
                . ($desc ? "\n  note: {$desc}" : '')
                . ($req ? "\n  REQUIRED: " . implode('; ', $req) : '')
                . ($opt ? "\n  optional: " . implode('; ', $opt) : '');
        }
        $actionText = implode("\n\n", $actionLines);

        $pendingSection = $pendingIntent
            ? "\n\nPENDING (merge the user's reply into it, then re-check what is still needed):\n" . json_encode($pendingIntent)
            : '';
        $maxActions = (string)self::MAX_ACTIONS;

        return <<<SYSPROMPT
You are the Sales assistant inside Kynetropo's CRM. You speak plainly, like a
capable sales manager. Never mention models, providers, APIs, endpoints, tables
or JSON to the user — talk about leads, calls, follow-ups, meetings and tasks.

Reply with VALID JSON ONLY. TODAY={$today}.
FORMATS: date=YYYY-MM-DD | time=HH:MM | datetime="YYYY-MM-DD HH:MM:SS".

LIVE LEADS (id|name|company|phone|status|temperature — use these REAL ids, never a placeholder):
{$leadLines}

READS — to answer any question about data you don't already have:
{$datasetText}

ACTIONS — REQUIRED fields must be collected before you propose; only include an
optional field if the user actually said it, and never ask for one:
{$actionText}
{$pendingSection}

RESPONSE SHAPES — pick exactly one and return only that JSON object:

1. Answer needs data not in the snapshot:
   {"type":"read","dataset":"<name>","filters":{...}}
   You will be handed the rows, then answer with type text.

2. Answer from what you know:
   {"type":"text","message":"<plain answer with the numbers in it>"}

3. You are missing a REQUIRED field:
   {"type":"question","message":"<ask for the one missing thing>",
    "pending_intent":{"method":"<M>","path":"<P>","body":{...known...}}}

4. Several records could match, or a field is a fixed set:
   {"type":"choices","message":"<which one?>",
    "choices":[{"label":"Acme — hot","value":"12"}],"pending_intent":{...}}

5. ONE action, ready to do:
   {"type":"confirm","message":"<what you will do, in words>",
    "preview":"<one-line summary the user approves>",
    "intent":{"method":"POST","path":"/admin/sales/leads","body":{...}}}

6. SEVERAL actions in one prompt ("add a lead, log a call, book a meeting"):
   {"type":"actions","message":"<overview>",
    "actions":[
      {"preview":"Add lead Acme","intent":{"method":"POST","path":"/admin/sales/leads","body":{...}}},
      {"preview":"Log a call","intent":{"method":"POST","path":"/admin/sales/calls","body":{...}}}
    ]}
   Up to {$maxActions} actions. Each is confirmed on its own.

RULES:
- Paths must match an ACTION above exactly. A {id} in a path must be a real id
  from the snapshot or a read — never the literal "{id}".
- Put fields the user gave into body; leave the rest out. Do not invent phones,
  emails or amounts.
- If the user asks to do something and you have everything, go straight to
  confirm/actions — do not ask "shall I?" as a question.
SYSPROMPT;
    }

    /**
     * Render a field map for the prompt: each field as name(type), and for an
     * enum the exact allowed values, so the model uses tokens like
     * "not_picked_up" verbatim rather than paraphrasing them.
     */
    private function describeFields(array $fields): array
    {
        $out = [];
        foreach ($fields as $name => $rule) {
            $rule = is_array($rule) ? $rule : [];
            $type = $rule['type'] ?? 'string';
            if ($type === 'enum' && !empty($rule['values'])) {
                $out[] = "{$name} (one of: " . implode('|', $rule['values']) . ')';
            } else {
                $out[] = "{$name} ({$type})";
            }
        }
        return $out;
    }

    // ─── dataset runner ──────────────────────────────────────────────────────
    private function runDataset(string $name, array $filters, int $tenantId): array
    {
        $spec = self::READ_DATASETS[$name] ?? null;
        if (!$spec) return ['rows' => [], 'error' => "(unknown dataset '{$name}') "];

        $sql     = $spec['sql'];
        $params  = [$tenantId];
        $clauses = [];
        $likeSet = array_flip($spec['like']  ?? []);
        $flagSet = array_flip($spec['flags'] ?? []);

        foreach ($filters as $key => $value) {
            $fragment = $spec['filters'][$key] ?? null;
            if ($fragment === null) continue;             // unknown filter — ignored

            if (isset($flagSet[$key])) {
                if ($value === false || $value === 'false' || $value === 0 || $value === '0') continue;
                $clauses[] = $fragment;
                continue;
            }
            if ($value === null || $value === '' || is_array($value)) continue;

            $clauses[] = $fragment;
            if (isset($likeSet[$key])) {
                $repeats = (int)($spec['search_repeats'] ?? 1);
                for ($i = 0; $i < $repeats; $i++) $params[] = '%' . (string)$value . '%';
            } else {
                $params[] = $value;
            }
        }

        if ($clauses) $sql .= ' AND ' . implode(' AND ', $clauses);
        if (!empty($spec['order'])) $sql .= ' ' . $spec['order'];
        $sql .= ' LIMIT ' . self::MAX_ROWS;

        try {
            $rows = Database::fetchAll($sql, $params) ?: [];
        } catch (\Throwable $e) {
            error_log('[SalesAi.read:' . $name . '] ' . $e->getMessage());
            return ['rows' => [], 'error' => '(this data is unavailable right now) '];
        }

        foreach ($rows as &$row) {
            foreach ($row as $k => $v) {
                if (is_string($v)) $row[$k] = $this->aiSafe($v, 160);
            }
        }
        unset($row);

        return ['rows' => $rows, 'error' => null];
    }

    // ─── intent validation ───────────────────────────────────────────────────
    private function loadCatalog(): array
    {
        static $cache = null;
        if ($cache !== null) return $cache;
        $path = dirname(__DIR__, 2) . '/ai/sales-endpoint-catalog.json';
        $cache = file_exists($path) ? (json_decode((string)file_get_contents($path), true) ?? []) : [];
        return $cache;
    }

    /** @return array{ok:bool, body?:array, error?:string} */
    private function validateIntent(string $method, string $path, array $body, array $catalog): array
    {
        $tenantId = Database::tenantId();
        [$spec, $pattern] = $this->matchCatalogEntry($method, $path, $catalog);
        if (!$spec) {
            // No metadata — the API's own validator is still in front of it.
            return ['ok' => true, 'body' => $body];
        }

        $required = $spec['required'] ?? [];
        $optional = $spec['optional'] ?? [];
        $fields   = $required + $optional;
        $allowed  = array_keys($fields);

        // {id} in the route is filled from the URL, not the body.
        $pathParams = [];
        if ($pattern && preg_match_all('/\{([a-zA-Z_]+)\}/', $pattern, $mm)) $pathParams = $mm[1];

        $clean = [];
        foreach ($body as $key => $value) {
            if (in_array($key, $pathParams, true)) continue;
            if (!in_array($key, $allowed, true)) continue;   // drop unexpected fields
            if ($value === null || $value === '') continue;

            $rule = $fields[$key] ?? null;
            $r = $this->coerceField($key, $value, is_array($rule) ? $rule : [], $tenantId);
            if (!$r['ok']) return ['ok' => false, 'error' => $r['error']];
            $clean[$key] = $r['value'];
        }

        foreach (array_keys($required) as $key) {
            if (in_array($key, $pathParams, true)) continue;
            if (!array_key_exists($key, $clean)) {
                $label = $required[$key]['label'] ?? $key;
                return ['ok' => false, 'error' => "I still need the {$label} for this."];
            }
        }
        return ['ok' => true, 'body' => $clean];
    }

    /** Coerce and range-check one field against its declared rule. */
    private function coerceField(string $key, $value, array $rule, int $tenantId = 0): array
    {
        $label = $rule['label'] ?? $key;
        $type  = $rule['type'] ?? 'string';

        switch ($type) {
            case 'int':
            case 'float':
                $raw = is_string($value) ? preg_replace('/[^0-9.\-]/', '', $value) : $value;
                if ($raw === '' || !is_numeric($raw)) return ['ok' => false, 'error' => "The {$label} needs to be a number."];
                $num = $type === 'int' ? (int)$raw : (float)$raw;
                if (isset($rule['min']) && $num < $rule['min']) return ['ok' => false, 'error' => "The {$label} can't be below {$rule['min']}."];
                if (isset($rule['max']) && $num > $rule['max']) return ['ok' => false, 'error' => "The {$label} looks too large."];
                return ['ok' => true, 'value' => $num];

            case 'enum':
                $v = strtolower(trim((string)$value));
                $vals = array_map('strtolower', $rule['values'] ?? []);
                if (!in_array($v, $vals, true)) {
                    return ['ok' => false, 'error' => "The {$label} must be one of: " . implode(', ', $rule['values'] ?? [])];
                }
                return ['ok' => true, 'value' => $v];

            case 'email':
                $v = trim((string)$value);
                if (!filter_var($v, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'error' => "That {$label} doesn't look right."];
                return ['ok' => true, 'value' => $v];

            case 'date':
                $v = trim((string)$value);
                $d = DateTime::createFromFormat('Y-m-d', $v);
                if (!$d || $d->format('Y-m-d') !== $v) return ['ok' => false, 'error' => "The {$label} must be a date like 2026-01-31."];
                return ['ok' => true, 'value' => $v];

            case 'time':
                $v = trim((string)$value);
                if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $v)) return ['ok' => false, 'error' => "The {$label} must be a time like 15:30."];
                return ['ok' => true, 'value' => $v];

            case 'datetime':
                $v = trim((string)$value);
                if (!preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/', $v)) {
                    return ['ok' => false, 'error' => "The {$label} must be like 2026-01-31 15:30:00."];
                }
                return ['ok' => true, 'value' => str_replace('T', ' ', $v)];

            case 'ref':
                $id = (int)$value;
                if ($id <= 0) return ['ok' => false, 'error' => "I need to know which {$label}."];
                // Prove the referenced record actually exists in THIS tenant, so
                // the assistant cannot propose an action against a deleted or
                // foreign record. Only whitelisted tables are ever queried.
                $table = $rule['table'] ?? '';
                if ($tenantId > 0 && $table !== '' && !$this->refExists($table, $id, $tenantId)) {
                    return ['ok' => false, 'error' => "I couldn't find that {$label} — which one did you mean?"];
                }
                return ['ok' => true, 'value' => $id];

            default:
                return ['ok' => true, 'value' => is_string($value) ? trim($value) : $value];
        }
    }

    /**
     * Does a referenced record exist in this tenant? Only the tables named in
     * the catalog's ref rules are ever consulted, and each maps to a fixed
     * primary-key column here — the table name from the model is checked against
     * this allowlist, never interpolated blindly.
     */
    private function refExists(string $table, int $id, int $tenantId): bool
    {
        static $pk = [
            'sales_leads' => 'id',
            'users'       => 'user_id',
            'ops_clients' => 'id',
            'crm_leads'   => 'lead_id',
            'crm_deals'   => 'deal_id',
            'invoices'    => 'invoice_id',
        ];
        if (!isset($pk[$table])) return true;   // unknown ref table — let the API validate
        $col = $pk[$table];
        try {
            $row = Database::fetch(
                "SELECT {$col} FROM {$table} WHERE {$col} = ? AND tenant_id = ? LIMIT 1",
                [$id, $tenantId]
            );
            return (bool)$row;
        } catch (\Throwable $e) {
            error_log('[SalesAi.refExists] ' . $e->getMessage());
            return true;   // never block a real action on a lookup failure
        }
    }

    private function matchCatalogEntry(string $method, string $path, array $catalog): array
    {
        $needle = strtoupper($method) . ' ' . $path;
        foreach ($catalog as $key => $spec) {
            // Turn "PUT /admin/sales/leads/{id}" into a regex. Split on the
            // {placeholder} tokens, quote the literal parts, and drop [^/]+ in
            // for each token — quoting the whole string first would escape the
            // braces and break the substitution.
            $regex = preg_replace_callback('/\{[a-zA-Z_]+\}|[^{]+/', function ($m) {
                $piece = $m[0];
                return (strlen($piece) > 1 && $piece[0] === '{' && substr($piece, -1) === '}')
                    ? '[^/]+'
                    : preg_quote($piece, '#');
            }, $key);
            if (preg_match('#^' . $regex . '$#', $needle)) return [$spec, $key];
        }
        return [null, null];
    }

    // ─── infra helpers ───────────────────────────────────────────────────────
    private function isAllowedPath(string $method, string $path): bool
    {
        $method = strtoupper($method);

        // Invoices are special-cased: a POST to /admin/invoices is only allowed
        // when it targets an existing invoice's /payments or /reminders tail.
        // Bare "POST /admin/invoices" (create) and other sub-paths are refused.
        if ($method === 'POST' && str_starts_with($path, '/admin/invoices')) {
            foreach (self::INVOICE_TAILS as $tail) {
                if (str_ends_with($path, $tail)) return true;
            }
            return false;
        }

        $key = $method . ' ' . $path;
        foreach (self::ALLOWED_PATHS as $prefix) {
            if ($prefix === 'POST /admin/invoices') continue;   // handled above
            if (str_starts_with($key, $prefix)) return true;
        }
        return false;
    }

    private function hasPlaceholder(string $path): bool
    {
        return str_contains($path, '{') || str_contains($path, '}');
    }

    /** Strip control characters and cap length for anything the model reads back. */
    private function aiSafe(string $s, int $maxLen = 60): string
    {
        $s = (string)preg_replace('/[\x00-\x1F\x7F]/u', ' ', $s);
        return mb_strlen($s) > $maxLen ? mb_substr($s, 0, $maxLen - 1) . '…' : $s;
    }

    private function userSafeError(string $raw): string
    {
        $raw = (string)preg_replace('/https?:\/\/\S+/', '', $raw);
        return mb_substr(trim($raw), 0, 200);
    }

    /** Where to go and verify what was just saved. */
    private function resolveLink(string $method, string $path, array $response): array
    {
        $data = $response['data'] ?? $response;
        if (str_starts_with($path, '/admin/sales/leads')) {
            $id = (int)($data['id'] ?? ($data['lead']['id'] ?? 0));
            if ($id) return ['label' => 'Open the lead', 'route' => "/sales/leads/{$id}"];
            return ['label' => 'View leads', 'route' => '/sales/leads'];
        }
        if (str_starts_with($path, '/admin/sales/followups')) return ['label' => 'View follow-ups', 'route' => '/sales/followups'];
        if (str_starts_with($path, '/admin/sales/meetings'))  return ['label' => 'View meetings', 'route' => '/sales/meetings'];
        if (str_starts_with($path, '/admin/sales/calls'))      return ['label' => 'View call history', 'route' => '/sales/calls'];
        if (str_starts_with($path, '/admin/sales/tasks'))      return ['label' => 'View tasks', 'route' => '/sales/tasks'];
        if (str_starts_with($path, '/admin/sales/challenges')) return ['label' => 'View challenges', 'route' => '/sales/challenges'];
        // CRM and Invoices are served by a different frontend than the one this
        // assistant lives in, so there is no in-app route to deep-link to here.
        // The action still succeeds; we simply omit a "go and look" link rather
        // than hand back one that would 404. Returning an empty route signals
        // the client to show no link button.
        if (str_starts_with($path, '/admin/crm'))      return ['label' => '', 'route' => ''];
        if (str_starts_with($path, '/admin/invoices')) return ['label' => '', 'route' => ''];
        return ['label' => 'Open Sales', 'route' => '/sales'];
    }

    /** Reads an .env value one level above the api directory. */
    private function env(string $key): string
    {
        static $env = null;
        if ($env === null) {
            $env = [];
            $path = dirname(__DIR__, 3) . '/.env';
            if (is_file($path)) {
                foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                    if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
                    [$k, $v] = array_map('trim', explode('=', $line, 2));
                    $env[strtolower($k)] = trim($v, "\"'");
                }
            }
        }
        return $env[strtolower($key)] ?? (getenv($key) ?: '');
    }

    private function getAppUrl(): string
    {
        $url = $this->env('APP_URL');
        if ($url) return rtrim($url, '/') . '/api';
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/api';
    }

    private function apiCall(string $method, string $url, array $body, string $jwt): array
    {
        $payload = json_encode($body);
        $context = stream_context_create(['http' => [
            'method'  => $method,
            'header'  => implode("\r\n", [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $jwt,
                'Content-Length: ' . strlen($payload),
            ]),
            'content'       => $payload,
            'timeout'       => 15,
            'ignore_errors' => true,
        ]]);

        $raw    = @file_get_contents($url, false, $context);
        $status = 0;
        if (!empty($http_response_header)) {
            preg_match('/HTTP\/\d\.\d\s+(\d+)/', $http_response_header[0], $m);
            $status = (int)($m[1] ?? 0);
        }
        if ($raw === false) throw new \RuntimeException("API {$method} {$url} failed: network error");
        if ($status >= 400) {
            $errBody = json_decode($raw, true)['message'] ?? $raw;
            throw new \RuntimeException(substr((string)$errBody, 0, 200));
        }
        if (str_starts_with(ltrim($raw), '<')) throw new \RuntimeException('API returned HTML — check APP_URL');
        return json_decode($raw, true) ?? [];
    }

    // ─── model provider (swappable; never named to the user) ─────────────────
    private function callGroq(array $messages): array
    {
        $apiKey = $this->env('groq_api_key') ?: $this->env('GROQ_API_KEY');
        if (!$apiKey) return ['ok' => false, 'error' => 'The assistant is not configured yet.'];

        $payload = json_encode([
            'model'           => $this->env('groq_model') ?: 'llama-3.3-70b-versatile',
            'messages'        => $messages,
            'temperature'     => 0.1,
            'max_tokens'      => 1200,
            'response_format' => ['type' => 'json_object'],
        ]);
        $context = stream_context_create(['http' => [
            'method'        => 'POST',
            'header'        => implode("\r\n", [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
                'Content-Length: ' . strlen($payload),
            ]),
            'content'       => $payload,
            'timeout'       => 25,
            'ignore_errors' => true,
        ]]);

        $response = @file_get_contents('https://api.groq.com/openai/v1/chat/completions', false, $context);
        if ($response === false) return ['ok' => false, 'error' => 'The assistant could not be reached. Please try again.'];

        $json = json_decode($response, true);
        $text = $json['choices'][0]['message']['content'] ?? null;
        if ($text === null) {
            $detail = (string)($json['error']['message'] ?? '');
            error_log('[SalesAi] provider error: ' . mb_substr($detail, 0, 500));
            if (preg_match('/try again in ([\d]+m[\d.]+s|[\d.]+s)/i', $detail, $m)) {
                return ['ok' => false, 'error' => 'The assistant is busy — try again in ' . $m[1] . '.'];
            }
            return ['ok' => false, 'error' => 'The assistant could not answer that. Please try again.'];
        }
        return $this->parseModelJson((string)$text);
    }

    /** Models sometimes fence their JSON or wrap it in prose. Dig it out. */
    private function parseModelJson(string $text): array
    {
        $raw     = trim($text);
        $content = trim((string)preg_replace('/^```(?:json)?\s*/i', '', $raw));
        $content = trim((string)preg_replace('/\s*```$/i', '', $content));

        $parsed = json_decode($content, true);
        if (!is_array($parsed) && preg_match('/\{[\s\S]*\}/s', $content, $m)) {
            $parsed = json_decode($m[0], true);
        }
        if (!is_array($parsed)) {
            return ['ok' => true, 'data' => ['type' => 'text', 'message' => $raw]];
        }
        return ['ok' => true, 'data' => $parsed];
    }
}
