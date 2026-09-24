<?php
declare(strict_types=1);

/**
 * ChatMessage — a single message inside a ChatConversation. Tenant scoped.
 * (Distinct from the legacy public-site `chat_messages` table used by the
 * website widget; this assistant stores rows in `chat_conversation_messages`.)
 */
class ChatMessage
{
    public const ROLE_USER      = 'user';
    public const ROLE_ASSISTANT = 'assistant';

    /** Append a message to a conversation and bump the conversation timestamp. */
    public static function add(int $conversationId, string $role, string $content): int
    {
        $role = ($role === self::ROLE_ASSISTANT) ? self::ROLE_ASSISTANT : self::ROLE_USER;
        $id = Database::insertTenant('chat_conversation_messages', [
            'conversation_id' => $conversationId,
            'role'            => $role,
            'content'         => $content,
        ]);
        ChatConversation::touch($conversationId);
        return $id;
    }

    /** All messages in a conversation, oldest first. */
    public static function forConversation(int $conversationId): array
    {
        return Database::fetchAll(
            'SELECT role, content, created_at
             FROM chat_conversation_messages
             WHERE conversation_id = ? AND tenant_id = ?
             ORDER BY message_id ASC',
            [$conversationId, Database::tenantId()]
        );
    }

    /**
     * The most recent N messages (oldest first) for feeding the LLM as history.
     */
    public static function recent(int $conversationId, int $limit = 8): array
    {
        $limit = max(1, min(30, $limit));
        $rows  = Database::fetchAll(
            'SELECT role, content
             FROM chat_conversation_messages
             WHERE conversation_id = ? AND tenant_id = ?
             ORDER BY message_id DESC
             LIMIT ' . $limit,
            [$conversationId, Database::tenantId()]
        );
        return array_reverse($rows);
    }
}
