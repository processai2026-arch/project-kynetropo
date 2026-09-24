<?php
declare(strict_types=1);

/**
 * Notifier — tells people about work, wherever they are.
 *
 * One entry point, so every place in the app that needs to reach a person does
 * it the same way and nothing has to remember the delivery details. Today that
 * means a Web Push notification to each of their devices.
 *
 * Three rules hold everywhere:
 *
 *   Never notify yourself. Assigning yourself a task or commenting on your own
 *   thread is not news, and a phone that buzzes at its owner for their own
 *   typing is one people turn notifications off on.
 *
 *   Never let delivery break the work. Every failure is swallowed: somebody
 *   completing a task must not see an error because a push service was down.
 *
 *   Always carry a url. A notification you cannot act on from the lock screen
 *   is a notification that makes someone go and look for the thing themselves.
 */
final class Notifier
{
    /**
     * @param int[]  $userIds who to tell; the actor is removed automatically
     * @param string $url     where tapping it should land, e.g. /sales/tasks?task=8
     */
    public static function push(array $userIds, string $title, string $body, string $url, ?int $actorId = null, string $tag = ''): void
    {
        if (!WebPush::configured()) {
            return;
        }

        $targets = array_values(array_unique(array_filter(
            array_map('intval', $userIds),
            static fn(int $id): bool => $id > 0 && $id !== (int)$actorId
        )));
        if (!$targets) {
            return;
        }

        $payload = [
            'title' => mb_substr($title, 0, 120),
            'body'  => mb_substr($body, 0, 300),
            'url'   => $url,
            // Collapses repeats in the tray: three comments on one task replace
            // each other rather than stacking into a wall the person scrolls past.
            'tag'   => $tag !== '' ? $tag : $url,
        ];

        foreach (PushSubscription::forUsers($targets) as $sub) {
            try {
                $result = WebPush::send($sub, $payload);
                if ($result['ok']) {
                    PushSubscription::noteSuccess((int)$sub['id']);
                } else {
                    PushSubscription::noteFailure((int)$sub['id'], (bool)$result['gone']);
                }
            } catch (Throwable $e) {
                // Deliberately silent. The alternative is a 500 on an action
                // that actually succeeded.
            }
        }
    }

    /** Trims a comment down to something that reads on a lock screen. */
    public static function excerpt(string $body, int $limit = 140): string
    {
        $flat = trim(preg_replace('/\s+/u', ' ', $body) ?? '');
        return mb_strlen($flat) > $limit ? mb_substr($flat, 0, $limit - 1) . '…' : $flat;
    }
}
