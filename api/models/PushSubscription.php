<?php
declare(strict_types=1);

/**
 * PushSubscription — one browser that has agreed to be told things.
 *
 * A person has as many rows as they have devices: the phone and the laptop are
 * separate subscriptions, and a notification goes to all of them. The endpoint
 * is the identity — the same browser re-subscribing produces the same endpoint,
 * so it is the natural unique key.
 *
 * Rows are disposable. A push service answering 404 or 410 means that browser
 * is gone for good, and the row is deleted rather than retried; nothing is lost
 * because the browser re-subscribes the next time the app is opened.
 */
class PushSubscription
{
    /** Stores or refreshes one browser's subscription. */
    public static function store(int $userId, string $endpoint, string $p256dh, string $auth, string $agent): void
    {
        Database::execute(
            'INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                 user_id      = VALUES(user_id),
                 p256dh       = VALUES(p256dh),
                 auth         = VALUES(auth),
                 user_agent   = VALUES(user_agent),
                 last_seen_at = NOW(),
                 failures     = 0',
            [Database::tenantId(), $userId, $endpoint, $p256dh, $auth, mb_substr($agent, 0, 255)]
        );
    }

    public static function forget(string $endpoint): void
    {
        Database::execute(
            'DELETE FROM push_subscriptions WHERE tenant_id = ? AND endpoint = ?',
            [Database::tenantId(), $endpoint]
        );
    }

    /** Every device belonging to these people. */
    public static function forUsers(array $userIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds), static fn(int $i): bool => $i > 0)));
        if (!$ids) {
            return [];
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        return Database::fetchAll(
            "SELECT id, user_id, endpoint, p256dh, auth
               FROM push_subscriptions
              WHERE tenant_id = ? AND user_id IN ($in)",
            [Database::tenantId(), ...$ids]
        );
    }

    public static function countFor(int $userId): int
    {
        return Database::count(
            'SELECT COUNT(*) AS cnt FROM push_subscriptions WHERE tenant_id = ? AND user_id = ?',
            [Database::tenantId(), $userId]
        );
    }

    /**
     * Records a delivery that did not work.
     *
     * A subscription the push service says is gone is removed at once. Anything
     * else is counted, and a device that has failed repeatedly is dropped too —
     * otherwise a permanently broken endpoint is retried on every notification
     * for the life of the account.
     */
    public static function noteFailure(int $id, bool $gone): void
    {
        if ($gone) {
            Database::execute('DELETE FROM push_subscriptions WHERE id = ?', [$id]);
            return;
        }
        Database::execute('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?', [$id]);
        Database::execute('DELETE FROM push_subscriptions WHERE id = ? AND failures >= 10', [$id]);
    }

    public static function noteSuccess(int $id): void
    {
        Database::execute(
            'UPDATE push_subscriptions SET failures = 0, last_sent_at = NOW() WHERE id = ?',
            [$id]
        );
    }
}
