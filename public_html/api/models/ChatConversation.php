<?php
declare(strict_types=1);

/**
 * ChatConversation — tenant + user scoped conversation thread for the in-app
 * AI assistant. All reads/writes are scoped by Database::tenantId(); inserts go
 * through Database::insertTenant() so tenant_id can never be forgotten.
 */
class ChatConversation
{
    /** Create a new conversation and return its id. */
    public static function create(?int $userId, string $title = 'New conversation'): int
    {
        $title = trim($title);
        if ($title === '') {
            $title = 'New conversation';
        }
        return Database::insertTenant('chat_conversations', [
            'user_id' => $userId,
            'title'   => mb_substr($title, 0, 200),
        ]);
    }

    /** Fetch a single conversation owned by the current tenant (and user when given). */
    public static function find(int $conversationId, ?int $userId = null): ?array
    {
        $sql    = 'SELECT * FROM chat_conversations WHERE conversation_id = ? AND tenant_id = ?';
        $params = [$conversationId, Database::tenantId()];
        if ($userId !== null) {
            $sql      .= ' AND user_id = ?';
            $params[]  = $userId;
        }
        return Database::fetch($sql . ' LIMIT 1', $params);
    }

    /** List recent conversations for the current tenant + user. */
    public static function listForUser(?int $userId, int $limit = 20): array
    {
        $limit  = max(1, min(50, $limit));
        $sql    = 'SELECT conversation_id, title, created_at, updated_at
                   FROM chat_conversations
                   WHERE tenant_id = ?';
        $params = [Database::tenantId()];
        if ($userId !== null) {
            $sql      .= ' AND user_id = ?';
            $params[]  = $userId;
        }
        $sql .= ' ORDER BY updated_at DESC LIMIT ' . $limit;
        return Database::fetchAll($sql, $params);
    }

    /** Touch updated_at (called after a new message is appended). */
    public static function touch(int $conversationId): void
    {
        Database::execute(
            'UPDATE chat_conversations SET updated_at = NOW()
             WHERE conversation_id = ? AND tenant_id = ?',
            [$conversationId, Database::tenantId()]
        );
    }

    /** Set the conversation title (used to auto-name from the first message). */
    public static function rename(int $conversationId, string $title): void
    {
        $title = trim($title);
        if ($title === '') {
            return;
        }
        Database::execute(
            'UPDATE chat_conversations SET title = ?
             WHERE conversation_id = ? AND tenant_id = ?',
            [mb_substr($title, 0, 200), $conversationId, Database::tenantId()]
        );
    }
}
