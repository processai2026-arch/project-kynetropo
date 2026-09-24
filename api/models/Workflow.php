<?php
declare(strict_types=1);

class Workflow
{
    private const TYPES = [
        'Purchase Request',
        'Leave Request',
        'Expense Claim',
        'Production Order',
        'Quality Hold Release',
        'Dispatch Approval',
        'Marketing Campaign',
        'Other',
    ];

    private const STAGES = [
        'Pending',
        'In Progress',
        'Approved',
        'Completed',
        'Rejected',
    ];

    private const PRIORITIES = [
        'Low',
        'Medium',
        'High',
        'Urgent',
    ];

    /**
     * The allowed transition graph. Backend authority on this — the frontend
     * constant in eco-sudar-control/src/lib/api/workflows.ts must mirror this,
     * but the server is the source of truth and rejects anything not listed here.
     */
    private const ALLOWED_TRANSITIONS = [
        'Pending'     => ['In Progress', 'Approved', 'Rejected'],
        'In Progress' => ['Approved', 'Rejected'],
        'Approved'    => ['Completed', 'Rejected'],
        'Completed'   => [],
        'Rejected'    => ['Pending'],
    ];

    /** Staff roles recognised by AdminMiddleware; 'owner' may action everything. */
    private const STAFF_ROLES = ['owner', 'accountant', 'store_keeper', 'hr', 'sales'];

    public static function all(array $filters = []): array
    {
        $where = ['w.tenant_id = ?'];
        $params = [Database::tenantId()];

        // Filter by type
        if (!empty($filters['type'])) {
            $where[] = 'w.type = ?';
            $params[] = $filters['type'];
        }

        // Filter by stage
        if (!empty($filters['stage'])) {
            $where[] = 'w.stage = ?';
            $params[] = $filters['stage'];
        }

        // Filter by priority
        if (!empty($filters['priority'])) {
            $where[] = 'w.priority = ?';
            $params[] = $filters['priority'];
        }

        // Filter by requester
        if (!empty($filters['requester_id'])) {
            $where[] = 'w.requester_id = ?';
            $params[] = $filters['requester_id'];
        }

        // Filter by approver
        if (!empty($filters['approver_id'])) {
            $where[] = 'w.approver_id = ?';
            $params[] = $filters['approver_id'];
        }

        // Filter by overdue (due_at in the past and not yet terminal)
        if (!empty($filters['overdue'])) {
            $where[] = "w.due_at IS NOT NULL AND w.due_at < NOW() AND w.stage NOT IN ('Completed', 'Rejected')";
        }

        $sql = "SELECT w.workflow_id, w.title, w.type, w.definition_id, w.current_step_id, w.description,
                       w.requester_id, w.requester_name, w.requester_user_id,
                       w.approver_id, w.approver_name, w.approver_user_id,
                       w.priority, w.amount,
                       w.due_date, w.due_at, w.escalated_at, w.last_reminder_at, w.reminder_count,
                       w.stage, w.created_at, w.updated_at
                FROM workflows w
                WHERE " . implode(' AND ', $where) . "
                ORDER BY w.created_at DESC";

        return Database::fetchAll($sql, $params);
    }

    public static function findById(int $id): ?array
    {
        $workflow = Database::fetch(
            "SELECT w.workflow_id, w.title, w.type, w.definition_id, w.current_step_id, w.description,
                    w.requester_id, w.requester_name, w.requester_user_id,
                    w.approver_id, w.approver_name, w.approver_user_id,
                    w.priority, w.amount,
                    w.due_date, w.due_at, w.escalated_at, w.last_reminder_at, w.reminder_count,
                    w.stage, w.created_at, w.updated_at
             FROM workflows w
             WHERE w.workflow_id = ? AND w.tenant_id = ?",
            [$id, Database::tenantId()]
        );

        if (!$workflow) {
            return null;
        }

        // Get history
        $workflow['history'] = self::getHistory($id);

        if (!empty($workflow['definition_id'])) {
            $workflow['definition'] = self::findDefinitionById((int)$workflow['definition_id']);
        }

        return $workflow;
    }

    public static function getHistory(int $workflowId): array
    {
        return Database::fetchAll(
            "SELECT h.history_id, h.workflow_id, h.actor_id, h.actor_user_id, h.actor_name,
                    h.from_stage, h.to_stage, h.note, h.created_at
             FROM workflow_history h
             WHERE h.workflow_id = ? AND h.tenant_id = ?
             ORDER BY h.created_at DESC",
            [$workflowId, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        $dueAt = self::resolveDueAt($data);

        $id = Database::insertTenant('workflows', [
            'title'             => $data['title'],
            'type'              => $data['type'],
            'definition_id'     => $data['definition_id'] ?? null,
            'current_step_id'   => $data['current_step_id'] ?? null,
            'description'       => $data['description'] ?? null,
            'requester_id'      => $data['requester_id'] ?? null,
            'requester_name'    => $data['requester_name'],
            'requester_user_id' => $data['requester_user_id'] ?? null,
            'approver_id'       => $data['approver_id'] ?? null,
            'approver_name'     => $data['approver_name'],
            'approver_user_id'  => $data['approver_user_id'] ?? null,
            'priority'          => $data['priority'] ?? 'Medium',
            'amount'            => $data['amount'] ?? null,
            'due_date'          => $data['due_date'] ?? null,
            'due_at'            => $dueAt,
            'stage'             => $data['stage'] ?? 'Pending',
            'created_at'        => date('Y-m-d H:i:s'),
        ]);

        // Add initial history entry with name
        self::addHistory($id, $data['requester_id'] ?? null, $data['requester_user_id'] ?? null, $data['requester_name'], null, 'Pending', 'Workflow created');

        return $id;
    }

    /**
     * Update editable fields of a workflow (does NOT change stage — use transition()).
     * @throws AppException on validation failure (caller maps to 422/404)
     */
    public static function update(int $id, array $data): bool
    {
        $existing = Database::fetch(
            'SELECT workflow_id FROM workflows WHERE workflow_id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
        if (!$existing) {
            return false;
        }

        $allowed = [
            'title', 'description', 'priority', 'amount', 'due_date', 'due_at',
            'requester_id', 'requester_name', 'requester_user_id',
            'approver_id', 'approver_name', 'approver_user_id',
        ];

        $fields = [];
        $values = [];
        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "`$field` = ?";
            $values[] = $data[$field];
        }

        if (empty($fields)) {
            return true; // nothing to change
        }

        $values[] = $id;
        $values[] = Database::tenantId();
        Database::execute(
            'UPDATE workflows SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE workflow_id = ? AND tenant_id = ?',
            $values
        );

        return true;
    }

    /**
     * Validate + apply a stage transition.
     *
     * Returns an array: ['ok' => bool, 'error' => string|null, 'code' => int|null]
     * so the controller can map failures to the correct HTTP status (409 for an
     * illegal stage transition, 403 for an unauthorised approver).
     */
    public static function transition(int $id, string $toStage, string $actorEmployeeKey, ?int $actorUserId, ?string $actorStaffRole, ?string $note = null): array
    {
        try {
            $current = Database::fetch(
                'SELECT * FROM workflows WHERE workflow_id = ? AND tenant_id = ?',
                [$id, Database::tenantId()]
            );

            if (!$current) {
                return ['ok' => false, 'error' => 'Workflow not found', 'code' => 404];
            }

            $fromStage = $current['stage'];

            // ── 1. Validate the transition is legal from the current stage ──────
            $legal = self::ALLOWED_TRANSITIONS[$fromStage] ?? [];
            if (!in_array($toStage, $legal, true)) {
                return [
                    'ok' => false,
                    'error' => "Cannot move workflow from '$fromStage' to '$toStage'. Allowed: " . (empty($legal) ? 'none (terminal stage)' : implode(', ', $legal)),
                    'code' => 409,
                ];
            }

            // ── 2. Validate approver authority for approval/rejection gates ─────
            // Only the designated approver (by employee key OR by linked user_id),
            // an 'owner', or a step-defined approver role may move a workflow out
            // of Pending/In Progress into Approved/Rejected/Completed.
            if (in_array($toStage, ['Approved', 'Rejected', 'Completed'], true)) {
                $authorised = self::actorIsAuthorisedApprover($current, $actorEmployeeKey, $actorUserId, $actorStaffRole);
                if (!$authorised) {
                    return [
                        'ok' => false,
                        'error' => 'You are not the designated approver for this workflow.',
                        'code' => 403,
                    ];
                }
            }

            // ── 3. Apply ──────────────────────────────────────────────────────
            $nextDueAt = null;
            $nextStepId = null;
            if (!empty($current['definition_id'])) {
                $nextStep = self::nextDefinitionStep((int)$current['definition_id'], $current['current_step_id'] ? (int)$current['current_step_id'] : null);
                if ($nextStep && !in_array($toStage, ['Completed', 'Rejected'], true)) {
                    $nextDueAt = date('Y-m-d H:i:s', strtotime('+' . (int)$nextStep['sla_hours'] . ' hours'));
                    $nextStepId = (int)$nextStep['step_id'];
                }
            }

            Database::execute(
                'UPDATE workflows
                 SET stage = ?, current_step_id = COALESCE(?, current_step_id),
                     due_at = ?, escalated_at = NULL, last_reminder_at = NULL, reminder_count = 0
                 WHERE workflow_id = ? AND tenant_id = ?',
                [$toStage, $nextStepId, $nextDueAt, $id, Database::tenantId()]
            );

            $actorName = self::resolveActorName($actorEmployeeKey, $actorUserId);
            self::addHistory($id, $actorEmployeeKey, $actorUserId, $actorName, $fromStage, $toStage, $note);

            return ['ok' => true, 'error' => null, 'code' => null];
        } catch (Exception $e) {
            error_log('Workflow transition error: ' . $e->getMessage());
            return ['ok' => false, 'error' => 'Failed to transition workflow', 'code' => 500];
        }
    }

    /**
     * Authority check: the actor may approve/reject/complete a workflow if ANY of:
     *  - their employee_key matches workflows.approver_id
     *  - their linked user_id matches workflows.approver_user_id
     *  - their staff_role is 'owner' (owners can act on behalf of any approver)
     *  - the active definition step names their staff_role as approver_role, or
     *    their employee_key as approver_employee_key
     */
    private static function actorIsAuthorisedApprover(array $workflow, string $actorEmployeeKey, ?int $actorUserId, ?string $actorStaffRole): bool
    {
        if ($actorStaffRole === 'owner') {
            return true;
        }

        if (!empty($workflow['approver_id']) && $workflow['approver_id'] === $actorEmployeeKey) {
            return true;
        }

        if (!empty($workflow['approver_user_id']) && $actorUserId !== null && (int)$workflow['approver_user_id'] === $actorUserId) {
            return true;
        }

        if (!empty($workflow['current_step_id'])) {
            $step = Database::fetch(
                'SELECT approver_role, approver_employee_key FROM workflow_definition_steps WHERE step_id = ? AND tenant_id = ?',
                [(int)$workflow['current_step_id'], Database::tenantId()]
            );
            if ($step) {
                if (!empty($step['approver_employee_key']) && $step['approver_employee_key'] === $actorEmployeeKey) {
                    return true;
                }
                if (!empty($step['approver_role']) && $actorStaffRole !== null && $step['approver_role'] === $actorStaffRole) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function resolveActorName(string $actorEmployeeKey, ?int $actorUserId): string
    {
        $actor = Database::fetch('SELECT name FROM employees WHERE employee_key = ? AND tenant_id = ? LIMIT 1', [$actorEmployeeKey, Database::tenantId()]);
        if ($actor) {
            return $actor['name'];
        }
        if ($actorUserId !== null) {
            $user = Database::fetch('SELECT name FROM users WHERE user_id = ? LIMIT 1', [$actorUserId]);
            if ($user) {
                return $user['name'];
            }
        }
        return 'Unknown';
    }

    /**
     * Resolve the authenticated user (users.user_id, from the JWT) to the
     * employee identity (EMP-XXX) the workflow engine has always used.
     *
     * Fixes the previously-confirmed bug: employees.employee_id is an independent
     * auto-increment PK, NOT the same value-space as users.user_id, so looking up
     * `employees WHERE employee_id = $userId` silently failed for almost every
     * admin. The correct, stable join key between the two tables is email.
     *
     * Returns ['employee_key' => ?string, 'staff_role' => ?string].
     */
    public static function resolveActorIdentity(array $authUser): array
    {
        $staffRole = $authUser['staff_role'] ?? null;
        $staffRole = $staffRole ? strtolower(trim((string)$staffRole)) : null;
        if ($staffRole === '' || ($staffRole !== null && !in_array($staffRole, self::STAFF_ROLES, true))) {
            $staffRole = null;
        }
        // Legacy admins with no staff_role are treated as 'owner', mirroring AdminMiddleware.
        if ($staffRole === null && ($authUser['user_type'] ?? '') === 'admin') {
            $staffRole = 'owner';
        }

        $employeeKey = null;

        $email = isset($authUser['email']) ? strtolower(trim((string)$authUser['email'])) : null;
        if ($email) {
            $byEmail = Database::fetch(
                'SELECT employee_key FROM employees WHERE LOWER(email) = ? AND tenant_id = ? LIMIT 1',
                [$email, Database::tenantId()]
            );
            if ($byEmail) {
                $employeeKey = $byEmail['employee_key'];
            }
        }

        return ['employee_key' => $employeeKey, 'staff_role' => $staffRole];
    }

    private static function addHistory(int $workflowId, ?string $actorId, ?int $actorUserId, string $actorName, ?string $fromStage, string $toStage, ?string $note): void
    {
        Database::insertTenant('workflow_history', [
            'workflow_id'   => $workflowId,
            'actor_id'      => $actorId,
            'actor_user_id' => $actorUserId,
            'actor_name'    => $actorName,
            'from_stage'    => $fromStage,
            'to_stage'      => $toStage,
            'note'          => $note,
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM workflows WHERE workflow_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function getTypes(): array
    {
        return self::TYPES;
    }

    public static function getStages(): array
    {
        return self::STAGES;
    }

    public static function getPriorities(): array
    {
        return self::PRIORITIES;
    }

    public static function getAllowedTransitions(): array
    {
        return self::ALLOWED_TRANSITIONS;
    }

    public static function getApproverRoles(): array
    {
        return self::STAFF_ROLES;
    }

    /** Full metadata bundle for the frontend create/edit forms in one round trip. */
    public static function meta(): array
    {
        return [
            'types' => self::TYPES,
            'stages' => self::STAGES,
            'priorities' => self::PRIORITIES,
            'allowed_transitions' => self::ALLOWED_TRANSITIONS,
            'approver_roles' => self::STAFF_ROLES,
        ];
    }

    private static function resolveDueAt(array $data): ?string
    {
        if (!empty($data['due_at'])) {
            return $data['due_at'];
        }
        if (!empty($data['due_date'])) {
            return $data['due_date'] . ' 23:59:59';
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reusable approval DEFINITIONS
    // ─────────────────────────────────────────────────────────────────────

    public static function listDefinitions(?string $type = null, bool $activeOnly = false): array
    {
        $where = ['tenant_id = ?'];
        $params = [Database::tenantId()];
        if ($type) {
            $where[] = 'type = ?';
            $params[] = $type;
        }
        if ($activeOnly) {
            $where[] = 'is_active = 1';
        }
        $rows = Database::fetchAll(
            'SELECT * FROM workflow_definitions WHERE ' . implode(' AND ', $where) . ' ORDER BY name ASC',
            $params
        );
        foreach ($rows as &$row) {
            $row['steps'] = self::getDefinitionSteps((int)$row['definition_id']);
        }
        return $rows;
    }

    public static function findDefinitionById(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM workflow_definitions WHERE definition_id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }
        $row['steps'] = self::getDefinitionSteps($id);
        return $row;
    }

    public static function getDefinitionSteps(int $definitionId): array
    {
        return Database::fetchAll(
            'SELECT * FROM workflow_definition_steps WHERE definition_id = ? AND tenant_id = ? ORDER BY step_order ASC',
            [$definitionId, Database::tenantId()]
        );
    }

    /**
     * Find the best-matching active definition for a workflow type + amount,
     * so a new submission can auto-attach to a condition-matched chain
     * (e.g. "Purchase Request > 50,000" routes to Finance Director approval).
     */
    public static function matchDefinition(string $type, ?float $amount): ?array
    {
        $defs = self::listDefinitions($type, true);
        $best = null;
        foreach ($defs as $def) {
            $cond = $def['condition_json'] ? json_decode((string)$def['condition_json'], true) : null;
            $min = $cond['min_amount'] ?? null;
            $max = $cond['max_amount'] ?? null;

            if ($min !== null && ($amount === null || $amount < (float)$min)) {
                continue;
            }
            if ($max !== null && ($amount === null || $amount > (float)$max)) {
                continue;
            }
            // Prefer the most specific (narrowest) matching range.
            if ($best === null) {
                $best = $def;
                continue;
            }
            $bestCond = $best['condition_json'] ? json_decode((string)$best['condition_json'], true) : null;
            $bestSpecificity = ($bestCond['min_amount'] ?? null) !== null || ($bestCond['max_amount'] ?? null) !== null;
            $thisSpecificity = $min !== null || $max !== null;
            if ($thisSpecificity && !$bestSpecificity) {
                $best = $def;
            }
        }
        return $best;
    }

    public static function createDefinition(array $data): int
    {
        $id = Database::insertTenant('workflow_definitions', [
            'name'                  => $data['name'],
            'type'                  => $data['type'],
            'description'           => $data['description'] ?? null,
            'is_active'             => isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1,
            'condition_json'        => isset($data['condition']) ? json_encode($data['condition']) : null,
            'required_fields_json'  => isset($data['required_fields']) ? json_encode($data['required_fields']) : null,
            'created_by'            => $data['created_by'] ?? null,
            'created_at'            => date('Y-m-d H:i:s'),
        ]);

        if (!empty($data['steps']) && is_array($data['steps'])) {
            self::replaceDefinitionSteps($id, $data['steps']);
        }

        return $id;
    }

    public static function updateDefinition(int $id, array $data): bool
    {
        $existing = Database::fetch(
            'SELECT definition_id FROM workflow_definitions WHERE definition_id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
        if (!$existing) {
            return false;
        }

        $allowed = ['name', 'type', 'description', 'is_active'];
        $fields = [];
        $values = [];
        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "`$field` = ?";
            $values[] = $field === 'is_active' ? (int)(bool)$data[$field] : $data[$field];
        }
        if (array_key_exists('condition', $data)) {
            $fields[] = '`condition_json` = ?';
            $values[] = $data['condition'] !== null ? json_encode($data['condition']) : null;
        }
        if (array_key_exists('required_fields', $data)) {
            $fields[] = '`required_fields_json` = ?';
            $values[] = $data['required_fields'] !== null ? json_encode($data['required_fields']) : null;
        }

        if (!empty($fields)) {
            $values[] = $id;
            $values[] = Database::tenantId();
            Database::execute(
                'UPDATE workflow_definitions SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE definition_id = ? AND tenant_id = ?',
                $values
            );
        }

        if (array_key_exists('steps', $data) && is_array($data['steps'])) {
            self::replaceDefinitionSteps($id, $data['steps']);
        }

        return true;
    }

    public static function deleteDefinition(int $id): void
    {
        Database::execute('DELETE FROM workflow_definitions WHERE definition_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    private static function replaceDefinitionSteps(int $definitionId, array $steps): void
    {
        Database::execute('DELETE FROM workflow_definition_steps WHERE definition_id = ? AND tenant_id = ?', [$definitionId, Database::tenantId()]);

        $order = 1;
        foreach ($steps as $step) {
            if (empty($step['name']) || empty($step['to_stage'])) {
                continue;
            }
            Database::insertTenant('workflow_definition_steps', [
                'definition_id'             => $definitionId,
                'step_order'                => $step['step_order'] ?? $order,
                'name'                      => $step['name'],
                'to_stage'                  => $step['to_stage'],
                'approver_role'             => $step['approver_role'] ?? null,
                'approver_employee_key'     => $step['approver_employee_key'] ?? null,
                'sla_hours'                 => isset($step['sla_hours']) ? (int)$step['sla_hours'] : 24,
                'escalate_to_employee_key'  => $step['escalate_to_employee_key'] ?? null,
                'created_at'                => date('Y-m-d H:i:s'),
            ]);
            $order++;
        }
    }

    private static function nextDefinitionStep(int $definitionId, ?int $currentStepId): ?array
    {
        $steps = self::getDefinitionSteps($definitionId);
        if (empty($steps)) {
            return null;
        }
        if ($currentStepId === null) {
            return $steps[0];
        }
        $foundCurrent = false;
        foreach ($steps as $step) {
            if ($foundCurrent) {
                return $step;
            }
            if ((int)$step['step_id'] === $currentStepId) {
                $foundCurrent = true;
            }
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────
    // SLA / escalation support (consumed by api/cron/workflow_escalation.php)
    // ─────────────────────────────────────────────────────────────────────

    /** Workflows past due_at, not yet terminal, for the CURRENT tenant context. */
    public static function overdue(): array
    {
        return Database::fetchAll(
            "SELECT workflow_id, title, type, stage, priority, amount,
                    requester_id, requester_name, approver_id, approver_name, approver_user_id,
                    due_at, escalated_at, last_reminder_at, reminder_count, current_step_id
             FROM workflows
             WHERE tenant_id = ? AND due_at IS NOT NULL AND due_at < NOW()
               AND stage NOT IN ('Completed', 'Rejected')
             ORDER BY due_at ASC",
            [Database::tenantId()]
        );
    }

    public static function recordReminderSent(int $workflowId, bool $isEscalation): void
    {
        if ($isEscalation) {
            Database::execute(
                'UPDATE workflows SET escalated_at = NOW(), last_reminder_at = NOW(), reminder_count = reminder_count + 1
                 WHERE workflow_id = ? AND tenant_id = ?',
                [$workflowId, Database::tenantId()]
            );
        } else {
            Database::execute(
                'UPDATE workflows SET last_reminder_at = NOW(), reminder_count = reminder_count + 1
                 WHERE workflow_id = ? AND tenant_id = ?',
                [$workflowId, Database::tenantId()]
            );
        }
    }

    public static function logEscalation(int $workflowId, string $kind, ?string $recipientEmail, bool $sent, ?string $note = null): void
    {
        Database::insertTenant('workflow_escalations', [
            'workflow_id'     => $workflowId,
            'kind'            => $kind,
            'recipient_email' => $recipientEmail,
            'sent'            => (int)$sent,
            'note'            => $note,
            'created_at'      => date('Y-m-d H:i:s'),
        ]);
    }

    /** Resolve an approver's notification email: employee email, else linked user email. */
    public static function approverEmail(array $workflow): ?string
    {
        if (!empty($workflow['approver_id'])) {
            $emp = Database::fetch(
                'SELECT email FROM employees WHERE employee_key = ? AND tenant_id = ? LIMIT 1',
                [$workflow['approver_id'], Database::tenantId()]
            );
            if ($emp && !empty($emp['email'])) {
                return $emp['email'];
            }
        }
        if (!empty($workflow['approver_user_id'])) {
            $user = Database::fetch('SELECT email FROM users WHERE user_id = ? LIMIT 1', [(int)$workflow['approver_user_id']]);
            if ($user && !empty($user['email'])) {
                return $user['email'];
            }
        }
        return null;
    }

    /** Escalation target email for the current step (or null if none configured). */
    public static function escalationEmail(array $workflow): ?string
    {
        if (empty($workflow['current_step_id'])) {
            return null;
        }
        $step = Database::fetch(
            'SELECT escalate_to_employee_key FROM workflow_definition_steps WHERE step_id = ? AND tenant_id = ?',
            [(int)$workflow['current_step_id'], Database::tenantId()]
        );
        if (!$step || empty($step['escalate_to_employee_key'])) {
            return null;
        }
        $emp = Database::fetch(
            'SELECT email FROM employees WHERE employee_key = ? AND tenant_id = ? LIMIT 1',
            [$step['escalate_to_employee_key'], Database::tenantId()]
        );
        return $emp['email'] ?? null;
    }

    public static function format(array $row): array
    {
        $history = $row['history'] ?? [];

        // Format history array
        $formattedHistory = array_map(function($h) {
            return [
                'id' => (string)$h['history_id'],
                'history_id' => (int)$h['history_id'],
                'workflow_id' => (int)$h['workflow_id'],
                'actor_id' => $h['actor_id'] ?? null, // EMP-XXX
                'actor_user_id' => isset($h['actor_user_id']) && $h['actor_user_id'] !== null ? (int)$h['actor_user_id'] : null,
                'actor_name' => $h['actor_name'] ?? null,
                'from_stage' => $h['from_stage'] ?? null,
                'to_stage' => $h['to_stage'],
                'note' => $h['note'] ?? null,
                'created_at' => $h['created_at'] ?? null,
            ];
        }, $history);

        return [
            'id' => (string)$row['workflow_id'],
            'workflow_id' => (int)$row['workflow_id'],
            'title' => $row['title'],
            'type' => $row['type'],
            'definition_id' => isset($row['definition_id']) && $row['definition_id'] !== null ? (int)$row['definition_id'] : null,
            'current_step_id' => isset($row['current_step_id']) && $row['current_step_id'] !== null ? (int)$row['current_step_id'] : null,
            'definition' => $row['definition'] ?? null,
            'description' => $row['description'] ?? '',
            'requester_id' => $row['requester_id'] ?? null, // EMP-XXX
            'requester_name' => $row['requester_name'] ?? null,
            'requester_user_id' => isset($row['requester_user_id']) && $row['requester_user_id'] !== null ? (int)$row['requester_user_id'] : null,
            'approver_id' => $row['approver_id'] ?? null, // EMP-XXX
            'approver_name' => $row['approver_name'] ?? null,
            'approver_user_id' => isset($row['approver_user_id']) && $row['approver_user_id'] !== null ? (int)$row['approver_user_id'] : null,
            'priority' => $row['priority'] ?? 'Medium',
            'amount' => $row['amount'] ? (float)$row['amount'] : null,
            'due_date' => $row['due_date'] ?? null,
            'due_at' => $row['due_at'] ?? null,
            'escalated_at' => $row['escalated_at'] ?? null,
            'last_reminder_at' => $row['last_reminder_at'] ?? null,
            'reminder_count' => isset($row['reminder_count']) ? (int)$row['reminder_count'] : 0,
            'stage' => $row['stage'] ?? 'Pending',
            'history' => $formattedHistory,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    public static function formatDefinition(array $row): array
    {
        return [
            'id' => (string)$row['definition_id'],
            'definition_id' => (int)$row['definition_id'],
            'name' => $row['name'],
            'type' => $row['type'],
            'description' => $row['description'] ?? '',
            'is_active' => (bool)$row['is_active'],
            'condition' => $row['condition_json'] ? json_decode((string)$row['condition_json'], true) : null,
            'required_fields' => $row['required_fields_json'] ? json_decode((string)$row['required_fields_json'], true) : [],
            'steps' => array_map(static function (array $s): array {
                return [
                    'id' => (string)$s['step_id'],
                    'step_id' => (int)$s['step_id'],
                    'step_order' => (int)$s['step_order'],
                    'name' => $s['name'],
                    'to_stage' => $s['to_stage'],
                    'approver_role' => $s['approver_role'] ?? null,
                    'approver_employee_key' => $s['approver_employee_key'] ?? null,
                    'sla_hours' => (int)$s['sla_hours'],
                    'escalate_to_employee_key' => $s['escalate_to_employee_key'] ?? null,
                ];
            }, $row['steps'] ?? []),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
