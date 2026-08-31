<?php
declare(strict_types=1);

/**
 * CustomerMiddleware — ensures the authenticated user has user_type = 'customer'.
 */
class CustomerMiddleware
{
    public static function handle(Request $request): void
    {
        if (($request->user['user_type'] ?? '') !== 'customer') {
            Response::error('Customer access required', 403);
        }
    }
}
