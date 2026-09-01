<?php
declare(strict_types=1);

/**
 * SalesComment — the discussion thread attached to a sales record.
 *
 * A call, follow-up, meeting, challenge or the lead itself can carry comments,
 * so a question about a deal lives on the record it is about instead of in a
 * chat nobody can find later.
 *
 * Comments are soft-deleted: a deleted one keeps its place in the thread as a
 * tombstone. An admin reviewing a deal should never find half a conversation
 * silently missing.
 */
class SalesComment
{
    public const ENTITY_TYPES = ['lead', 'call', 'followup', 'meeting', 'challenge', 'task'];

    public const MAX_LENGTH = 2000;

    /** Nobody needs to summon the whole company into one thread. */
    public const MAX_MENTIONS = 20;

    public static function create(array $data): int
    {
        return Database::insert('sales_comments', [
            'tenant_id'    => Database::tenantId(),
            'entity_type'  => $data['entity_type'],
            'entity_id'    => (int)$data['entity_id'],
            'lead_id'      => !empty($data['lead_id'])      ? (int)$data['lead_id']      : null,
            'challenge_id' => !empty($data['challenge_id']) ? (int)$data['challenge_id'] : null,
            'task_id'      => !empty($data['task_id'])      ? (int)$data['task_id']      : null,
            'body'         => mb_substr(trim((string)$data['body']), 0, self::MAX_LENGTH),
            'author_id'    => !empty($data['author_id']) ? (int)$data['author_id'] : null,
            'author_name'  => mb_substr((string)($data['author_name'] ?? ''), 0, 200),
        ]);
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_comments WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    /** One thread, oldest first — a conversation reads top to bottom. */
    public static function forEntity(string $entityType, int $entityId): array
    {
        $rows = Database::fetchAll(
            'SELECT c.*, u.name AS author_current_name
               FROM sales_comments c
               LEFT JOIN users u ON u.user_id = c.author_id
              WHERE c.tenant_id = ? AND c.entity_type = ? AND c.entity_id = ?
              ORDER BY c.created_at ASC, c.id ASC',
            [Database::tenantId(), $entityType, $entityId]
        );
        if (!$rows) {
            return [];
        }

        // One extra query for the whole thread rather than one per comment: a
        // long discussion should not cost a query per line to render.
        $mentions = self::mentionsFor(array_map(static fn(array $r): int => (int)$r['id'], $rows));

        return array_map(
            static fn(array $r): array => self::format($r, $mentions[(int)$r['id']] ?? []),
            $rows
        );
    }

    /**
     * Who was @mentioned, per comment id.
     *
     * Mentions are rows, not something re-parsed out of the body: the body is
     * free text the author can edit afterwards, and a person's name can change.
     * Neither should be able to rewrite who was actually notified.
     *
     * @param  int[] $commentIds
     * @return array<int, array<int, array{user_id:int,name:string}>>
     */
    public static function mentionsFor(array $commentIds): array
    {
        $ids = array_values(array_filter(array_map('intval', $commentIds), static fn(int $i): bool => $i > 0));
        if (!$ids) {
            return [];
        }
        $in   = implode(',', array_fill(0, count($ids), '?'));
        $rows = Database::fetchAll(
            "SELECT m.comment_id, m.user_id, COALESCE(u.name, m.user_name) AS name
               FROM sales_comment_mentions m
               LEFT JOIN users u ON u.user_id = m.user_id
              WHERE m.tenant_id = ? AND m.comment_id IN ($in)",
            [Database::tenantId(), ...$ids]
        );
        $out = [];
        foreach ($rows as $r) {
            $out[(int)$r['comment_id']][] = ['user_id' => (int)$r['user_id'], 'name' => (string)$r['name']];
        }
        return $out;
    }

    /**
     * Records who a comment mentions. Replaces the set, so editing a comment to
     * drop a name drops the mention with it.
     *
     * @param array<int, array{user_id:int,name:string}> $people
     */
    public static function setMentions(int $commentId, array $people): void
    {
        $tenantId = Database::tenantId();
        Database::execute(
            'DELETE FROM sales_comment_mentions WHERE tenant_id = ? AND comment_id = ?',
            [$tenantId, $commentId]
        );
        $seen = [];
        foreach (array_slice($people, 0, self::MAX_MENTIONS) as $person) {
            $userId = (int)($person['user_id'] ?? 0);
            if ($userId < 1 || isset($seen[$userId])) {
                continue;
            }
            $seen[$userId] = true;
            Database::execute(
                'INSERT IGNORE INTO sales_comment_mentions (tenant_id, comment_id, user_id, user_name)
                 VALUES (?, ?, ?, ?)',
                [$tenantId, $commentId, $userId, mb_substr((string)($person['name'] ?? ''), 0, 200)]
            );
        }
        Database::execute(
            'UPDATE sales_comments SET mention_count = ? WHERE id = ? AND tenant_id = ?',
            [count($seen), $commentId, $tenantId]
        );
    }

    /**
     * Every comment on a lead and on everything hanging off it, so the lead
     * screen can show a count per record without one query per row.
     *
     * @return array<string, array<int, int>> [entity_type => [entity_id => count]]
     */
    public static function countsForLead(int $leadId): array
    {
        $rows = Database::fetchAll(
            'SELECT entity_type, entity_id, COUNT(*) AS cnt
               FROM sales_comments
              WHERE tenant_id = ? AND lead_id = ? AND deleted_at IS NULL
              GROUP BY entity_type, entity_id',
            [Database::tenantId(), $leadId]
        );
        $out = [];
        foreach ($rows as $r) {
            $out[$r['entity_type']][(int)$r['entity_id']] = (int)$r['cnt'];
        }
        return $out;
    }

    public static function countForEntity(string $entityType, int $entityId): int
    {
        return Database::count(
            'SELECT COUNT(*) AS cnt FROM sales_comments
              WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? AND deleted_at IS NULL',
            [Database::tenantId(), $entityType, $entityId]
        );
    }

    public static function update(int $id, string $body): void
    {
        Database::execute(
            'UPDATE sales_comments SET body = ?, edited_at = NOW()
              WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
            [mb_substr(trim($body), 0, self::MAX_LENGTH), $id, Database::tenantId()]
        );
    }

    public static function softDelete(int $id, ?int $byUserId): void
    {
        Database::execute(
            'UPDATE sales_comments SET deleted_at = NOW(), deleted_by = ?
              WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
            [$byUserId, $id, Database::tenantId()]
        );
    }

    /** Undo a deletion — the same human-mistake escape hatch the rest of the module has. */
    public static function restore(int $id): void
    {
        Database::execute(
            'UPDATE sales_comments SET deleted_at = NULL, deleted_by = NULL
              WHERE id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
    }

    /**
     * The newest comments across the pipeline, for the team feed. Lead-scoped
     * users only see comments on their own leads; challenge comments are team
     * -wide and always included.
     */
    public static function recent(int $limit, array $leadScope, bool $includeChallenges = true): array
    {
        $limit  = max(1, min(200, $limit));
        $where  = 'c.tenant_id = ? AND c.deleted_at IS NULL';
        $params = [Database::tenantId()];

        if ($leadScope['sql'] !== '') {
            $userId  = $leadScope['params'][0];
            $where  .= $includeChallenges
                ? ' AND (l.assigned_to = ? OR c.challenge_id IS NOT NULL)'
                : ' AND l.assigned_to = ?';
            $params[] = $userId;
        }

        $rows = Database::fetchAll(
            "SELECT c.*, l.name AS lead_name, l.company AS lead_company, ch.title AS challenge_title
               FROM sales_comments c
               LEFT JOIN sales_leads l       ON l.id  = c.lead_id      AND l.tenant_id  = c.tenant_id
               LEFT JOIN sales_challenges ch ON ch.id = c.challenge_id AND ch.tenant_id = c.tenant_id
              WHERE $where
              ORDER BY c.created_at DESC, c.id DESC
              LIMIT $limit",
            $params
        );
        return array_map([self::class, 'format'], $rows);
    }

    public static function format(array $row, array $mentions = []): array
    {
        $deleted = $row['deleted_at'] !== null;
        return [
            'id'              => (int)$row['id'],
            'entity_type'     => $row['entity_type'],
            'entity_id'       => (int)$row['entity_id'],
            'lead_id'         => $row['lead_id']      !== null ? (int)$row['lead_id']      : null,
            'challenge_id'    => $row['challenge_id'] !== null ? (int)$row['challenge_id'] : null,
            'task_id'         => isset($row['task_id']) && $row['task_id'] !== null ? (int)$row['task_id'] : null,
            'lead_name'       => $row['lead_name']       ?? null,
            'lead_company'    => $row['lead_company']    ?? null,
            'challenge_title' => $row['challenge_title'] ?? null,
            // A deleted comment keeps its slot but never ships its text.
            'body'            => $deleted ? null : $row['body'],
            'author_id'       => $row['author_id'] !== null ? (int)$row['author_id'] : null,
            'author_name'     => $row['author_current_name'] ?? $row['author_name'],
            'created_at'      => $row['created_at'],
            'edited_at'       => $row['edited_at'],
            'deleted'         => $deleted,
            'deleted_at'      => $row['deleted_at'],
            // The names the client highlights in the body. Empty is the common
            // case and costs nothing.
            'mentions'        => $deleted ? [] : $mentions,
        ];
    }
}
