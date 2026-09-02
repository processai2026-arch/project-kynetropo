<?php
declare(strict_types=1);

/**
 * Push Controller — the browser registering itself for notifications.
 *
 *   GET  /admin/push/key         — the VAPID public key the browser subscribes with
 *   POST /admin/push/subscribe   — store this device
 *   POST /admin/push/unsubscribe — forget it
 *   POST /admin/push/test        — send one to yourself, to prove it works
 *
 * A subscription belongs to whoever was signed in when it was made, so the
 * endpoint is re-registered on every sign-in: a shared device must not keep
 * delivering one person's notifications to the next person to use it.
 */
class AdminPushController
{
    /** The public half is not a secret — the browser needs it to subscribe. */
    public function key(Request $request): void
    {
        Response::success([
            'enabled'    => WebPush::configured(),
            'public_key' => WebPush::publicKey(),
        ]);
    }

    public function subscribe(Request $request): void
    {
        SalesViewAs::assertNotWriting();

        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ($userId < 1) {
            Response::error('Not signed in', 401);
        }
        if (!WebPush::configured()) {
            Response::error('Push notifications are not configured on this server', 503);
        }

        $endpoint = trim((string)$request->input('endpoint', ''));
        $p256dh   = trim((string)$request->input('p256dh', ''));
        $auth     = trim((string)$request->input('auth', ''));

        // The endpoint is a URL the server will later POST to. Refusing anything
        // that is not https keeps this from being turned into a request forger.
        if ($endpoint === '' || !preg_match('#^https://[^\s]+$#', $endpoint) || mb_strlen($endpoint) > 500) {
            Response::error('That does not look like a push endpoint', 422);
        }
        if (strlen(WebPush::b64uDecode($p256dh)) !== 65 || strlen(WebPush::b64uDecode($auth)) !== 16) {
            Response::error('The subscription keys are not the right shape', 422);
        }

        PushSubscription::store(
            $userId,
            $endpoint,
            $p256dh,
            $auth,
            (string)($_SERVER['HTTP_USER_AGENT'] ?? '')
        );

        Response::success(['devices' => PushSubscription::countFor($userId)], 'Notifications are on');
    }

    public function unsubscribe(Request $request): void
    {
        SalesViewAs::assertNotWriting();

        $endpoint = trim((string)$request->input('endpoint', ''));
        if ($endpoint !== '') {
            PushSubscription::forget($endpoint);
        }

        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        Response::success(['devices' => $userId > 0 ? PushSubscription::countFor($userId) : 0], 'Notifications are off');
    }

    /**
     * Sends one to the caller.
     *
     * Worth having: everything between pressing Enable and a notification
     * actually arriving is invisible — permission, the service worker, the
     * subscription, the keys, the push service. This proves the whole chain in
     * one tap instead of waiting for real work to happen.
     */
    public function test(Request $request): void
    {
        SalesViewAs::assertNotWriting();

        $userId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ($userId < 1) {
            Response::error('Not signed in', 401);
        }
        if (!WebPush::configured()) {
            Response::error('Push notifications are not configured on this server', 503);
        }

        $subs = PushSubscription::forUsers([$userId]);
        if (!$subs) {
            Response::error('This device is not registered for notifications yet', 409);
        }

        $sent = 0;
        $last = '';
        foreach ($subs as $sub) {
            $result = WebPush::send($sub, [
                'title' => 'Kynetropo',
                'body'  => 'Notifications are working. This is what one looks like.',
                'url'   => '/sales',
                'tag'   => 'push-test',
            ]);
            if ($result['ok']) {
                $sent++;
                PushSubscription::noteSuccess((int)$sub['id']);
            } else {
                $last = $result['error'] !== '' ? $result['error'] : ('HTTP ' . $result['status']);
                PushSubscription::noteFailure((int)$sub['id'], (bool)$result['gone']);
            }
        }

        if ($sent === 0) {
            Response::error('Could not deliver to any of your devices' . ($last !== '' ? ': ' . $last : ''), 502);
        }

        Response::success(['sent' => $sent], 'Sent to ' . $sent . ' ' . ($sent === 1 ? 'device' : 'devices'));
    }
}
