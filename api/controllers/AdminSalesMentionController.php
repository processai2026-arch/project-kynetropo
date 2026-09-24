<?php
declare(strict_types=1);

/**
 * Sales Mentions Controller — "someone was talking to me".
 *
 *   GET  /admin/sales/mentions       — the times I was @mentioned
 *   POST /admin/sales/mentions/read  — mark them seen
 *
 * A mention was already recorded whenever somebody named you in a comment, but
 * there was nowhere to see them: unless you happened to reopen the exact
 * record, a question addressed to you by name went unanswered. This is the
 * inbox for those.
 *
 * Scoped to the caller by construction — the query takes the user id from the
 * token, never from the request — so there is no way to read somebody else's
 * mentions. That is also why view-as does not apply here: being able to look at
 * a colleague's work is not the same as reading their post.
 */
class AdminSalesMentionController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.view');

        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ($userId < 1) {
            Response::success(['items' => [], 'unread' => 0]);
        }

        $limit      = min(100, max(1, (int)$request->query('limit', 50)));
        $unreadOnly = (string)$request->query('unread', '') === '1';

        Response::success([
            'items'  => SalesComment::mentionsOf($userId, $limit, $unreadOnly),
            'unread' => SalesComment::unreadMentionCount($userId),
        ]);
    }

    /**
     * Marks mentions read — a specific set, or everything.
     *
     * Idempotent, and reading is not the same as acting: the mention stays in
     * the list once read, it just stops counting towards the badge.
     */
    public function read(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.comments.view');
        SalesViewAs::assertNotWriting();

        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ($userId < 1) {
            Response::error('Not signed in', 401);
        }

        $raw = $request->input('comment_ids');
        $ids = null;
        if (is_array($raw)) {
            $ids = array_values(array_filter(array_map('intval', $raw), static fn(int $i): bool => $i > 0));
        }

        SalesComment::markMentionsRead($userId, $ids);

        Response::success(['unread' => SalesComment::unreadMentionCount($userId)], 'Marked as read');
    }
}
