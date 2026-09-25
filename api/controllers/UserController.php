<?php
declare(strict_types=1);

/**
 * PUT /users/{id}/password — Change a user's own password (or admin for any user).
 */
class UserController
{
    public function changePassword(Request $request): void
    {
        AuthMiddleware::handle($request);

        $actorId   = (int) ($request->user['user_id'] ?? 0);
        $rawId     = (string) $request->param('id');
        // The Settings page sends /users/me/password.
        $targetId  = $rawId === 'me' ? $actorId : (int) $rawId;
        $actorType = $request->user['user_type'] ?? '';

        // Only the account owner or an admin may change a password.
        if ($actorId !== $targetId && $actorType !== 'admin') {
            Response::error('Forbidden', 403);
        }

        $body           = $request->body();
        $currentPassword = trim((string) ($body['current_password'] ?? ''));
        $newPassword     = trim((string) ($body['new_password'] ?? ''));

        if ($currentPassword === '') Response::error('current_password is required', 422);
        if ($newPassword === '')     Response::error('new_password is required', 422);
        if (strlen($newPassword) < 6) Response::error('new_password must be at least 6 characters', 422);
        if (strlen($newPassword) > 72) Response::error('new_password is too long', 422);

        // Fetch full row including password_hash.
        $row = Database::fetch('SELECT user_id, password_hash FROM users WHERE user_id = ? LIMIT 1', [$targetId]);
        if (!$row) Response::error('User not found', 404);

        if (!User::verifyPassword($currentPassword, (string) $row['password_hash'])) {
            Response::error('Current password is incorrect', 422);
        }

        User::updatePassword($targetId, $newPassword);

        Response::success(null, 'Password changed successfully');
    }
}
