<?php
declare(strict_types=1);

/**
 * SalesLockout — the consequence side of "Challenge Accepted".
 *
 * Accepting a challenge and then missing the deadline destroys the salesperson
 * access to the sales app. They can still sign in — they have to, to be told
 * what happened — but every sales endpoint refuses them until an administrator
 * restores them from the desktop.
 *
 * Two rules this class enforces on itself, because getting them wrong locks a
 * business out of its own tools:
 *
 *   1. A sales administrator (owner) is never locked out. Whoever lifts a
 *      lockout must always be able to reach the screen that lifts it.
 *   2. Lifting a lockout is an update, never a delete. The record of what
 *      happened outlives the punishment.
 */
class SalesLockout
{
    /** The active lockout for a user, or null. */
    public static function active(int $userId): ?array
    {
        if ($userId < 1) {
            return null;
        }
        return Database::fetch(
            'SELECT l.*, c.title AS challenge_title, c.challenge_code, c.deadline
               FROM sales_lockouts l
               LEFT JOIN sales_challenges c ON c.id = l.challenge_id AND c.tenant_id = l.tenant_id
              WHERE l.tenant_id = ? AND l.user_id = ? AND l.cleared_at IS NULL
              ORDER BY l.id DESC LIMIT 1',
            [Database::tenantId(), $userId]
        );
    }

    public static function isLocked(int $userId): bool
    {
        return self::active($userId) !== null;
    }

    /**
     * Locks a user out for missing a challenge deadline. Returns false when the
     * lockout was refused (an admin, or already locked) so the caller can tell
     * the difference between "done" and "deliberately not done".
     */
    public static function lock(int $userId, int $challengeId, string $reason): bool
    {
        if ($userId < 1 || self::isLocked($userId)) {
            return false;
        }

        // Rule 1: never lock out someone who would then be unable to unlock
        // anyone — including themselves.
        $user = Database::fetch(
            'SELECT user_id, user_type, staff_role FROM users WHERE user_id = ? LIMIT 1',
            [$userId]
        );
        if (!$user || SalesPermissions::isAdmin($user)) {
            return false;
        }

        Database::insert('sales_lockouts', [
            'tenant_id'    => Database::tenantId(),
            'user_id'      => $userId,
            'challenge_id' => $challengeId > 0 ? $challengeId : null,
            'reason'       => mb_substr($reason, 0, 255),
        ]);
        return true;
    }

    /** Restores access. The row stays, marked with who lifted it and when. */
    public static function clear(int $userId, ?int $byUserId): bool
    {
        return Database::execute(
            'UPDATE sales_lockouts SET cleared_at = NOW(), cleared_by = ?
              WHERE tenant_id = ? AND user_id = ? AND cleared_at IS NULL',
            [$byUserId, Database::tenantId(), $userId]
        ) > 0;
    }

    /** Every currently locked-out user, for the admin screen. */
    public static function allActive(): array
    {
        $rows = Database::fetchAll(
            'SELECT l.*, u.name AS user_name, u.email, c.title AS challenge_title
               FROM sales_lockouts l
               LEFT JOIN users u ON u.user_id = l.user_id
               LEFT JOIN sales_challenges c ON c.id = l.challenge_id AND c.tenant_id = l.tenant_id
              WHERE l.tenant_id = ? AND l.cleared_at IS NULL
              ORDER BY l.locked_at DESC',
            [Database::tenantId()]
        );
        return array_map([self::class, 'format'], $rows);
    }

    public static function format(array $row): array
    {
        return [
            'id'              => (int)$row['id'],
            'user_id'         => (int)$row['user_id'],
            'user_name'       => $row['user_name'] ?? null,
            'email'           => $row['email'] ?? null,
            'challenge_id'    => $row['challenge_id'] !== null ? (int)$row['challenge_id'] : null,
            'challenge_title' => $row['challenge_title'] ?? null,
            'challenge_code'  => $row['challenge_code'] ?? null,
            'deadline'        => $row['deadline'] ?? null,
            'reason'          => $row['reason'],
            'locked_at'       => $row['locked_at'],
        ];
    }
}
