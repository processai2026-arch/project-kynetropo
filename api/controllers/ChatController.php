<?php
declare(strict_types=1);

require_once ROOT_PATH . '/models/ChatConversation.php';
require_once ROOT_PATH . '/models/ChatMessage.php';

/**
 * ChatController — the Kynetropo in-app AI assistant.
 *
 * Two distinct flows share this controller:
 *
 *  1. Legacy public-website widget (unauthenticated): keyword-triggered
 *     DataBridge context + Groq, persisted in `chat_sessions`/`chat_messages`.
 *     This is preserved untouched for backward compatibility.
 *
 *  2. In-app cross-module assistant (authenticated tenant users): a safe,
 *     READ-ONLY "intent" layer that fetches tenant-scoped data for the modules
 *     the question is about (sales, invoices, orders, inventory, procurement,
 *     expenses, finance, payroll, HR/attendance, customers, CRM, quotes, tasks),
 *     plus a proactive daily briefing / suggestion-chips capability. History is
 *     persisted per tenant + user in `chat_conversations` /
 *     `chat_conversation_messages`.
 *
 * SAFETY: every query in the intent layer is scoped by Database::tenantId().
 * The assistant NEVER performs writes against business data.
 */
class ChatController
{
    private const HISTORY_LIMIT = 6;

    // ─── Legacy system prompt (public site) ─────────────────────────────────────
    private static function systemPrompt(): string
    {
        $companyName = self::companyName();

        return "You are the {$companyName} Assistant, an AI for {$companyName}.\n"
            . "You have access to live business data provided below as context.\n"
            . "Be concise, accurate, professional and ALWAYS give a useful answer.\n"
            . "If the live data above answers the question, use it. If it does NOT, still respond "
            . "confidently with a realistic, standard example relevant to the question — typical "
            . "figures, names and statuses a business like this would have. NEVER reply that you "
            . "don't have the information, and never tell the user to contact the team.";
    }

    /** In-app assistant system prompt — broader, business-owner oriented. */
    private static function assistantPrompt(): string
    {
        $companyName = self::companyName();
        $today       = date('l, d M Y');

        return "You are the Kynetropo Assistant for {$companyName}. Today is {$today}.\n"
            . "You help the business owner and staff across ALL modules: sales & invoices, orders, "
            . "inventory/stock movements, procurement (purchase orders and vendor bills), expenses, "
            . "finance/cash, payroll runs, HR/employees/attendance/leave, customers and customer health, "
            . "CRM leads/deals/pipeline, quote requests and sales quotations, tasks, meetings, dealers, "
            . "invoices/credit notes, GST compliance, products and pricing.\n\n"
            . "Below is LIVE, tenant-specific business data. Use ONLY this data to answer with "
            . "concrete numbers (use Indian Rupees ₹). Be concise, direct and practical — answer "
            . "in a few short sentences or a tight bullet list. When useful, point the user to the "
            . "relevant module to act (e.g. \"open Invoices to follow up\"). You can ANSWER and "
            . "GUIDE, but you cannot perform actions or change any data yourself.\n"
            . "If the live data covers the question, answer from it. If it does NOT, still give a "
            . "helpful, standard example answer relevant to the question (typical figures, names "
            . "and statuses for a business like this) and point to the right module to act. NEVER "
            . "reply that you don't have the information or ask the user to contact the team.";
    }

    /** Current tenant's company name with a neutral fallback. */
    private static function companyName(): string
    {
        try {
            $row = Database::fetch(
                "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_name' LIMIT 1",
                [Database::tenantId()]
            );
            if (!empty($row['setting_value'])) {
                return (string)$row['setting_value'];
            }
        } catch (\Throwable $e) {
            // fall through
        }
        return 'this company';
    }

    /** True when the request carries an authenticated tenant user. */
    private static function isAuthenticated(Request $request): bool
    {
        return !empty($request->user['user_id']);
    }

    // ── POST /chat ─────────────────────────────────────────────────────────────
    /**
     * Modes (via `mode` field):
     *   - (default) "chat"        → grounded Q&A
     *   - "briefing"              → proactive daily briefing
     *   - "suggestions"           → suggestion chips for what to ask
     */
    public function send(Request $request): void
    {
        $mode = strtolower(trim((string)($request->input('mode') ?? 'chat')));

        if ($mode === 'briefing') {
            $this->briefing($request);
            return;
        }
        if ($mode === 'suggestions') {
            $this->suggestions($request);
            return;
        }

        // Authenticated in-app assistant uses the richer intent layer + per-user history.
        if (self::isAuthenticated($request)) {
            $this->sendAssistant($request);
            return;
        }

        // ── Legacy public-website flow (unchanged) ─────────────────────────────
        $this->sendLegacy($request);
    }

    // ── In-app assistant chat ───────────────────────────────────────────────────
    private function sendAssistant(Request $request): void
    {
        $message = trim((string)($request->input('message') ?? ''));
        if ($message === '') {
            Response::error('Message is required', 400);
        }
        if (mb_strlen($message) > 2000) {
            Response::error('Message too long (max 2000 chars)', 400);
        }

        $userId         = (int)$request->user['user_id'];
        $conversationId = (int)($request->input('conversation_id') ?? 0);
        $pageContext    = trim((string)($request->input('context') ?? ''));

        // Resolve / create the tenant + user scoped conversation.
        if ($conversationId > 0) {
            $conv = ChatConversation::find($conversationId, $userId);
            if (!$conv) {
                $conversationId = 0;
            }
        }
        $isNew = false;
        if ($conversationId === 0) {
            $conversationId = ChatConversation::create($userId, $message);
            $isNew = true;
        }

        // ── Build grounded, tenant-scoped context for the relevant modules ──────
        $context = $this->buildContext($message, $pageContext);

        // ── Assemble LLM messages ──────────────────────────────────────────────
        $messages = [[
            'role'    => 'system',
            'content' => self::assistantPrompt() . "\n\n## Live Business Data\n" . $context,
        ]];
        foreach (ChatMessage::recent($conversationId, 8) as $h) {
            $messages[] = ['role' => $h['role'], 'content' => $h['content']];
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        $reply = $this->callGroq($messages, 700);

        // ── Persist (tenant + user scoped) ─────────────────────────────────────
        ChatMessage::add($conversationId, ChatMessage::ROLE_USER, $message);
        ChatMessage::add($conversationId, ChatMessage::ROLE_ASSISTANT, $reply);
        if ($isNew) {
            ChatConversation::rename($conversationId, $this->deriveTitle($message));
        }

        Response::success([
            'conversation_id' => $conversationId,
            'reply'           => $reply,
        ], 'OK');
    }

    // ── Legacy public-website chat (preserved) ──────────────────────────────────
    private function sendLegacy(Request $request): void
    {
        $message   = trim((string)($request->input('message') ?? ''));
        $sessionId = trim((string)($request->input('session_id') ?? ''));

        if ($message === '') Response::error('Message is required', 400);
        if (strlen($message) > 2000) Response::error('Message too long (max 2000 chars)', 400);

        if ($sessionId === '') {
            $sessionId = bin2hex(random_bytes(16));
        }

        $userId = $request->user['user_id'] ?? null;
        $this->ensureSession($sessionId, $userId);

        $context  = DataBridge::fetchContext($message);
        $history  = $this->getHistory($sessionId, self::HISTORY_LIMIT);
        $messages = [[
            'role'    => 'system',
            'content' => self::systemPrompt() . "\n\n## Live Business Data:\n" . $context,
        ]];
        foreach ($history as $h) {
            $messages[] = ['role' => $h['role'], 'content' => $h['content']];
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        $reply = $this->callGroq($messages, 512);

        $this->saveMessage($sessionId, 'user',      $message);
        $this->saveMessage($sessionId, 'assistant', $reply);

        Response::success([
            'session_id' => $sessionId,
            'reply'      => $reply,
        ], 'OK');
    }

    // ── GET /chat/history ───────────────────────────────────────────────────────
    /**
     * Authenticated: GET /chat/history?conversation_id=N  → messages of that thread.
     *                GET /chat/history (no id)            → list of conversations.
     * Legacy:        GET /chat/history?session_id=xxx     → legacy messages.
     */
    public function history(Request $request): void
    {
        if (self::isAuthenticated($request)) {
            $userId = (int)$request->user['user_id'];
            $convId = (int)($request->query('conversation_id') ?? 0);

            if ($convId > 0) {
                $conv = ChatConversation::find($convId, $userId);
                if (!$conv) {
                    Response::error('Conversation not found', 404);
                }
                Response::success(ChatMessage::forConversation($convId));
            }

            // No conversation id → return the user's conversation list.
            Response::success([
                'conversations' => ChatConversation::listForUser($userId, 20),
            ]);
        }

        // Legacy session history.
        $sessionId = trim((string)($request->query('session_id') ?? ''));
        if ($sessionId === '') Response::error('session_id is required', 400);

        $messages = Database::fetchAll(
            "SELECT role, content, created_at FROM chat_messages
             WHERE session_id = ? AND tenant_id = ? ORDER BY created_at ASC",
            [$sessionId, Database::tenantId()]
        );

        Response::success($messages);
    }

    // ── Proactive daily briefing (mode=briefing on POST /chat) ──────────────────
    /**
     * Returns a structured list of items that need the owner's attention right now,
     * plus a one-paragraph natural-language summary. All data is tenant-scoped and
     * read-only. This is the key work-reducing feature.
     */
    public function briefing(Request $request): void
    {
        if (!self::isAuthenticated($request)) {
            Response::error('Authentication required', 401);
        }

        $items   = [];
        $metrics = $this->collectMetrics();

        // Overdue / unpaid receivables
        if ($metrics['overdue_invoices']['count'] > 0) {
            $items[] = [
                'module'   => 'Invoices',
                'severity' => 'high',
                'title'    => "{$metrics['overdue_invoices']['count']} overdue invoice(s)",
                'detail'   => '₹' . number_format($metrics['overdue_invoices']['amount'], 2) . ' awaiting collection',
            ];
        } elseif ($metrics['unpaid_invoices']['count'] > 0) {
            $items[] = [
                'module'   => 'Invoices',
                'severity' => 'medium',
                'title'    => "{$metrics['unpaid_invoices']['count']} unpaid invoice(s)",
                'detail'   => '₹' . number_format($metrics['unpaid_invoices']['amount'], 2) . ' outstanding',
            ];
        }

        // Low stock
        if ($metrics['low_stock']['count'] > 0) {
            $items[] = [
                'module'   => 'Inventory',
                'severity' => 'high',
                'title'    => "{$metrics['low_stock']['count']} SKU(s) below reorder level",
                'detail'   => $metrics['low_stock']['names'] !== ''
                    ? 'Reorder soon: ' . $metrics['low_stock']['names']
                    : 'Reorder soon to avoid stock-outs',
            ];
        }

        // Open purchase orders
        if ($metrics['open_pos']['count'] > 0) {
            $items[] = [
                'module'   => 'Procurement',
                'severity' => 'low',
                'title'    => "{$metrics['open_pos']['count']} open purchase order(s)",
                'detail'   => '₹' . number_format($metrics['open_pos']['amount'], 2) . ' in pending POs',
            ];
        }

        // Pending payroll
        if ($metrics['pending_payroll']['count'] > 0) {
            $items[] = [
                'module'   => 'Payroll',
                'severity' => 'medium',
                'title'    => "{$metrics['pending_payroll']['count']} payroll record(s) not yet paid",
                'detail'   => '₹' . number_format($metrics['pending_payroll']['amount'], 2) . ' net pay pending',
            ];
        }

        // Overdue tasks
        if ($metrics['overdue_tasks'] > 0) {
            $items[] = [
                'module'   => 'Tasks',
                'severity' => 'medium',
                'title'    => "{$metrics['overdue_tasks']} overdue task(s)",
                'detail'   => 'Past their due date and not completed',
            ];
        }

        // Today's attendance gaps
        if ($metrics['attendance']['absent'] > 0 || $metrics['attendance']['on_leave'] > 0) {
            $items[] = [
                'module'   => 'Attendance',
                'severity' => 'low',
                'title'    => "Today: {$metrics['attendance']['present']} present, "
                    . "{$metrics['attendance']['absent']} absent, {$metrics['attendance']['on_leave']} on leave",
                'detail'   => 'Staff availability for today',
            ];
        }

        // Hot CRM deals
        if ($metrics['pipeline']['open_count'] > 0) {
            $items[] = [
                'module'   => 'CRM',
                'severity' => 'low',
                'title'    => "{$metrics['pipeline']['open_count']} open deal(s) in pipeline",
                'detail'   => '₹' . number_format($metrics['pipeline']['open_value'], 2) . ' potential value',
            ];
        }

        // New quote requests
        if ($metrics['pending_quotes'] > 0) {
            $items[] = [
                'module'   => 'Quotes',
                'severity' => 'low',
                'title'    => "{$metrics['pending_quotes']} pending quote request(s)",
                'detail'   => 'Awaiting a response',
            ];
        }

        // Natural-language summary via Groq (best-effort; never blocks the data).
        $summary = $this->briefingSummary($items);

        Response::success([
            'date'    => date('Y-m-d'),
            'summary' => $summary,
            'items'   => $items,
        ], 'OK');
    }

    // ── Suggestion chips (mode=suggestions on POST /chat) ───────────────────────
    public function suggestions(Request $request): void
    {
        // Static, high-value starter prompts spanning modules. Cheap and reliable.
        Response::success([
            'suggestions' => [
                'What needs my attention today?',
                'Which invoices are overdue?',
                'Which items are below reorder level?',
                "Show today's attendance",
                'What is my open sales pipeline value?',
                'Any payroll runs pending?',
                'Which open purchase orders do I have?',
                'Top customers by revenue',
            ],
        ], 'OK');
    }

    // ── GET /admin/chat/sessions (legacy admin view, preserved) ─────────────────
    public function sessions(Request $request): void
    {
        $page   = max(1, (int)($request->query('page', 1)));
        $offset = ($page - 1) * 20;

        $rows = Database::fetchAll(
            "SELECT s.session_id, s.user_id, u.name AS user_name, u.email,
                    COUNT(m.id) AS message_count,
                    MAX(m.created_at) AS last_message_at,
                    s.created_at
             FROM chat_sessions s
             LEFT JOIN users u ON u.user_id = s.user_id AND u.tenant_id = s.tenant_id
             LEFT JOIN chat_messages m ON m.session_id = s.session_id AND m.tenant_id = s.tenant_id
             WHERE s.tenant_id = ?
             GROUP BY s.session_id
             ORDER BY last_message_at DESC
             LIMIT 20 OFFSET ?",
            [Database::tenantId(), $offset]
        );

        $total = (int) Database::fetch("SELECT COUNT(*) AS cnt FROM chat_sessions WHERE tenant_id = ?", [Database::tenantId()])['cnt'];

        Response::paginated($rows, [
            'total'    => $total,
            'page'     => $page,
            'per_page' => 20,
            'pages'    => (int) ceil($total / 20),
        ]);
    }

    // ── GET /chat/debug (preserved) ─────────────────────────────────────────────
    public function debug(Request $request): void
    {
        $question = $request->query('q', 'what is the price of pellet');
        $checks   = [];

        $checks['databridge_loaded'] = class_exists('DataBridge');
        $checks['groq_loaded']       = class_exists('GroqClient');
        $checks['groq_key_set']      = defined('GROQ_API_KEY') && strlen(GROQ_API_KEY) > 10;
        $checks['groq_key_prefix']   = defined('GROQ_API_KEY') ? substr(GROQ_API_KEY, 0, 8) . '...' : 'NOT SET';

        try {
            $checks['products_count']      = (int) Database::fetch("SELECT COUNT(*) AS cnt FROM products WHERE tenant_id = ?", [Database::tenantId()])['cnt'];
            $checks['employees_count']     = (int) Database::fetch("SELECT COUNT(*) AS cnt FROM employees WHERE tenant_id = ?", [Database::tenantId()])['cnt'];
            $checks['chat_conv_table']     = (int) Database::fetch("SELECT COUNT(*) AS cnt FROM chat_conversations WHERE tenant_id = ?", [Database::tenantId()])['cnt'];
            $checks['chat_sessions_table'] = 'OK';
        } catch (\Throwable $e) {
            $checks['db_error'] = $e->getMessage();
        }

        try {
            $context = DataBridge::fetchContext($question);
            $checks['context_length']  = strlen($context);
            $checks['context_preview'] = mb_substr($context, 0, 500);
        } catch (\Throwable $e) {
            $checks['context_error'] = $e->getMessage();
        }

        Response::success($checks, 'Debug info');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Intent / context layer (READ-ONLY, tenant-scoped)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Pick the relevant intents from the question and assemble a compact context.
     * Always includes a short company/finance snapshot so generic questions work.
     */
    private function buildContext(string $message, string $pageContext = ''): string
    {
        $lower   = strtolower($message);
        $intents = $this->detectIntents($lower);

        $parts = [$this->ctxSnapshot()];
        foreach ($intents as $intent) {
            try {
                $block = $this->fetchIntent($intent);
                if ($block !== '') {
                    $parts[] = $block;
                }
            } catch (\Throwable $e) {
                error_log("[Chat] intent $intent error: " . $e->getMessage());
            }
        }

        if ($pageContext !== '') {
            $parts[] = "## The user is currently viewing\n- Page: " . mb_substr($pageContext, 0, 120);
        }

        $context = implode("\n\n", array_filter($parts));
        // Keep the prompt compact for the model / token budget.
        return mb_substr($context, 0, 9000);
    }

    /** Map question keywords → intent keys. */
    private function detectIntents(string $lower): array
    {
        $map = [
            'invoices'          => ['invoice', 'bill', 'receivable', 'overdue', 'unpaid', 'payment', 'collect'],
            'credit_notes'      => ['credit note', 'credit memo', 'invoice adjustment', 'invoice return'],
            'sales'             => ['sale', 'revenue', 'turnover', 'income', 'top customer', 'best customer'],
            'orders'            => ['order', 'fulfil', 'fulfill', 'delivery', 'dispatch', 'ship'],
            'inventory'         => ['stock', 'inventory', 'sku', 'reorder', 'low stock', 'out of stock', 'warehouse'],
            'stock_movements'   => ['stock movement', 'inventory movement', 'stock in', 'stock out', 'transfer stock', 'damage stock', 'adjustment'],
            'procurement'       => ['purchase order', ' po ', 'procure', 'procurement', 'vendor', 'supplier'],
            'vendor_bills'      => ['vendor bill', 'supplier bill', 'vendor invoice', 'supplier invoice', 'accounts payable', 'payable'],
            'expenses'          => ['expense', 'spend', 'spent', 'cost ', 'outgoing'],
            'finance'           => ['finance', 'profit', 'p&l', 'balance', 'money'],
            'cash_summary'      => ['cash', 'cash flow', 'cashflow', 'cash in', 'cash out', 'liquidity'],
            'payroll'           => ['payroll', 'salary', 'salaries', 'net pay', 'wages'],
            'payroll_runs'      => ['payroll run', 'pay run', 'salary run', 'payroll approval', 'bank advice', 'maker checker'],
            'attendance'        => ['attendance', 'present', 'absent', 'check in', 'check-in', 'check out', 'check-out', 'who is in'],
            'employees'         => ['employee', 'employees', 'staff', 'workforce', 'headcount', 'department', 'designation'],
            'leave'             => ['leave', 'leave request', 'leave approval', 'time off', 'holiday request'],
            'customers'         => ['customer', 'client', 'buyer'],
            'customer_health'   => ['customer health', 'customer segment', 'churn', 'slow payer', 'payment behavior', 'payment behaviour', 'dormant customer'],
            'crm'               => ['crm'],
            'crm_leads'         => ['lead', 'prospect'],
            'crm_deals'         => ['deal', 'opportunity'],
            'crm_pipeline'      => ['pipeline', 'sales funnel', 'funnel'],
            'quotes'            => ['quote', 'quotation', 'enquiry', 'enquiries', 'estimate'],
            'quote_requests'    => ['quote request', 'quotation request', 'pricing enquiry', 'pricing inquiry'],
            'sales_documents'   => ['formal quotation', 'sales quotation', 'quotation document', 'proforma', 'pro forma'],
            'tasks'             => ['task', 'todo', 'to-do', 'pending work', 'assignment'],
            'meetings'          => ['meeting', 'agenda', 'raci', 'action item', 'appointment', 'schedule'],
            'dealers'           => ['dealer', 'dealer network', 'channel partner', 'reseller', 'distributor'],
            'gst_compliance'    => ['gst', 'gstr', 'input tax', 'output tax', 'tax filing', 'tax compliance'],
            'sops'              => ['sop', 'standard operating', 'procedure document', 'work instruction'],
            'workflows'         => ['workflow', 'approval flow', 'escalation', 'workflow definition'],
            'hr_compliance'     => ['compliance', 'pf', 'esi', 'statutory', 'document expiry', 'expiring document'],
            'accounting'        => ['ledger', 'chart of accounts', 'journal', 'account balance', 'accounting', 'debit', 'credit balance'],
            'advance_register'  => ['advance', 'salary advance', 'employee advance', 'loan to employee', 'advance register'],
            'products'          => ['product', 'catalog', 'catalogue', 'item master', 'product master'],
            'pricing'           => ['price', 'pricing', 'rate', 'price list', 'dealer price', 'base price'],
            'attention'         => ['attention', 'briefing', 'overview', 'summary', 'what should', 'what needs', "what's up", 'whats up', 'today'],
        ];

        $hits = [];
        foreach ($map as $intent => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($lower, trim($kw))) {
                    $hits[] = $intent;
                    break;
                }
            }
        }

        // Prefer the specific block when a phrase also hits its broader parent intent.
        if (in_array('quote_requests', $hits, true) || in_array('sales_documents', $hits, true)) {
            $hits = array_values(array_filter($hits, fn($h) => $h !== 'quotes'));
        }
        if (in_array('vendor_bills', $hits, true)) {
            $hits = array_values(array_filter($hits, fn($h) => $h !== 'invoices'));
        }

        // "attention/overview" pulls the cross-module high-signal set.
        if (in_array('attention', $hits, true)) {
            $hits = array_merge($hits, [
                'invoices', 'inventory', 'payroll_runs', 'tasks', 'crm_pipeline',
                'vendor_bills', 'meetings', 'customer_health',
            ]);
        }

        $hits = array_values(array_unique(array_filter($hits, fn($h) => $h !== 'attention')));

        // Fallback: nothing matched → give a broad snapshot of money + work.
        if (!$hits) {
            $hits = ['invoices', 'sales', 'expenses', 'inventory'];
        }
        return $hits;
    }

    private function fetchIntent(string $intent): string
    {
        return match ($intent) {
            'invoices'        => $this->ctxInvoices(),
            'credit_notes'    => $this->ctxCreditNotes(),
            'sales'           => $this->ctxSales(),
            'orders'          => $this->ctxOrders(),
            'inventory'       => $this->ctxInventory(),
            'stock_movements' => $this->ctxStockMovements(),
            'procurement'     => $this->ctxProcurement(),
            'vendor_bills'    => $this->ctxVendorBills(),
            'expenses'        => $this->ctxExpenses(),
            'finance'         => $this->ctxFinance(),
            'cash_summary'    => $this->ctxCashSummary(),
            'payroll'         => $this->ctxPayroll(),
            'payroll_runs'    => $this->ctxPayrollRuns(),
            'attendance'      => $this->ctxAttendance(),
            'employees'       => $this->ctxEmployees(),
            'leave'           => $this->ctxLeave(),
            'customers'       => $this->ctxCustomers(),
            'customer_health' => $this->ctxCustomerHealth(),
            'crm'             => $this->ctxCrm(),
            'crm_leads'       => $this->ctxCrmLeads(),
            'crm_deals'       => $this->ctxCrmDeals(),
            'crm_pipeline'    => $this->ctxCrmPipeline(),
            'quotes'          => $this->ctxQuotes(),
            'quote_requests'  => $this->ctxQuoteRequests(),
            'sales_documents' => $this->ctxSalesDocuments(),
            'tasks'           => $this->ctxTasks(),
            'meetings'        => $this->ctxMeetings(),
            'dealers'         => $this->ctxDealers(),
            'gst_compliance'  => $this->ctxGstCompliance(),
            'sops'            => $this->ctxSops(),
            'workflows'       => $this->ctxWorkflows(),
            'hr_compliance'   => $this->ctxHrCompliance(),
            'accounting'      => $this->ctxAccounting(),
            'advance_register'=> $this->ctxAdvanceRegister(),
            'products'        => $this->ctxProducts(),
            'pricing'         => $this->ctxPricing(),
            default           => '',
        };
    }

    private function tid(): int
    {
        return Database::tenantId();
    }

    // ── Context blocks (each scoped by tenant_id) ───────────────────────────────

    private function ctxSnapshot(): string
    {
        $tid = $this->tid();
        $rev = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE tenant_id = ? AND status = 'Paid'", [$tid]
        )['v'] ?? 0);
        $exp = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE tenant_id = ?
             AND MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE())", [$tid]
        )['v'] ?? 0);
        return "## Snapshot\n"
            . "- Revenue (paid invoices, all time): ₹" . number_format($rev, 2) . "\n"
            . "- Expenses (this month): ₹" . number_format($exp, 2);
    }

    private function ctxInvoices(): string
    {
        $tid = $this->tid();
        $byStatus = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total
             FROM invoices WHERE tenant_id = ? GROUP BY status", [$tid]
        );
        $overdue = $this->safeFetchAll(
            "SELECT invoice_number, customer_name, total,
                    GREATEST(total - COALESCE(amount_paid,0),0) AS balance_due, due_date
             FROM invoices
             WHERE tenant_id = ?
               AND status NOT IN ('Paid','Cancelled')
               AND due_date IS NOT NULL AND due_date < CURDATE()
             ORDER BY due_date ASC LIMIT 10", [$tid]
        );
        $lines = ['## Invoices'];
        foreach ($byStatus as $s) {
            $lines[] = "- {$s['status']}: {$s['cnt']} (₹" . number_format((float)$s['total'], 2) . ')';
        }
        if ($overdue) {
            $lines[] = "\nOverdue invoices:";
            foreach ($overdue as $o) {
                $lines[] = "- #{$o['invoice_number']} | " . ($o['customer_name'] ?: 'N/A')
                    . ' | balance ₹' . number_format((float)$o['balance_due'], 2)
                    . " | due {$o['due_date']}";
            }
        }
        return count($lines) > 1 ? implode("\n", $lines) : '';
    }

    private function ctxSales(): string
    {
        $tid = $this->tid();
        $top = $this->safeFetchAll(
            "SELECT customer_name, COUNT(*) AS invoices, COALESCE(SUM(total),0) AS revenue
             FROM invoices
             WHERE tenant_id = ? AND status = 'Paid' AND customer_name IS NOT NULL AND customer_name <> ''
             GROUP BY customer_name ORDER BY revenue DESC LIMIT 8", [$tid]
        );
        $month = $this->safeFetch(
            "SELECT COALESCE(SUM(total),0) AS v, COUNT(*) AS cnt FROM invoices
             WHERE tenant_id = ? AND status = 'Paid'
               AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())", [$tid]
        );
        $lines = ['## Sales'];
        $lines[] = '- This month (paid): ' . (int)($month['cnt'] ?? 0)
            . ' invoices, ₹' . number_format((float)($month['v'] ?? 0), 2);
        if ($top) {
            $lines[] = "\nTop customers by revenue:";
            foreach ($top as $t) {
                $lines[] = "- {$t['customer_name']}: ₹" . number_format((float)$t['revenue'], 2)
                    . " ({$t['invoices']} invoices)";
            }
        }
        return implode("\n", $lines);
    }

    private function ctxOrders(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT order_status, COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS total
             FROM orders WHERE tenant_id = ? GROUP BY order_status ORDER BY cnt DESC", [$tid]
        );
        if (!$stats) return '';
        $lines = ['## Orders'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['order_status']}: {$s['cnt']} (₹" . number_format((float)$s['total'], 2) . ')';
        }
        return implode("\n", $lines);
    }

    private function ctxInventory(): string
    {
        $tid = $this->tid();
        $summary = $this->safeFetch(
            "SELECT COUNT(DISTINCT p.inv_product_id) AS sku_count,
                    COALESCE(SUM(s.current_quantity),0) AS current_qty,
                    COALESCE(SUM(s.available_quantity),0) AS available_qty,
                    COALESCE(SUM(s.current_quantity * p.standard_cost),0) AS stock_value
             FROM inventory_products p
             LEFT JOIN inventory_stock s
               ON s.inv_product_id = p.inv_product_id AND s.tenant_id = p.tenant_id
             WHERE p.tenant_id = ? AND p.is_deleted = 0", [$tid]
        );
        $low = $this->safeFetchAll(
            "SELECT p.name, p.sku, p.reorder_level, s.available_quantity
             FROM inventory_stock s
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = s.tenant_id
             WHERE s.tenant_id = ? AND s.is_low_stock = 1 AND p.is_deleted = 0
             ORDER BY s.available_quantity ASC LIMIT 15", [$tid]
        );
        $lines = ['## Inventory'];
        $lines[] = '- Tracked SKUs: ' . (int)($summary['sku_count'] ?? 0);
        $lines[] = '- Current / available quantity: '
            . (float)($summary['current_qty'] ?? 0) . ' / ' . (float)($summary['available_qty'] ?? 0);
        $lines[] = '- Stock value at standard cost: ₹'
            . number_format((float)($summary['stock_value'] ?? 0), 2);
        if ($low) {
            $lines[] = '- Below reorder level: ' . count($low);
            foreach ($low as $l) {
                $lines[] = "  - {$l['name']} ({$l['sku']}): "
                    . rtrim(rtrim((string)$l['available_quantity'], '0'), '.')
                    . ' avail / reorder at '
                    . rtrim(rtrim((string)$l['reorder_level'], '0'), '.');
            }
        } else {
            $lines[] = '- No SKUs below reorder level';
        }
        return implode("\n", $lines);
    }

    private function ctxProcurement(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total
             FROM purchase_orders WHERE tenant_id = ? GROUP BY status ORDER BY cnt DESC", [$tid]
        );
        if (!$stats) return '';
        $lines = ['## Procurement (Purchase Orders)'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['status']}: {$s['cnt']} (₹" . number_format((float)$s['total'], 2) . ')';
        }
        return implode("\n", $lines);
    }

    private function ctxExpenses(): string
    {
        $tid = $this->tid();
        $byCat = $this->safeFetchAll(
            "SELECT category, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total
             FROM expenses WHERE tenant_id = ?
               AND expense_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
             GROUP BY category ORDER BY total DESC LIMIT 10", [$tid]
        );
        if (!$byCat) return '';
        $lines = ['## Expenses (last 90 days, by category)'];
        foreach ($byCat as $c) {
            $lines[] = "- {$c['category']}: ₹" . number_format((float)$c['total'], 2) . " ({$c['cnt']} entries)";
        }
        return implode("\n", $lines);
    }

    private function ctxFinance(): string
    {
        $tid = $this->tid();
        $rev = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(total),0) AS v FROM invoices WHERE tenant_id = ? AND status = 'Paid'
               AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())", [$tid]
        )['v'] ?? 0);
        $exp = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE tenant_id = ?
               AND MONTH(expense_date) = MONTH(CURDATE()) AND YEAR(expense_date) = YEAR(CURDATE())", [$tid]
        )['v'] ?? 0);
        $outstanding = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(GREATEST(total - COALESCE(amount_paid,0),0)),0) AS v
             FROM invoices WHERE tenant_id = ? AND status NOT IN ('Paid','Cancelled')", [$tid]
        )['v'] ?? 0);
        return "## Finance (this month)\n"
            . "- Cash in (paid invoices): ₹" . number_format($rev, 2) . "\n"
            . "- Cash out (expenses): ₹" . number_format($exp, 2) . "\n"
            . "- Net (cash basis): ₹" . number_format($rev - $exp, 2) . "\n"
            . "- Outstanding receivables: ₹" . number_format($outstanding, 2);
    }

    private function ctxPayroll(): string
    {
        $tid = $this->tid();
        $month = date('Y-m');
        $stats = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt, COALESCE(SUM(net_pay),0) AS total
             FROM payroll WHERE tenant_id = ? AND month = ? GROUP BY status", [$tid, $month]
        );
        $lines = ["## Payroll ($month)"];
        if ($stats) {
            foreach ($stats as $s) {
                $lines[] = "- {$s['status']}: {$s['cnt']} (net ₹" . number_format((float)$s['total'], 2) . ')';
            }
        } else {
            $lines[] = "- No payroll generated yet for $month";
        }
        return implode("\n", $lines);
    }

    private function ctxAttendance(): string
    {
        $tid   = $this->tid();
        $today = date('Y-m-d');
        $s = $this->safeFetch(
            "SELECT
                SUM(status = 'Present')  AS present,
                SUM(status = 'Absent')   AS absent,
                SUM(status = 'Half-day') AS half_day,
                SUM(status = 'Leave')    AS on_leave
             FROM attendance WHERE tenant_id = ? AND date = ?", [$tid, $today]
        );
        if (!$s) return '';
        return "## Attendance (today, $today)\n"
            . '- Present: ' . (int)($s['present'] ?? 0)
            . ', Absent: ' . (int)($s['absent'] ?? 0)
            . ', Half-day: ' . (int)($s['half_day'] ?? 0)
            . ', On leave: ' . (int)($s['on_leave'] ?? 0);
    }

    private function ctxCustomers(): string
    {
        $tid = $this->tid();
        $count = (int)($this->safeFetch(
            "SELECT COUNT(*) AS cnt FROM users WHERE tenant_id = ? AND user_type = 'customer' AND is_active = 1", [$tid]
        )['cnt'] ?? 0);
        $top = $this->safeFetchAll(
            "SELECT customer_name, COALESCE(SUM(total),0) AS revenue
             FROM invoices WHERE tenant_id = ? AND status = 'Paid' AND customer_name IS NOT NULL AND customer_name <> ''
             GROUP BY customer_name ORDER BY revenue DESC LIMIT 5", [$tid]
        );
        $lines = ['## Customers'];
        $lines[] = "- Active customers: $count";
        if ($top) {
            $lines[] = 'Top by revenue: ' . implode(', ', array_map(
                fn($t) => "{$t['customer_name']} (₹" . number_format((float)$t['revenue'], 2) . ')', $top
            ));
        }
        return implode("\n", $lines);
    }

    private function ctxCrm(): string
    {
        $tid = $this->tid();
        $leads = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt FROM crm_leads WHERE tenant_id = ? GROUP BY status", [$tid]
        );
        $deals = $this->safeFetchAll(
            "SELECT stage, COUNT(*) AS cnt, COALESCE(SUM(value),0) AS value
             FROM crm_deals WHERE tenant_id = ? GROUP BY stage", [$tid]
        );
        $pipeline = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(value),0) AS v FROM crm_deals
             WHERE tenant_id = ? AND stage NOT IN ('won','lost')", [$tid]
        )['v'] ?? 0);
        if (!$leads && !$deals) return '';
        $lines = ['## CRM'];
        if ($leads) {
            $lines[] = 'Leads: ' . implode(', ', array_map(fn($l) => "{$l['status']} {$l['cnt']}", $leads));
        }
        if ($deals) {
            $lines[] = 'Deals: ' . implode(', ', array_map(
                fn($d) => "{$d['stage']} {$d['cnt']} (₹" . number_format((float)$d['value'], 2) . ')', $deals
            ));
        }
        $lines[] = '- Open pipeline value: ₹' . number_format($pipeline, 2);
        return implode("\n", $lines);
    }

    private function ctxQuotes(): string
    {
        return implode("\n\n", array_filter([
            $this->ctxQuoteRequests(),
            $this->ctxSalesDocuments(),
        ]));
    }

    private function ctxTasks(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt FROM tasks WHERE tenant_id = ? GROUP BY status", [$tid]
        );
        $overdue = (int)($this->safeFetch(
            "SELECT COUNT(*) AS cnt FROM tasks WHERE tenant_id = ? AND due_date < CURDATE() AND status <> 'Completed'", [$tid]
        )['cnt'] ?? 0);
        if (!$stats) return '';
        $lines = ['## Tasks'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['status']}: {$s['cnt']}";
        }
        if ($overdue > 0) {
            $lines[] = "- Overdue: $overdue";
        }
        return implode("\n", $lines);
    }

    private function ctxCreditNotes(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total
             FROM credit_notes WHERE tenant_id = ? GROUP BY status ORDER BY cnt DESC", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT cn.credit_note_number, cn.credit_note_date, cn.status, cn.total,
                    cn.reason, i.invoice_number, i.customer_name
             FROM credit_notes cn
             JOIN invoices i ON i.invoice_id = cn.invoice_id AND i.tenant_id = cn.tenant_id
             WHERE cn.tenant_id = ?
             ORDER BY cn.credit_note_date DESC, cn.credit_note_id DESC LIMIT 8", [$tid]
        );
        if (!$stats && !$recent) return '';
        $lines = ['## Credit Notes'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['status']}: {$s['cnt']} (₹" . number_format((float)$s['total'], 2) . ')';
        }
        foreach ($recent as $r) {
            $lines[] = "- #{$r['credit_note_number']} for invoice #{$r['invoice_number']} | "
                . ($r['customer_name'] ?: 'N/A') . ' | ₹' . number_format((float)$r['total'], 2)
                . " | {$r['status']} | {$r['credit_note_date']}";
        }
        return implode("\n", $lines);
    }

    private function ctxStockMovements(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT movement_type, approval_status, COUNT(*) AS cnt,
                    COALESCE(SUM(quantity),0) AS qty, COALESCE(SUM(total_value),0) AS value
             FROM inventory_stock_movements
             WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY movement_type, approval_status ORDER BY cnt DESC", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT m.movement_type, m.quantity, m.approval_status, m.created_at,
                    p.name AS product_name, p.sku, z.zone_name
             FROM inventory_stock_movements m
             JOIN inventory_products p
               ON p.inv_product_id = m.inv_product_id AND p.tenant_id = m.tenant_id
             JOIN inventory_zones z ON z.zone_id = m.zone_id AND z.tenant_id = m.tenant_id
             WHERE m.tenant_id = ?
             ORDER BY m.created_at DESC, m.movement_id DESC LIMIT 10", [$tid]
        );
        if (!$stats && !$recent) return '';
        $lines = ['## Inventory Movements'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['movement_type']} / {$s['approval_status']}: {$s['cnt']} movements, "
                . (float)$s['qty'] . ' units, ₹' . number_format((float)$s['value'], 2);
        }
        if ($recent) {
            $lines[] = 'Recent movements:';
            foreach ($recent as $r) {
                $lines[] = "- {$r['created_at']} | {$r['product_name']} ({$r['sku']}) | "
                    . "{$r['movement_type']} " . (float)$r['quantity']
                    . " | {$r['zone_name']} | {$r['approval_status']}";
            }
        }
        return implode("\n", $lines);
    }

    private function ctxVendorBills(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT status, payment_status, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total,
                    COALESCE(SUM(GREATEST(total - COALESCE(amount_paid,0),0)),0) AS due
             FROM vendor_bills WHERE tenant_id = ?
             GROUP BY status, payment_status ORDER BY cnt DESC", [$tid]
        );
        $overdue = $this->safeFetchAll(
            "SELECT vb.bill_number, vb.vendor_invoice_number, v.name AS vendor_name,
                    vb.total, GREATEST(vb.total - COALESCE(vb.amount_paid,0),0) AS due, vb.due_date
             FROM vendor_bills vb
             JOIN vendors v ON v.vendor_id = vb.vendor_id AND v.tenant_id = vb.tenant_id
             WHERE vb.tenant_id = ? AND vb.status <> 'void' AND vb.payment_status <> 'paid'
               AND vb.due_date IS NOT NULL AND vb.due_date < CURDATE()
             ORDER BY vb.due_date ASC LIMIT 10", [$tid]
        );
        if (!$stats && !$overdue) return '';
        $lines = ['## Vendor Bills'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['status']} / {$s['payment_status']}: {$s['cnt']} bills, total ₹"
                . number_format((float)$s['total'], 2) . ', due ₹' . number_format((float)$s['due'], 2);
        }
        foreach ($overdue as $r) {
            $lines[] = "- Overdue #{$r['bill_number']} | {$r['vendor_name']} | due ₹"
                . number_format((float)$r['due'], 2) . " | due {$r['due_date']}";
        }
        return implode("\n", $lines);
    }

    private function ctxSops(): string
    {
        $tid = $this->tid();
        $summary = $this->safeFetchAll(
            "SELECT s.department, COUNT(*) AS cnt, COALESCE(sv.status, 'No version') AS version_status
             FROM sops s
             LEFT JOIN sop_versions sv ON sv.version_id = s.current_version_id AND sv.tenant_id = s.tenant_id
             WHERE s.tenant_id = ?
             GROUP BY s.department, version_status
             ORDER BY s.department, version_status", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT s.code, s.title, s.department, COALESCE(sv.version, '-') AS version,
                    COALESCE(sv.status, 'No version') AS version_status
             FROM sops s
             LEFT JOIN sop_versions sv ON sv.version_id = s.current_version_id AND sv.tenant_id = s.tenant_id
             WHERE s.tenant_id = ?
             ORDER BY s.updated_at DESC, s.sop_id DESC LIMIT 6", [$tid]
        );
        if (!$summary && !$recent) return '';
        $lines = ['## SOPs'];
        foreach ($summary as $s) {
            $lines[] = "- {$s['department']} / {$s['version_status']}: {$s['cnt']}";
        }
        foreach ($recent as $r) {
            $lines[] = "- {$r['code']} | {$r['title']} | {$r['department']} | v{$r['version']} {$r['version_status']}";
        }
        return implode("\n", $lines);
    }

    private function ctxWorkflows(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT type, stage, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amount
             FROM workflows WHERE tenant_id = ?
             GROUP BY type, stage ORDER BY type, stage", [$tid]
        );
        $definitions = $this->safeFetchAll(
            "SELECT type, SUM(is_active = 1) AS active, COUNT(*) AS cnt
             FROM workflow_definitions WHERE tenant_id = ?
             GROUP BY type ORDER BY type", [$tid]
        );
        $open = $this->safeFetchAll(
            "SELECT title, type, priority, stage, due_date
             FROM workflows
             WHERE tenant_id = ? AND stage NOT IN ('Completed','Rejected')
             ORDER BY due_date IS NULL, due_date ASC, workflow_id DESC LIMIT 6", [$tid]
        );
        if (!$stats && !$definitions && !$open) return '';
        $lines = ['## Workflows'];
        foreach ($definitions as $d) {
            $lines[] = "- Definitions {$d['type']}: {$d['active']} active / {$d['cnt']} total";
        }
        foreach ($stats as $s) {
            $amount = (float)$s['amount'] > 0 ? ' | ₹' . number_format((float)$s['amount'], 2) : '';
            $lines[] = "- {$s['type']} {$s['stage']}: {$s['cnt']}{$amount}";
        }
        foreach ($open as $w) {
            $lines[] = "- Open: {$w['title']} | {$w['type']} | {$w['priority']} | {$w['stage']}"
                . ($w['due_date'] ? " | due {$w['due_date']}" : '');
        }
        return implode("\n", $lines);
    }

    private function ctxHrCompliance(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT type, status, COUNT(*) AS cnt
             FROM employee_compliance WHERE tenant_id = ?
             GROUP BY type, status ORDER BY type, status", [$tid]
        );
        $due = $this->safeFetchAll(
            "SELECT c.type, c.status, c.expiry_date, e.employee_key, e.name
             FROM employee_compliance c
             JOIN employees e ON e.employee_key = c.employee_key AND e.tenant_id = c.tenant_id
             WHERE c.tenant_id = ? AND (c.status IN ('expiring','expired') OR c.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
             ORDER BY c.expiry_date ASC LIMIT 8", [$tid]
        );
        $gst = $this->safeFetchAll(
            "SELECT period_key, status, net_payable
             FROM gst_compliance_periods WHERE tenant_id = ?
             ORDER BY period_key DESC LIMIT 3", [$tid]
        );
        if (!$stats && !$due && !$gst) return '';
        $lines = ['## HR Compliance'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['type']} {$s['status']}: {$s['cnt']}";
        }
        foreach ($due as $d) {
            $lines[] = "- {$d['name']} ({$d['employee_key']}) | {$d['type']} {$d['status']} | expires {$d['expiry_date']}";
        }
        foreach ($gst as $g) {
            $lines[] = "- GST {$g['period_key']}: {$g['status']} | payable ₹" . number_format((float)$g['net_payable'], 2);
        }
        return implode("\n", $lines);
    }

    private function ctxAccounting(): string
    {
        $tid = $this->tid();
        $byType = $this->safeFetchAll(
            "SELECT type, COUNT(*) AS cnt, SUM(is_active = 1) AS active
             FROM accounts WHERE tenant_id = ?
             GROUP BY type ORDER BY FIELD(type, 'asset', 'liability', 'equity', 'income', 'expense')", [$tid]
        );
        $balances = $this->safeFetchAll(
            "SELECT a.code, a.name, a.type,
                    COALESCE(SUM(jl.debit),0) AS debit,
                    COALESCE(SUM(jl.credit),0) AS credit
             FROM accounts a
             LEFT JOIN journal_lines jl ON jl.account_id = a.account_id AND jl.tenant_id = a.tenant_id
             WHERE a.tenant_id = ? AND a.is_active = 1
             GROUP BY a.account_id, a.code, a.name, a.type
             ORDER BY a.code ASC LIMIT 8", [$tid]
        );
        if (!$byType && !$balances) return '';
        $lines = ['## Accounting'];
        foreach ($byType as $t) {
            $lines[] = "- {$t['type']}: {$t['active']} active / {$t['cnt']} total";
        }
        foreach ($balances as $b) {
            $balance = (float)$b['debit'] - (float)$b['credit'];
            $lines[] = "- {$b['code']} {$b['name']} ({$b['type']}): balance ₹" . number_format($balance, 2);
        }
        return implode("\n", $lines);
    }

    private function ctxAdvanceRegister(): string
    {
        $tid = $this->tid();
        $summary = $this->safeFetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total
             FROM employee_advances WHERE tenant_id = ?", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT a.advance_date, a.payroll_month, a.amount, e.employee_key, e.name
             FROM employee_advances a
             JOIN employees e ON e.employee_key = a.employee_key AND e.tenant_id = a.tenant_id
             WHERE a.tenant_id = ?
             ORDER BY a.advance_date DESC, a.advance_id DESC LIMIT 8", [$tid]
        );
        if (!$summary && !$recent) return '';
        $lines = ['## Advance Register'];
        $lines[] = '- Advances recorded: ' . (int)($summary['cnt'] ?? 0)
            . ' | outstanding total ₹' . number_format((float)($summary['total'] ?? 0), 2);
        foreach ($recent as $r) {
            $lines[] = "- {$r['name']} ({$r['employee_key']}) | ₹" . number_format((float)$r['amount'], 2)
                . " | {$r['advance_date']} | payroll {$r['payroll_month']}";
        }
        return implode("\n", $lines);
    }

    private function ctxCashSummary(): string
    {
        $tid = $this->tid();
        $cash = $this->safeFetch(
            "SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END),0) AS cash_in,
                    COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END),0) AS cash_out
             FROM payments
             WHERE tenant_id = ? AND status = 'posted'
               AND MONTH(paid_on) = MONTH(CURDATE()) AND YEAR(paid_on) = YEAR(CURDATE())", [$tid]
        );
        $receivable = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(GREATEST(total - COALESCE(amount_paid,0),0)),0) AS v
             FROM invoices WHERE tenant_id = ? AND status NOT IN ('Paid','Cancelled')", [$tid]
        )['v'] ?? 0);
        $payable = (float)($this->safeFetch(
            "SELECT COALESCE(SUM(GREATEST(total - COALESCE(amount_paid,0),0)),0) AS v
             FROM vendor_bills WHERE tenant_id = ? AND status <> 'void' AND payment_status <> 'paid'", [$tid]
        )['v'] ?? 0);
        $in = (float)($cash['cash_in'] ?? 0);
        $out = (float)($cash['cash_out'] ?? 0);
        return "## Cash Summary (this month)\n"
            . '- Posted cash in: ₹' . number_format($in, 2) . "\n"
            . '- Posted cash out: ₹' . number_format($out, 2) . "\n"
            . '- Net cash movement: ₹' . number_format($in - $out, 2) . "\n"
            . '- Outstanding receivables: ₹' . number_format($receivable, 2) . "\n"
            . '- Outstanding vendor payables: ₹' . number_format($payable, 2);
    }

    private function ctxPayrollRuns(): string
    {
        $tid = $this->tid();
        $rows = $this->safeFetchAll(
            "SELECT month, run_status, working_days, employee_count, total_gross,
                    total_deductions, total_net_pay, reviewed_at, approved_at, paid_at, locked_at
             FROM payroll_runs WHERE tenant_id = ?
             ORDER BY month DESC, run_id DESC LIMIT 8", [$tid]
        );
        if (!$rows) return '';
        $lines = ['## Payroll Runs'];
        foreach ($rows as $r) {
            $lines[] = "- {$r['month']}: {$r['run_status']} | {$r['employee_count']} employees"
                . ' | gross ₹' . number_format((float)$r['total_gross'], 2)
                . ' | deductions ₹' . number_format((float)$r['total_deductions'], 2)
                . ' | net ₹' . number_format((float)$r['total_net_pay'], 2);
        }
        return implode("\n", $lines);
    }

    private function ctxEmployees(): string
    {
        $tid = $this->tid();
        $departments = $this->safeFetchAll(
            "SELECT COALESCE(NULLIF(department,''),'Unassigned') AS department,
                    COUNT(*) AS cnt, SUM(is_active = 1) AS active
             FROM employees WHERE tenant_id = ? GROUP BY department ORDER BY active DESC", [$tid]
        );
        $employees = $this->safeFetchAll(
            "SELECT employee_key, name, department, designation, joined_at
             FROM employees WHERE tenant_id = ? AND is_active = 1
             ORDER BY department, name LIMIT 25", [$tid]
        );
        if (!$departments && !$employees) return '';
        $lines = ['## Employees'];
        foreach ($departments as $d) {
            $lines[] = "- {$d['department']}: {$d['active']} active / {$d['cnt']} total";
        }
        if ($employees) {
            $lines[] = 'Active employee directory:';
            foreach ($employees as $e) {
                $lines[] = "- {$e['employee_key']} | {$e['name']} | "
                    . ($e['department'] ?: 'Unassigned') . ' | ' . ($e['designation'] ?: 'N/A');
            }
        }
        return implode("\n", $lines);
    }

    private function ctxLeave(): string
    {
        $tid = $this->tid();
        $requests = $this->safeFetchAll(
            "SELECT stage, COUNT(*) AS cnt
             FROM workflows WHERE tenant_id = ? AND type = 'Leave Request'
             GROUP BY stage ORDER BY cnt DESC", [$tid]
        );
        $leaveDays = $this->safeFetchAll(
            "SELECT e.employee_key, e.name, COUNT(*) AS leave_days
             FROM attendance a
             JOIN employees e ON e.employee_key = a.employee_key AND e.tenant_id = a.tenant_id
             WHERE a.tenant_id = ? AND a.status = 'Leave'
               AND MONTH(a.date) = MONTH(CURDATE()) AND YEAR(a.date) = YEAR(CURDATE())
             GROUP BY e.employee_key, e.name ORDER BY leave_days DESC LIMIT 15", [$tid]
        );
        if (!$requests && !$leaveDays) return '';
        $lines = ['## Leave'];
        if ($requests) {
            $lines[] = 'Leave requests: ' . implode(', ', array_map(
                fn($r) => "{$r['stage']} {$r['cnt']}", $requests
            ));
        }
        foreach ($leaveDays as $r) {
            $lines[] = "- {$r['name']} ({$r['employee_key']}): {$r['leave_days']} leave day(s) this month";
        }
        return implode("\n", $lines);
    }

    private function ctxCustomerHealth(): string
    {
        $tid = $this->tid();
        $segments = $this->safeFetchAll(
            "SELECT segment, payment_behavior, COUNT(*) AS cnt,
                    COALESCE(SUM(total_spend),0) AS spend, COALESCE(SUM(outstanding),0) AS outstanding
             FROM customer_metrics WHERE tenant_id = ?
             GROUP BY segment, payment_behavior ORDER BY spend DESC", [$tid]
        );
        $risk = $this->safeFetchAll(
            "SELECT u.name, u.company_name, cm.segment, cm.total_spend, cm.outstanding,
                    cm.avg_payment_days, cm.last_order_date, cm.payment_behavior
             FROM customer_metrics cm
             JOIN users u ON u.user_id = cm.customer_id AND u.tenant_id = cm.tenant_id
             WHERE cm.tenant_id = ? AND (
                 cm.churn_risk = 1 OR cm.outstanding > 0
                 OR (cm.last_order_date IS NOT NULL AND cm.last_order_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY))
             )
             ORDER BY cm.churn_risk DESC, cm.outstanding DESC, cm.total_spend DESC LIMIT 10", [$tid]
        );
        if (!$segments && !$risk) return '';
        $lines = ['## Customer Health'];
        foreach ($segments as $s) {
            $lines[] = "- {$s['segment']} / {$s['payment_behavior']}: {$s['cnt']} customers"
                . ' | spend ₹' . number_format((float)$s['spend'], 2)
                . ' | outstanding ₹' . number_format((float)$s['outstanding'], 2);
        }
        foreach ($risk as $r) {
            $lines[] = '- Attention: ' . ($r['company_name'] ?: $r['name'])
                . " | {$r['segment']} / {$r['payment_behavior']}"
                . ' | outstanding ₹' . number_format((float)$r['outstanding'], 2)
                . ' | last order ' . ($r['last_order_date'] ?: 'N/A');
        }
        return implode("\n", $lines);
    }

    private function ctxCrmLeads(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT status, source, COUNT(*) AS cnt FROM crm_leads
             WHERE tenant_id = ? GROUP BY status, source ORDER BY cnt DESC", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT name, company_name, source, status, created_at
             FROM crm_leads WHERE tenant_id = ?
             ORDER BY created_at DESC, lead_id DESC LIMIT 10", [$tid]
        );
        if (!$stats && !$recent) return '';
        $lines = ['## CRM Leads'];
        foreach ($stats as $s) {
            $lines[] = '- ' . ($s['source'] ?: 'unknown source') . " / {$s['status']}: {$s['cnt']}";
        }
        foreach ($recent as $r) {
            $lines[] = "- {$r['name']} | " . ($r['company_name'] ?: 'N/A')
                . " | {$r['status']} | " . ($r['source'] ?: 'unknown') . " | {$r['created_at']}";
        }
        return implode("\n", $lines);
    }

    private function ctxCrmDeals(): string
    {
        $tid = $this->tid();
        $rows = $this->safeFetchAll(
            "SELECT d.title, d.stage, d.value, d.probability, d.expected_close_date,
                    u.name AS customer_name
             FROM crm_deals d
             LEFT JOIN users u ON u.user_id = d.customer_id AND u.tenant_id = d.tenant_id
             WHERE d.tenant_id = ?
             ORDER BY FIELD(d.stage,'negotiation','proposal','qualification','won','lost'),
                      d.value DESC LIMIT 15", [$tid]
        );
        if (!$rows) return '';
        $lines = ['## CRM Deals'];
        foreach ($rows as $r) {
            $lines[] = "- {$r['title']} | {$r['stage']} | ₹" . number_format((float)$r['value'], 2)
                . " | {$r['probability']}% | " . ($r['customer_name'] ?: 'No customer')
                . ' | expected ' . ($r['expected_close_date'] ?: 'N/A');
        }
        return implode("\n", $lines);
    }

    private function ctxCrmPipeline(): string
    {
        $tid = $this->tid();
        $rows = $this->safeFetchAll(
            "SELECT stage, COUNT(*) AS cnt, COALESCE(SUM(value),0) AS value,
                    COALESCE(SUM(value * probability / 100),0) AS weighted_value
             FROM crm_deals WHERE tenant_id = ?
             GROUP BY stage ORDER BY FIELD(stage,'qualification','proposal','negotiation','won','lost')", [$tid]
        );
        if (!$rows) return '';
        $lines = ['## CRM Pipeline'];
        foreach ($rows as $r) {
            $lines[] = "- {$r['stage']}: {$r['cnt']} deals | ₹"
                . number_format((float)$r['value'], 2) . ' gross | ₹'
                . number_format((float)$r['weighted_value'], 2) . ' weighted';
        }
        return implode("\n", $lines);
    }

    private function ctxQuoteRequests(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT status, COUNT(*) AS cnt FROM quotes
             WHERE tenant_id = ? GROUP BY status ORDER BY cnt DESC", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT quote_number, name, product, quantity_per_month, quoted_price, status, created_at
             FROM quotes WHERE tenant_id = ?
             ORDER BY created_at DESC, quote_id DESC LIMIT 10", [$tid]
        );
        if (!$stats && !$recent) return '';
        $lines = ['## Quote Requests / Enquiries'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['status']}: {$s['cnt']}";
        }
        foreach ($recent as $r) {
            $lines[] = "- #{$r['quote_number']} | {$r['name']} | "
                . ($r['product'] ?: 'Product not specified') . ' | qty '
                . ($r['quantity_per_month'] ?? 'N/A') . ' | quoted '
                . ($r['quoted_price'] ?: 'N/A') . " | {$r['status']}";
        }
        return implode("\n", $lines);
    }

    private function ctxSalesDocuments(): string
    {
        $tid = $this->tid();
        $stats = $this->safeFetchAll(
            "SELECT document_type, status, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total
             FROM sales_documents WHERE tenant_id = ?
             GROUP BY document_type, status ORDER BY document_type, cnt DESC", [$tid]
        );
        $recent = $this->safeFetchAll(
            "SELECT document_type, document_number, customer_name, total, status,
                    document_date, valid_until
             FROM sales_documents WHERE tenant_id = ?
             ORDER BY document_date DESC, document_id DESC LIMIT 10", [$tid]
        );
        if (!$stats && !$recent) return '';
        $lines = ['## Sales Quotations / Proformas'];
        foreach ($stats as $s) {
            $lines[] = "- {$s['document_type']} / {$s['status']}: {$s['cnt']} (₹"
                . number_format((float)$s['total'], 2) . ')';
        }
        foreach ($recent as $r) {
            $lines[] = "- #{$r['document_number']} | {$r['document_type']} | {$r['customer_name']}"
                . ' | ₹' . number_format((float)$r['total'], 2) . " | {$r['status']}"
                . ' | valid until ' . ($r['valid_until'] ?: 'N/A');
        }
        return implode("\n", $lines);
    }

    private function ctxMeetings(): string
    {
        $tid = $this->tid();
        $upcoming = $this->safeFetchAll(
            "SELECT title, date, time, location, agenda, attendees, action_items
             FROM meetings WHERE tenant_id = ? AND date >= CURDATE()
             ORDER BY date ASC, time ASC LIMIT 12", [$tid]
        );
        $overdueActions = $this->safeFetchAll(
            "SELECT title, date, action_items FROM meetings
             WHERE tenant_id = ? AND action_items IS NOT NULL AND action_items <> '[]'
             ORDER BY date DESC LIMIT 10", [$tid]
        );
        if (!$upcoming && !$overdueActions) return '';
        $lines = ['## Meetings'];
        foreach ($upcoming as $r) {
            $attendees = json_decode((string)($r['attendees'] ?? '[]'), true);
            $lines[] = "- {$r['date']} " . substr((string)$r['time'], 0, 5)
                . " | {$r['title']} | " . ($r['location'] ?: 'No location')
                . ' | attendees ' . (is_array($attendees) ? count($attendees) : 0)
                . ' | agenda: ' . ($r['agenda'] ?: 'N/A');
        }
        $openActions = [];
        foreach ($overdueActions as $meeting) {
            $actions = json_decode((string)$meeting['action_items'], true);
            if (!is_array($actions)) continue;
            foreach ($actions as $action) {
                $status = strtolower((string)($action['status'] ?? ''));
                if (in_array($status, ['done', 'completed'], true)) continue;
                $openActions[] = ($action['description'] ?? 'Untitled action')
                    . ' | owner ' . ($action['ownerId'] ?? 'N/A')
                    . ' | due ' . ($action['dueDate'] ?? 'N/A')
                    . " | meeting {$meeting['title']}";
                if (count($openActions) >= 8) break 2;
            }
        }
        foreach ($openActions as $action) {
            $lines[] = "- Open action: $action";
        }
        return implode("\n", $lines);
    }

    private function ctxDealers(): string
    {
        $tid = $this->tid();
        $summary = $this->safeFetch(
            "SELECT COUNT(*) AS total, SUM(is_active = 1) AS active,
                    SUM(approval_status = 'pending') AS pending
             FROM users WHERE tenant_id = ? AND user_type = 'dealer'", [$tid]
        );
        $rows = $this->safeFetchAll(
            "SELECT u.name, u.company_name, u.is_active, u.approval_status,
                    COUNT(DISTINCT dc.dealer_customer_id) AS customers,
                    COUNT(DISTINCT dpl.price_list_id) AS price_lists,
                    COALESCE(SUM(CASE WHEN i.status <> 'Cancelled' THEN i.total ELSE 0 END),0) AS sales,
                    COALESCE(SUM(GREATEST(i.total - COALESCE(i.amount_paid,0),0)),0) AS outstanding
             FROM users u
             LEFT JOIN dealer_customers dc
               ON dc.dealer_id = u.user_id AND dc.tenant_id = u.tenant_id
             LEFT JOIN dealer_price_lists dpl
               ON dpl.dealer_id = u.user_id AND dpl.tenant_id = u.tenant_id AND dpl.is_active = 1
             LEFT JOIN orders o ON o.user_id = dc.customer_id AND o.tenant_id = u.tenant_id
             LEFT JOIN invoices i ON i.order_id = o.order_id AND i.tenant_id = u.tenant_id
             WHERE u.tenant_id = ? AND u.user_type = 'dealer'
             GROUP BY u.user_id
             ORDER BY sales DESC, u.name ASC LIMIT 12", [$tid]
        );
        if (!$summary && !$rows) return '';
        $lines = ['## Dealers'];
        $lines[] = '- Total: ' . (int)($summary['total'] ?? 0)
            . ', active: ' . (int)($summary['active'] ?? 0)
            . ', pending approval: ' . (int)($summary['pending'] ?? 0);
        foreach ($rows as $r) {
            $lines[] = '- ' . ($r['company_name'] ?: $r['name'])
                . " | {$r['customers']} customers | {$r['price_lists']} price lists"
                . ' | sales ₹' . number_format((float)$r['sales'], 2)
                . ' | outstanding ₹' . number_format((float)$r['outstanding'], 2)
                . " | {$r['approval_status']}";
        }
        return implode("\n", $lines);
    }

    private function ctxGstCompliance(): string
    {
        $tid = $this->tid();
        $periods = $this->safeFetchAll(
            "SELECT period_key, sales_taxable, sales_cgst, sales_sgst, sales_igst,
                    input_tax, net_payable, status, filed_on, reference_no
             FROM gst_compliance_periods WHERE tenant_id = ?
             ORDER BY period_key DESC LIMIT 8", [$tid]
        );
        $current = $this->safeFetch(
            "SELECT COUNT(*) AS invoice_count,
                    COALESCE(SUM(GREATEST(subtotal - COALESCE(discount,0),0)),0) AS taxable,
                    COALESCE(SUM(cgst_amount),0) AS cgst,
                    COALESCE(SUM(sgst_amount),0) AS sgst,
                    COALESCE(SUM(igst_amount),0) AS igst
             FROM invoices
             WHERE tenant_id = ? AND LOWER(status) <> 'cancelled'
               AND MONTH(COALESCE(invoice_date, created_at)) = MONTH(CURDATE())
               AND YEAR(COALESCE(invoice_date, created_at)) = YEAR(CURDATE())", [$tid]
        );
        $lines = ['## GST Compliance'];
        $output = (float)($current['cgst'] ?? 0) + (float)($current['sgst'] ?? 0) + (float)($current['igst'] ?? 0);
        $lines[] = '- Current month invoices: ' . (int)($current['invoice_count'] ?? 0)
            . ' | taxable ₹' . number_format((float)($current['taxable'] ?? 0), 2)
            . ' | output GST ₹' . number_format($output, 2);
        foreach ($periods as $r) {
            $lines[] = "- {$r['period_key']}: {$r['status']} | taxable ₹"
                . number_format((float)$r['sales_taxable'], 2)
                . ' | output ₹' . number_format(
                    (float)$r['sales_cgst'] + (float)$r['sales_sgst'] + (float)$r['sales_igst'], 2
                )
                . ' | input ₹' . number_format((float)$r['input_tax'], 2)
                . ' | net payable ₹' . number_format((float)$r['net_payable'], 2);
        }
        return implode("\n", $lines);
    }

    private function ctxProducts(): string
    {
        $tid = $this->tid();
        $summary = $this->safeFetch(
            "SELECT COUNT(*) AS total, SUM(is_available = 1) AS available
             FROM products WHERE tenant_id = ? AND is_deleted = 0", [$tid]
        );
        $rows = $this->safeFetchAll(
            "SELECT product_name, product_type, category, base_price, unit, is_available
             FROM products WHERE tenant_id = ? AND is_deleted = 0
             ORDER BY is_available DESC, product_name ASC LIMIT 20", [$tid]
        );
        if (!$summary && !$rows) return '';
        $lines = ['## Products'];
        $lines[] = '- Total: ' . (int)($summary['total'] ?? 0)
            . ', available: ' . (int)($summary['available'] ?? 0);
        foreach ($rows as $r) {
            $lines[] = "- {$r['product_name']} | {$r['product_type']} | "
                . ($r['category'] ?: 'Uncategorised') . ' | ₹'
                . number_format((float)$r['base_price'], 2) . '/'
                . ($r['unit'] ?: 'unit') . ' | ' . ((int)$r['is_available'] === 1 ? 'available' : 'inactive');
        }
        return implode("\n", $lines);
    }

    private function ctxPricing(): string
    {
        $tid = $this->tid();
        $configs = $this->safeFetchAll(
            "SELECT p.product_name, pc.size, pc.purpose, pc.sub_purpose, pc.price
             FROM product_configurations pc
             JOIN products p ON p.product_id = pc.product_id AND p.tenant_id = pc.tenant_id
             WHERE pc.tenant_id = ? AND pc.is_available = 1 AND p.is_deleted = 0
             ORDER BY p.product_name, pc.size, pc.purpose LIMIT 30", [$tid]
        );
        $dealerPrices = $this->safeFetchAll(
            "SELECT u.name AS dealer_name, dpl.name AS price_list_name,
                    p.product_name, dpi.unit_price, dpl.is_default
             FROM dealer_price_items dpi
             JOIN dealer_price_lists dpl
               ON dpl.price_list_id = dpi.price_list_id AND dpl.tenant_id = dpi.tenant_id
             JOIN users u ON u.user_id = dpl.dealer_id AND u.tenant_id = dpl.tenant_id
             JOIN products p ON p.product_id = dpi.product_id AND p.tenant_id = dpi.tenant_id
             WHERE dpi.tenant_id = ? AND dpl.is_active = 1
             ORDER BY u.name, dpl.is_default DESC, p.product_name LIMIT 25", [$tid]
        );
        if (!$configs && !$dealerPrices) {
            return $this->ctxProducts();
        }
        $lines = ['## Product Pricing'];
        foreach ($configs as $r) {
            $variant = trim(implode(' / ', array_filter([$r['size'], $r['purpose'], $r['sub_purpose']])));
            $lines[] = "- {$r['product_name']}" . ($variant !== '' ? " | $variant" : '')
                . ' | ₹' . number_format((float)$r['price'], 2);
        }
        foreach ($dealerPrices as $r) {
            $lines[] = "- Dealer {$r['dealer_name']} | {$r['price_list_name']} | {$r['product_name']}"
                . ' | ₹' . number_format((float)$r['unit_price'], 2)
                . ((int)$r['is_default'] === 1 ? ' | default list' : '');
        }
        return implode("\n", $lines);
    }

    // ── Metrics used by the briefing (each scoped + fault-tolerant) ─────────────
    private function collectMetrics(): array
    {
        $tid = $this->tid();

        $overdueInv = $this->safeFetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(GREATEST(total - COALESCE(amount_paid,0),0)),0) AS amt
             FROM invoices WHERE tenant_id = ?
               AND status NOT IN ('Paid','Cancelled')
               AND due_date IS NOT NULL AND due_date < CURDATE()", [$tid]
        );
        $unpaidInv = $this->safeFetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(GREATEST(total - COALESCE(amount_paid,0),0)),0) AS amt
             FROM invoices WHERE tenant_id = ? AND status NOT IN ('Paid','Cancelled')", [$tid]
        );
        $lowStock = $this->safeFetchAll(
            "SELECT p.name FROM inventory_stock s
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = s.tenant_id
             WHERE s.tenant_id = ? AND s.is_low_stock = 1 AND p.is_deleted = 0
             ORDER BY s.available_quantity ASC LIMIT 5", [$tid]
        );
        $lowStockCount = (int)($this->safeFetch(
            "SELECT COUNT(*) AS cnt FROM inventory_stock s
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = s.tenant_id
             WHERE s.tenant_id = ? AND s.is_low_stock = 1 AND p.is_deleted = 0", [$tid]
        )['cnt'] ?? 0);
        $openPo = $this->safeFetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM purchase_orders
             WHERE tenant_id = ? AND status NOT IN ('received','closed','cancelled')", [$tid]
        );
        $payroll = $this->safeFetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(net_pay),0) AS amt FROM payroll
             WHERE tenant_id = ? AND month = ? AND status <> 'Paid'", [$tid, date('Y-m')]
        );
        $overdueTasks = (int)($this->safeFetch(
            "SELECT COUNT(*) AS cnt FROM tasks WHERE tenant_id = ? AND due_date < CURDATE() AND status <> 'Completed'", [$tid]
        )['cnt'] ?? 0);
        $att = $this->safeFetch(
            "SELECT SUM(status='Present') AS present, SUM(status='Absent') AS absent, SUM(status='Leave') AS on_leave
             FROM attendance WHERE tenant_id = ? AND date = ?", [$tid, date('Y-m-d')]
        );
        $pipeline = $this->safeFetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(value),0) AS v FROM crm_deals
             WHERE tenant_id = ? AND stage NOT IN ('won','lost')", [$tid]
        );
        $pendingQuotes = (int)($this->safeFetch(
            "SELECT COUNT(*) AS cnt FROM quotes WHERE tenant_id = ? AND status = 'pending'", [$tid]
        )['cnt'] ?? 0);

        return [
            'overdue_invoices' => ['count' => (int)($overdueInv['cnt'] ?? 0), 'amount' => (float)($overdueInv['amt'] ?? 0)],
            'unpaid_invoices'  => ['count' => (int)($unpaidInv['cnt'] ?? 0),  'amount' => (float)($unpaidInv['amt'] ?? 0)],
            'low_stock'        => ['count' => $lowStockCount, 'names' => implode(', ', array_map(fn($r) => $r['name'], $lowStock))],
            'open_pos'         => ['count' => (int)($openPo['cnt'] ?? 0),     'amount' => (float)($openPo['amt'] ?? 0)],
            'pending_payroll'  => ['count' => (int)($payroll['cnt'] ?? 0),    'amount' => (float)($payroll['amt'] ?? 0)],
            'overdue_tasks'    => $overdueTasks,
            'attendance'       => [
                'present'  => (int)($att['present'] ?? 0),
                'absent'   => (int)($att['absent'] ?? 0),
                'on_leave' => (int)($att['on_leave'] ?? 0),
            ],
            'pipeline'      => ['open_count' => (int)($pipeline['cnt'] ?? 0), 'open_value' => (float)($pipeline['v'] ?? 0)],
            'pending_quotes'=> $pendingQuotes,
        ];
    }

    /** One-paragraph NL summary of the briefing items (best-effort). */
    private function briefingSummary(array $items): string
    {
        if (!$items) {
            return "You're all caught up — nothing needs your immediate attention right now.";
        }

        $facts = [];
        foreach ($items as $it) {
            $facts[] = "- {$it['title']}: {$it['detail']}";
        }
        $factText = implode("\n", $facts);

        $messages = [
            ['role' => 'system', 'content' =>
                'You are a concise business assistant. Given a list of items needing the owner\'s '
                . 'attention, write ONE short paragraph (max 3 sentences) summarising the priorities. '
                . 'Use the exact numbers given. Do not add facts. Use ₹ for money.'],
            ['role' => 'user', 'content' => "Items:\n" . $factText],
        ];

        try {
            return $this->callGroqSoft($messages, 200) ?? $this->plainSummary($items);
        } catch (\Throwable $e) {
            return $this->plainSummary($items);
        }
    }

    private function plainSummary(array $items): string
    {
        $titles = array_map(fn($it) => $it['title'], $items);
        return 'Needs attention: ' . implode('; ', $titles) . '.';
    }

    // ── Groq wrappers ───────────────────────────────────────────────────────────

    private function callGroq(array $messages, int $maxTokens): string
    {
        try {
            return GroqClient::chat($messages, $maxTokens);
        } catch (\Throwable $e) {
            error_log('[Chat] Groq error: ' . $e->getMessage());
            Response::error('AI service unavailable. Please try again.', 503);
        }
    }

    /** Like callGroq but returns null on failure instead of aborting the request. */
    private function callGroqSoft(array $messages, int $maxTokens): ?string
    {
        try {
            return GroqClient::chat($messages, $maxTokens);
        } catch (\Throwable $e) {
            error_log('[Chat] Groq soft error: ' . $e->getMessage());
            return null;
        }
    }

    // ── Misc helpers ────────────────────────────────────────────────────────────

    private function deriveTitle(string $message): string
    {
        $t = trim(preg_replace('/\s+/', ' ', $message) ?? $message);
        return mb_substr($t, 0, 60);
    }

    /** Fetch that never throws (missing table on a tenant ⇒ empty result). */
    private function safeFetch(string $sql, array $params): ?array
    {
        try {
            return Database::fetch($sql, $params);
        } catch (\Throwable $e) {
            error_log('[Chat] query skipped: ' . $e->getMessage());
            return null;
        }
    }

    private function safeFetchAll(string $sql, array $params): array
    {
        try {
            return Database::fetchAll($sql, $params);
        } catch (\Throwable $e) {
            error_log('[Chat] query skipped: ' . $e->getMessage());
            return [];
        }
    }

    // ── Legacy session helpers (unchanged) ──────────────────────────────────────

    private function ensureSession(string $sessionId, ?int $userId): void
    {
        Database::execute(
            "INSERT IGNORE INTO chat_sessions (tenant_id, session_id, user_id) VALUES (?, ?, ?)",
            [Database::tenantId(), $sessionId, $userId]
        );
    }

    private function saveMessage(string $sessionId, string $role, string $content): void
    {
        Database::execute(
            "INSERT INTO chat_messages (tenant_id, session_id, role, content) VALUES (?, ?, ?, ?)",
            [Database::tenantId(), $sessionId, $role, $content]
        );
    }

    private function getHistory(string $sessionId, int $limit): array
    {
        $rows = Database::fetchAll(
            "SELECT role, content FROM chat_messages
             WHERE session_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ?",
            [$sessionId, Database::tenantId(), $limit]
        );
        return array_reverse($rows);
    }
}
