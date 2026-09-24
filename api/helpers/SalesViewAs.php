<?php
declare(strict_types=1);

/**
 * SalesViewAs — looking over a colleague's shoulder, without touching anything.
 *
 * The sales module is deliberately open: the team can see each other's leads,
 * follow-ups, meetings, tasks and numbers. What it lacked was a way to see any
 * ONE person's work as a whole — a manager could see every lead at once, which
 * answers a different question from "what is Naresh actually working on?".
 *
 * Passing `?view_as=<user_id>` on a GET narrows the whole module to that
 * person's records: their dashboard totals, their pipeline, their diary, their
 * tasks, their challenges.
 *
 * Two rules make this safe, and both are enforced here rather than trusted to
 * the UI:
 *
 *   1. It only ever applies to a GET. A write is always performed as yourself,
 *      so a viewing session can never become a way to act as somebody else —
 *      not through a crafted request, and not through a bug in the client.
 *   2. A write that arrives still carrying the parameter is refused outright,
 *      rather than quietly executed as the real user. A confused client should
 *      hear about it, not have its mistake papered over.
 *
 * What it is NOT: a permission grant. It cannot show a caller anything they
 * were not already entitled to see — it only ever narrows the result set.
 */
final class SalesViewAs
{
    private static bool $resolved = false;
    private static ?array $target = null;

    /**
     * The colleague being viewed, as ['user_id' => int, 'name' => string], or
     * null when the caller is looking at their own work.
     *
     * Resolved once per request: the scope helper is called by nearly every
     * read in the module, and this must not become a query per call.
     */
    public static function current(): ?array
    {
        if (!self::$resolved) {
            self::$resolved = true;
            self::$target   = self::lookUp();
        }
        return self::$target;
    }

    public static function userId(): ?int
    {
        $target = self::current();
        return $target === null ? null : (int)$target['user_id'];
    }

    /** True when this request is a read-only look at somebody else's work. */
    public static function active(): bool
    {
        return self::current() !== null;
    }

    /**
     * The user id whose work the caller is looking at — the colleague being
     * viewed, or the caller themselves.
     */
    public static function subjectId(?array $realUser): int
    {
        $target = self::userId();
        if ($target !== null) {
            return $target;
        }
        return isset($realUser['user_id']) ? (int)$realUser['user_id'] : 0;
    }

    /**
     * Refuses a write that carries the viewing parameter.
     *
     * Called from SalesPermissions::enforce(), which every sales action passes
     * through, so one check covers the module. 409 rather than 403: the caller
     * is not forbidden from doing this, they are in the wrong mode for it.
     */
    public static function assertNotWriting(): void
    {
        if (self::isRead()) {
            return;
        }
        if (($_GET['view_as'] ?? '') !== '') {
            Response::error(
                'You are looking at a colleague\'s work. Switch back to your own view to make changes.',
                409
            );
        }
    }

    /** Clears the memoised lookup. Tests run several requests in one process. */
    public static function reset(): void
    {
        self::$resolved = false;
        self::$target   = null;
    }

    private static function isRead(): bool
    {
        $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        return $method === 'GET' || $method === 'HEAD';
    }

    private static function lookUp(): ?array
    {
        if (!self::isRead()) {
            return null;
        }

        $id = (int)($_GET['view_as'] ?? 0);
        if ($id < 1) {
            return null;
        }

        // An unknown or deactivated id is treated as "no selection" rather than
        // an error: a stale tab holding a colleague who has since left should
        // fall back to your own view, not break every screen it is on.
        try {
            $row = Database::fetch(
                "SELECT user_id, name FROM users
                  WHERE user_id = ? AND tenant_id = ? AND user_type = 'admin' AND is_active = 1
                  LIMIT 1",
                [$id, Database::tenantId()]
            );
        } catch (Throwable $e) {
            error_log('[SalesViewAs] lookup failed: ' . $e->getMessage());
            return null;
        }

        if (!$row) {
            return null;
        }

        return ['user_id' => (int)$row['user_id'], 'name' => (string)$row['name']];
    }
}
