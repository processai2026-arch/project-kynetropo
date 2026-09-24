<?php
declare(strict_types=1);

class AdminWorkflowController
{
    /**
     * GET /api/admin/workflows - List all workflows
     */
    public function index(Request $request): void
    {
        $filters = [];

        if ($type = $request->query('type')) {
            $filters['type'] = $type;
        }
        if ($stage = $request->query('stage')) {
            $filters['stage'] = $stage;
        }
        if ($priority = $request->query('priority')) {
            $filters['priority'] = $priority;
        }
        if ($requesterId = $request->query('requester_id')) {
            $filters['requester_id'] = $requesterId;
        }
        if ($approverId = $request->query('approver_id')) {
            $filters['approver_id'] = $approverId;
        }
        if ($request->query('overdue')) {
            $filters['overdue'] = true;
        }

        $rows = Workflow::all($filters);
        Response::success(array_map([Workflow::class, 'format'], $rows));
    }

    /**
     * GET /api/admin/workflows/meta - Workflow types/stages/priorities/transition graph/roles
     * (Previously only existed as unrouted controller methods; the frontend had to
     * duplicate these constants by hand. This is the single source of truth now.)
     */
    public function meta(Request $request): void
    {
        Response::success(Workflow::meta());
    }

    /**
     * GET /api/admin/workflows/{id} - Get single workflow with history
     */
    public function show(Request $request): void
    {
        $id = (int)$request->param('id');
        $workflow = Workflow::findById($id);

        if (!$workflow) {
            Response::error('Workflow not found', 404);
        }

        Response::success(Workflow::format($workflow));
    }

    /**
     * POST /api/admin/workflows - Create new workflow
     */
    public function store(Request $request): void
    {
        $title = trim((string)$request->input('title', ''));
        $type = trim((string)$request->input('type', ''));
        $description = trim((string)$request->input('description', ''));

        // Handle both camelCase and snake_case field names
        $requester_input = $request->input('requesterId') ?? $request->input('requester_id');
        $approver_input = $request->input('approverId') ?? $request->input('approver_id');

        // Convert employee ID (EMP-XXX) to employee name
        $requester_name = self::resolveEmployeeName($requester_input);
        $approver_name = self::resolveEmployeeName($approver_input);

        // Store the employee key (EMP-XXX) in the ID columns
        $requester_id = $requester_input; // Store EMP-003
        $approver_id = $approver_input;   // Store EMP-004

        $priority = trim((string)$request->input('priority', 'Medium'));
        $amount = $request->input('amount');

        // Handle both camelCase and snake_case for due_date
        $due_date = $request->input('dueDate') ?? $request->input('due_date');

        $stage = trim((string)$request->input('stage', 'Pending'));
        $definitionIdInput = $request->input('definitionId') ?? $request->input('definition_id');

        // Validation
        if (!$title) Response::error('Title is required', 422);
        if (!$type) Response::error('Type is required', 422);
        if (!$requester_name) Response::error('Requester is required', 422);
        if (!$approver_name) Response::error('Approver is required', 422);

        if (strlen($title) > 200) {
            Response::error('Title must not exceed 200 characters', 422);
        }

        $validTypes = Workflow::getTypes();
        if (!in_array($type, $validTypes, true)) {
            Response::error('Invalid workflow type', 422);
        }

        $validPriorities = Workflow::getPriorities();
        if (!in_array($priority, $validPriorities, true)) {
            Response::error('Invalid priority', 422);
        }

        $validStages = Workflow::getStages();
        if (!in_array($stage, $validStages, true)) {
            Response::error('Invalid stage', 422);
        }

        if ($due_date && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $due_date)) {
            Response::error('Due date must be in YYYY-MM-DD format', 422);
        }

        if ($amount !== null && $amount !== '' && !is_numeric($amount)) {
            Response::error('Amount must be a number', 422);
        }
        $amountValue = ($amount !== null && $amount !== '') ? (float)$amount : null;

        // ── Reusable approval definition matching ───────────────────────────
        // Either an explicit definition_id was supplied, or we auto-match the
        // best active definition for this type + amount (condition thresholds).
        $definition = null;
        if ($definitionIdInput) {
            $definition = Workflow::findDefinitionById((int)$definitionIdInput);
            if (!$definition) {
                Response::error('Workflow definition not found', 404);
            }
            if ($definition['type'] !== $type) {
                Response::error('Selected definition does not match the workflow type', 422);
            }
        } else {
            $definition = Workflow::matchDefinition($type, $amountValue);
        }

        // Required-fields enforcement from the definition (work-reducing guardrail —
        // a requester cannot submit an incomplete request that will just bounce back).
        if ($definition && !empty($definition['required_fields'])) {
            $provided = [
                'title' => $title !== '', 'description' => $description !== '',
                'amount' => $amountValue !== null, 'due_date' => !empty($due_date),
                'requester_id' => !empty($requester_id), 'approver_id' => !empty($approver_id),
            ];
            $missing = [];
            foreach ($definition['required_fields'] as $field) {
                if (array_key_exists($field, $provided) && !$provided[$field]) {
                    $missing[] = $field;
                }
            }
            if (!empty($missing)) {
                Response::error('Missing required field(s) for this workflow type: ' . implode(', ', $missing), 422);
            }
        }

        $firstStep = $definition['steps'][0] ?? null;
        $dueAt = null;
        $currentStepId = null;
        if ($firstStep) {
            $dueAt = date('Y-m-d H:i:s', strtotime('+' . (int)$firstStep['sla_hours'] . ' hours'));
            $currentStepId = (int)$firstStep['step_id'];
            // A definition step's approver (role or specific employee) overrides a
            // free-text approver pick, so the approval chain is actually enforced.
            if (!empty($firstStep['approver_employee_key'])) {
                $approver_id = $firstStep['approver_employee_key'];
                $resolvedName = self::resolveEmployeeName($approver_id);
                if ($resolvedName) {
                    $approver_name = $resolvedName;
                }
            }
        }

        $requesterUserId = self::resolveUserIdForEmployeeKey($requester_id);
        $approverUserId = self::resolveUserIdForEmployeeKey($approver_id);

        try {
            $id = Workflow::create([
                'title' => $title,
                'type' => $type,
                'definition_id' => $definition['definition_id'] ?? null,
                'current_step_id' => $currentStepId,
                'description' => $description,
                'requester_id' => $requester_id,
                'requester_name' => $requester_name,
                'requester_user_id' => $requesterUserId,
                'approver_id' => $approver_id,
                'approver_name' => $approver_name,
                'approver_user_id' => $approverUserId,
                'priority' => $priority,
                'amount' => $amountValue,
                'due_date' => $due_date,
                'due_at' => $dueAt,
                'stage' => $stage,
            ]);

            $row = Workflow::findById($id);
            Response::success(Workflow::format($row), 'Workflow created', 201);
        } catch (Exception $e) {
            error_log('Workflow creation error: ' . $e->getMessage());
            Response::error('Failed to create workflow: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/admin/workflows/{id} - Edit a workflow (title/description/priority/
     * amount/due date/requester/approver). Does NOT change stage — use transition().
     */
    public function update(Request $request): void
    {
        $id = (int)$request->param('id');
        $existing = Workflow::findById($id);
        if (!$existing) {
            Response::error('Workflow not found', 404);
        }

        $data = [];

        if ($request->input('title') !== null) {
            $title = trim((string)$request->input('title'));
            if (!$title) Response::error('Title cannot be empty', 422);
            if (strlen($title) > 200) Response::error('Title must not exceed 200 characters', 422);
            $data['title'] = $title;
        }

        if ($request->input('description') !== null) {
            $data['description'] = trim((string)$request->input('description'));
        }

        if ($request->input('priority') !== null) {
            $priority = trim((string)$request->input('priority'));
            if (!in_array($priority, Workflow::getPriorities(), true)) {
                Response::error('Invalid priority', 422);
            }
            $data['priority'] = $priority;
        }

        if ($request->input('amount') !== null) {
            $amount = $request->input('amount');
            if ($amount !== '' && !is_numeric($amount)) {
                Response::error('Amount must be a number', 422);
            }
            $data['amount'] = $amount === '' ? null : (float)$amount;
        }

        $dueDate = $request->input('dueDate') ?? $request->input('due_date');
        if ($dueDate !== null) {
            if ($dueDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
                Response::error('Due date must be in YYYY-MM-DD format', 422);
            }
            $data['due_date'] = $dueDate === '' ? null : $dueDate;
            $data['due_at'] = $dueDate === '' ? null : $dueDate . ' 23:59:59';
        }

        $requesterInput = $request->input('requesterId') ?? $request->input('requester_id');
        if ($requesterInput !== null) {
            $name = self::resolveEmployeeName($requesterInput);
            if (!$name) Response::error('Requester not found', 422);
            $data['requester_id'] = $requesterInput;
            $data['requester_name'] = $name;
            $data['requester_user_id'] = self::resolveUserIdForEmployeeKey($requesterInput);
        }

        $approverInput = $request->input('approverId') ?? $request->input('approver_id');
        if ($approverInput !== null) {
            $name = self::resolveEmployeeName($approverInput);
            if (!$name) Response::error('Approver not found', 422);
            $data['approver_id'] = $approverInput;
            $data['approver_name'] = $name;
            $data['approver_user_id'] = self::resolveUserIdForEmployeeKey($approverInput);
        }

        if (empty($data)) {
            Response::error('No editable fields provided', 422);
        }

        $ok = Workflow::update($id, $data);
        if (!$ok) {
            Response::error('Workflow not found', 404);
        }

        $updated = Workflow::findById($id);
        Response::success(Workflow::format($updated), 'Workflow updated');
    }

    /**
     * POST /api/admin/workflows/{id}/transition - Transition workflow stage
     *
     * Backend-enforced: the stage transition must be legal per the allowed-
     * transition graph (409 if not), and the actor must be the designated
     * approver/owner/step role for approval gates (403 if not). The actor's
     * identity is resolved from the AUTHENTICATED user (never trusted from the
     * request body), fixing the previous EMP-XXX <-> users.user_id mismatch.
     */
    public function transition(Request $request): void
    {
        $id = (int)$request->param('id');
        $workflow = Workflow::findById($id);

        if (!$workflow) {
            Response::error('Workflow not found', 404);
        }

        $stage = trim((string)$request->input('stage', ''));
        $note = trim((string)$request->input('note', ''));

        if (!$stage) {
            Response::error('Stage is required', 422);
        }

        $validStages = Workflow::getStages();
        if (!in_array($stage, $validStages, true)) {
            Response::error('Invalid stage', 422);
        }

        if (!$request->user) {
            Response::error('User not authenticated', 401);
        }

        $identity = Workflow::resolveActorIdentity($request->user);
        $actorEmployeeKey = $identity['employee_key'];
        $actorStaffRole = $identity['staff_role'];
        $actorUserId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        if (!$actorEmployeeKey && $actorStaffRole !== 'owner') {
            // No employee record matches this admin's email, and they're not an
            // owner (who may act on behalf of any approver) — refuse rather than
            // silently misattributing the action to "Unknown".
            Response::error('No employee record is linked to your account (matched by email). Ask an owner to add one or to perform this action.', 404);
        }

        $result = Workflow::transition($id, $stage, $actorEmployeeKey ?? '', $actorUserId, $actorStaffRole, $note ?: null);

        if (!$result['ok']) {
            Response::error($result['error'] ?? 'Failed to transition workflow', $result['code'] ?? 500);
        }

        $updated = Workflow::findById($id);
        Response::success(Workflow::format($updated), 'Workflow transitioned');
    }

    /**
     * DELETE /api/admin/workflows/{id} - Delete workflow
     */
    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        $workflow = Workflow::findById($id);

        if (!$workflow) {
            Response::error('Workflow not found', 404);
        }

        Workflow::delete($id);
        Response::success(null, 'Workflow deleted');
    }

    /**
     * GET /api/admin/workflows/types - Get available workflow types
     */
    public function types(Request $request): void
    {
        Response::success(Workflow::getTypes());
    }

    /**
     * GET /api/admin/workflows/stages - Get available stages
     */
    public function stages(Request $request): void
    {
        Response::success(Workflow::getStages());
    }

    /**
     * GET /api/admin/workflows/priorities - Get available priorities
     */
    public function priorities(Request $request): void
    {
        Response::success(Workflow::getPriorities());
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reusable approval DEFINITIONS — work-reducing feature: configure once
    // (conditions/required fields/SLA per step), every matching workflow
    // auto-routes and auto-escalates without manual chasing.
    // ─────────────────────────────────────────────────────────────────────

    /** GET /api/admin/workflows/definitions */
    public function definitionsIndex(Request $request): void
    {
        $type = $request->query('type');
        $rows = Workflow::listDefinitions($type ?: null);
        Response::success(array_map([Workflow::class, 'formatDefinition'], $rows));
    }

    /** GET /api/admin/workflows/definitions/{id} */
    public function definitionsShow(Request $request): void
    {
        $id = (int)$request->param('id');
        $row = Workflow::findDefinitionById($id);
        if (!$row) {
            Response::error('Workflow definition not found', 404);
        }
        Response::success(Workflow::formatDefinition($row));
    }

    /** POST /api/admin/workflows/definitions */
    public function definitionsStore(Request $request): void
    {
        $name = trim((string)$request->input('name', ''));
        $type = trim((string)$request->input('type', ''));

        if (!$name) Response::error('Name is required', 422);
        if (strlen($name) > 150) Response::error('Name must not exceed 150 characters', 422);
        if (!$type) Response::error('Type is required', 422);
        if (!in_array($type, Workflow::getTypes(), true)) {
            Response::error('Invalid workflow type', 422);
        }

        $steps = $request->input('steps');
        $steps = is_array($steps) ? $steps : [];
        $stepErrors = self::validateSteps($steps);
        if ($stepErrors) {
            Response::error($stepErrors, 422);
        }

        $condition = $request->input('condition');
        if ($condition !== null && !is_array($condition)) {
            Response::error('Condition must be an object, e.g. {"min_amount":50000}', 422);
        }

        $requiredFields = $request->input('required_fields') ?? $request->input('requiredFields');
        if ($requiredFields !== null && !is_array($requiredFields)) {
            Response::error('required_fields must be an array', 422);
        }

        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        $id = Workflow::createDefinition([
            'name' => $name,
            'type' => $type,
            'description' => trim((string)$request->input('description', '')) ?: null,
            'is_active' => $request->input('is_active') ?? $request->input('isActive') ?? true,
            'condition' => $condition,
            'required_fields' => $requiredFields,
            'steps' => $steps,
            'created_by' => $userId,
        ]);

        $row = Workflow::findDefinitionById($id);
        Response::success(Workflow::formatDefinition($row), 'Workflow definition created', 201);
    }

    /** PUT /api/admin/workflows/definitions/{id} */
    public function definitionsUpdate(Request $request): void
    {
        $id = (int)$request->param('id');
        $existing = Workflow::findDefinitionById($id);
        if (!$existing) {
            Response::error('Workflow definition not found', 404);
        }

        $data = [];

        if ($request->input('name') !== null) {
            $name = trim((string)$request->input('name'));
            if (!$name) Response::error('Name cannot be empty', 422);
            if (strlen($name) > 150) Response::error('Name must not exceed 150 characters', 422);
            $data['name'] = $name;
        }

        if ($request->input('type') !== null) {
            $type = trim((string)$request->input('type'));
            if (!in_array($type, Workflow::getTypes(), true)) {
                Response::error('Invalid workflow type', 422);
            }
            $data['type'] = $type;
        }

        if ($request->input('description') !== null) {
            $data['description'] = trim((string)$request->input('description'));
        }

        if ($request->input('is_active') !== null || $request->input('isActive') !== null) {
            $data['is_active'] = $request->input('is_active') ?? $request->input('isActive');
        }

        if ($request->input('condition') !== null) {
            $condition = $request->input('condition');
            if (!is_array($condition)) {
                Response::error('Condition must be an object, e.g. {"min_amount":50000}', 422);
            }
            $data['condition'] = $condition;
        }

        $requiredFields = $request->input('required_fields') ?? $request->input('requiredFields');
        if ($requiredFields !== null) {
            if (!is_array($requiredFields)) {
                Response::error('required_fields must be an array', 422);
            }
            $data['required_fields'] = $requiredFields;
        }

        if ($request->input('steps') !== null) {
            $steps = $request->input('steps');
            if (!is_array($steps)) {
                Response::error('steps must be an array', 422);
            }
            $stepErrors = self::validateSteps($steps);
            if ($stepErrors) {
                Response::error($stepErrors, 422);
            }
            $data['steps'] = $steps;
        }

        Workflow::updateDefinition($id, $data);

        $row = Workflow::findDefinitionById($id);
        Response::success(Workflow::formatDefinition($row), 'Workflow definition updated');
    }

    /** DELETE /api/admin/workflows/definitions/{id} */
    public function definitionsDestroy(Request $request): void
    {
        $id = (int)$request->param('id');
        $existing = Workflow::findDefinitionById($id);
        if (!$existing) {
            Response::error('Workflow definition not found', 404);
        }
        Workflow::deleteDefinition($id);
        Response::success(null, 'Workflow definition deleted');
    }

    private static function validateSteps(array $steps): ?string
    {
        $validStages = Workflow::getStages();
        $validRoles = Workflow::getApproverRoles();
        foreach ($steps as $i => $step) {
            if (!is_array($step)) {
                return "Step #" . ($i + 1) . " is invalid";
            }
            if (empty($step['name'])) {
                return "Step #" . ($i + 1) . " requires a name";
            }
            if (empty($step['to_stage']) || !in_array($step['to_stage'], $validStages, true)) {
                return "Step #" . ($i + 1) . " has an invalid to_stage";
            }
            if (!empty($step['approver_role']) && !in_array($step['approver_role'], $validRoles, true)) {
                return "Step #" . ($i + 1) . " has an invalid approver_role. Allowed: " . implode(', ', $validRoles);
            }
            if (isset($step['sla_hours']) && (!is_numeric($step['sla_hours']) || (int)$step['sla_hours'] <= 0)) {
                return "Step #" . ($i + 1) . " sla_hours must be a positive number";
            }
        }
        return null;
    }

    /**
     * Helper: Convert employee key (EMP-XXX format) to employee name
     */
    private static function resolveEmployeeName($input): ?string
    {
        if (empty($input)) {
            return null;
        }

        // If it's already a name (not EMP-XXX format), return it as-is
        if (is_string($input) && !preg_match('/^EMP-\d+$/', $input)) {
            return $input;
        }

        // If it's an employee key in format EMP-XXX, look up the name
        if (is_string($input) && preg_match('/^EMP-\d+$/', $input)) {
            $employee = Database::fetch(
                'SELECT name FROM employees WHERE employee_key = ? AND tenant_id = ? LIMIT 1',
                [$input, Database::tenantId()]
            );
            return $employee ? $employee['name'] : null;
        }

        return null;
    }

    /**
     * Helper: Resolve an employee key (EMP-XXX) to the users.user_id it is
     * linked to, by matching employees.email to users.email (case-insensitive).
     * Returns null when there is no employee record or no matching user account
     * (e.g. shop-floor staff who never log in) — that is expected and fine; the
     * EMP-XXX key remains the durable identity, the user_id is best-effort.
     */
    private static function resolveUserIdForEmployeeKey($employeeKey): ?int
    {
        if (empty($employeeKey) || !is_string($employeeKey) || !preg_match('/^EMP-\d+$/', $employeeKey)) {
            return null;
        }
        $row = Database::fetch(
            'SELECT u.user_id
             FROM employees e
             JOIN users u ON LOWER(u.email) = LOWER(e.email)
             WHERE e.employee_key = ? AND e.tenant_id = ? AND e.email IS NOT NULL AND e.email <> ""
             LIMIT 1',
            [$employeeKey, Database::tenantId()]
        );
        return $row ? (int)$row['user_id'] : null;
    }
}
