<?php
declare(strict_types=1);

class KnowledgeBase
{
    /**
     * Full-text search — returns top $limit relevant chunks for a query.
     */
    public static function search(string $query, int $limit = 5): array
    {
        $query = trim($query);
        if ($query === '') return [];

        // FULLTEXT natural language search with relevance score
        $rows = Database::fetchAll(
            "SELECT id, title, content, category, tags,
                    MATCH(title, content, tags) AGAINST(? IN NATURAL LANGUAGE MODE) AS score
             FROM chat_knowledge_base
             WHERE is_active = 1
               AND tenant_id = ?
               AND MATCH(title, content, tags) AGAINST(? IN NATURAL LANGUAGE MODE)
             ORDER BY score DESC
             LIMIT ?",
            [$query, Database::tenantId(), $query, $limit]
        );

        // Fallback: LIKE search if FULLTEXT returns nothing (e.g. single short word)
        if (empty($rows)) {
            $like = '%' . $query . '%';
            $rows = Database::fetchAll(
                "SELECT id, title, content, category, tags, 0 AS score
                 FROM chat_knowledge_base
                 WHERE is_active = 1
                   AND tenant_id = ?
                   AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
                 LIMIT ?",
                [Database::tenantId(), $like, $like, $like, $limit]
            );
        }

        return $rows;
    }

    public static function getAll(int $page = 1, int $perPage = 20, string $category = ''): array
    {
        $offset = ($page - 1) * $perPage;
        $where  = $category ? "WHERE tenant_id = ? AND category = ?" : "WHERE tenant_id = ?";
        $params = $category
            ? [Database::tenantId(), $category, $perPage, $offset]
            : [Database::tenantId(), $perPage, $offset];

        $rows  = Database::fetchAll(
            "SELECT id, title, content, category, tags, is_active, created_at, updated_at
             FROM chat_knowledge_base $where
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
            $params
        );
        $total = (int) Database::fetch(
            "SELECT COUNT(*) AS cnt FROM chat_knowledge_base " . ($category ? "WHERE tenant_id = ? AND category = ?" : "WHERE tenant_id = ?"),
            $category ? [Database::tenantId(), $category] : [Database::tenantId()]
        )['cnt'];

        return compact('rows', 'total');
    }

    public static function getById(int $id): ?array
    {
        return Database::fetch(
            "SELECT * FROM chat_knowledge_base WHERE id = ? AND tenant_id = ?", [$id, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('chat_knowledge_base', [
            'title'      => $data['title'],
            'content'    => $data['content'],
            'category'   => $data['category'] ?? 'general',
            'tags'       => $data['tags']     ?? '',
            'is_active'  => isset($data['is_active']) ? (int)$data['is_active'] : 1,
            'created_by' => $data['created_by'] ?? null,
        ]);
    }

    public static function update(int $id, array $data): bool
    {
        $fields = [];
        $params = [];
        foreach (['title','content','category','tags','is_active'] as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "$f = ?";
                $params[] = $f === 'is_active' ? (int)$data[$f] : $data[$f];
            }
        }
        if (!$fields) return false;
        $params[] = $id;
        $params[] = Database::tenantId();
        return Database::execute(
            "UPDATE chat_knowledge_base SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?",
            $params
        ) > 0;
    }

    public static function delete(int $id): bool
    {
        return Database::execute("DELETE FROM chat_knowledge_base WHERE id = ? AND tenant_id = ?", [$id, Database::tenantId()]) > 0;
    }

    public static function categories(): array
    {
        return array_column(
            Database::fetchAll("SELECT DISTINCT category FROM chat_knowledge_base WHERE is_active = 1 AND tenant_id = ? ORDER BY category", [Database::tenantId()]),
            'category'
        );
    }
}
