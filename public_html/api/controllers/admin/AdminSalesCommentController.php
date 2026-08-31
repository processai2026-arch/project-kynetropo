<?php
declare(strict_types=1);

/**
 * Sales Comments Controller — the discussion thread on a sales record.
 *
 *   GET    /admin/sales/comments?entity_type=&entity_id=  — one thread
 *   POST   /admin/sales/comments                          — add a comment
 *   PUT    /admin/sales/comments/{id}                     — edit your own
 *   DELETE /admin/sales/comments/{id}                     — delete (soft)
 *   POST   /admin/sales/comments/{id}/restore             — undo a deletion
 *
 * Access follows the record, not the comment: you can read and write a thread
 * exactly when you can see the thing it hangs off. A lead-scoped salesperson
 * therefore cannot read the discussion on somebody else's lead by guessing an
 * id — the entity lookup 404s first.
 */
class AdminSalesCommentController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.view');

        [$entityType, $entityId] = $this->resolveEntity(
            $request,
            (string)$request->query('entity_type', ''),
            (int)$request->query('entity_id', 0)
        );

        Response::success([
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'items'       => SalesComment::forEntity($entityType, $entityId),
        ]);
    }

    public function store(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.create');

        $entityType = (string)$request->input('entity_type', '');
        $entityId   = (int)$request->input('entity_id', 0);
        [$entityType, $entityId, $context] = $this->resolveEntity($request, $entityType, $entityId);

        $body = trim((string)$request->input('body', ''));
        if ($body === '') {
            Response::error('A comment cannot be empty', 422);
        }
        if (mb_strlen($body) > SalesComment::MAX_LENGTH) {
            Response::error('A comment is limited to ' . SalesComment::MAX_LENGTH . ' characters', 422);
        }

        $id = SalesComment::create([
            'entity_type'  => $entityType,
            'entity_id'    => $entityId,
            'lead_id'      => $context['lead_id']      ?? null,
            'challenge_id' => $context['challenge_id'] ?? null,
            'body'         => $body,
            'author_id'    => isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
            'author_name'  => (string)($request->user['name'] ?? ''),
        ]);

        // Put the comment on the record's own history, so the lead timeline and
        // the challenge log read as one story rather than two parallel ones.
        if (!empty($context['lead_id'])) {
            SalesActivity::log(
                (int)$context['lead_id'],
                'comment_added',
                'Comment on ' . $this->entityLabel($entityType),
                $request->user,
                mb_substr($body, 0, 500),
                $entityType,
                $entityId
            );
        } elseif (!empty($context['challenge_id'])) {
            SalesChallenge::logActivity(
                (int)$context['challenge_id'],
                'commented',
                $request->user,
                mb_substr($body, 0, 500)
            );
        }

        $row = SalesComment::findRaw($id);
        Response::success(['comment' => $row ? SalesComment::format($row) : null], 'Comment added', 201);
    }

    public function update(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.create');

        $row = $this->findActionable($request, (int)$request->param('id'), false);

        $body = trim((string)$request->input('body', ''));
        if ($body === '') {
            Response::error('A comment cannot be empty', 422);
        }

        SalesComment::update((int)$row['id'], $body);
        $updated = SalesComment::findRaw((int)$row['id']);

        Response::success(['comment' => $updated ? SalesComment::format($updated) : null], 'Comment updated');
    }

    public function destroy(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.view');

        $row = $this->findActionable($request, (int)$request->param('id'), true);
        SalesComment::softDelete(
            (int)$row['id'],
            isset($request->user['user_id']) ? (int)$request->user['user_id'] : null
        );

        Response::success(['id' => (int)$row['id']], 'Comment deleted');
    }

    /** Undo a deletion — deleting the wrong comment should not be permanent. */
    public function restore(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.view');

        $row = $this->findActionable($request, (int)$request->param('id'), true, true);
        if ($row['deleted_at'] === null) {
            Response::error('That comment is not deleted', 409);
        }

        SalesComment::restore((int)$row['id']);
        $restored = SalesComment::findRaw((int)$row['id']);

        Response::success(['comment' => $restored ? SalesComment::format($restored) : null], 'Comment restored');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Validates the target record and confirms the user may see it.
     *
     * @return array{0:string,1:int,2:array}
     */
    private function resolveEntity(Request $request, string $entityType, int $entityId): array
    {
        if (!in_array($entityType, SalesComment::ENTITY_TYPES, true)) {
            Response::error('Invalid entity type. Allowed: ' . implode(', ', SalesComment::ENTITY_TYPES), 422);
        }
        if ($entityId < 1) {
            Response::error('A record id is required', 422);
        }

        if ($entityType === 'challenge') {
            SalesPermissions::enforce($request->user, 'sales.challenges.view');
            $challenge = SalesChallenge::findRaw($entityId);
            if (!$challenge) {
                Response::error('Challenge not found', 404);
            }
            $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
            if (!SalesPermissions::has($request->user, 'sales.challenges.manage')
                && !SalesChallenge::isOfferedTo($entityId, $userId)) {
                Response::error('Challenge not found', 404);
            }
            return [$entityType, $entityId, ['challenge_id' => $entityId]];
        }

        $leadId = $entityType === 'lead' ? $entityId : $this->leadIdFor($entityType, $entityId);
        $lead   = $leadId > 0 ? SalesLead::findRaw($leadId) : null;
        if (!$lead) {
            Response::error(ucfirst($this->entityLabel($entityType)) . ' not found', 404);
        }
        SalesPermissions::assertLeadAccess($request->user, $lead);

        return [$entityType, $entityId, ['lead_id' => $leadId]];
    }

    private function leadIdFor(string $entityType, int $entityId): int
    {
        $tables = [
            'call'     => 'sales_calls',
            'followup' => 'sales_followups',
            'meeting'  => 'sales_meetings',
        ];
        if (!isset($tables[$entityType])) {
            return 0;
        }
        $table = $tables[$entityType];
        $row   = Database::fetch(
            "SELECT lead_id FROM $table WHERE id = ? AND tenant_id = ? LIMIT 1",
            [$entityId, Database::tenantId()]
        );
        return $row ? (int)$row['lead_id'] : 0;
    }

    /**
     * Loads a comment the user is allowed to act on. Editing is the author's
     * alone; deleting and restoring are also open to a sales administrator, who
     * has to be able to clear something posted in the wrong place.
     */
    private function findActionable(Request $request, int $id, bool $allowAdmin, bool $includeDeleted = false): array
    {
        $row = SalesComment::findRaw($id);
        if (!$row || (!$includeDeleted && $row['deleted_at'] !== null)) {
            Response::error('Comment not found', 404);
        }

        // Re-check access to the record it hangs off — permissions may have
        // changed since the comment was written.
        $this->resolveEntity($request, (string)$row['entity_type'], (int)$row['entity_id']);

        $userId  = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        $isOwn   = $userId > 0 && (int)($row['author_id'] ?? 0) === $userId;
        $isAdmin = $allowAdmin && SalesPermissions::isAdmin($request->user);

        if (!$isOwn && !$isAdmin) {
            Response::error(
                $allowAdmin ? 'You can only delete your own comments' : 'You can only edit your own comments',
                403
            );
        }
        return $row;
    }

    private function entityLabel(string $entityType): string
    {
        $labels = [
            'lead'      => 'lead',
            'call'      => 'call',
            'followup'  => 'follow-up',
            'meeting'   => 'meeting',
            'challenge' => 'challenge',
        ];
        return $labels[$entityType] ?? 'record';
    }
}
