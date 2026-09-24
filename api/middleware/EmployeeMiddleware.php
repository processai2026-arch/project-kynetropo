<?php
declare(strict_types=1);

/**
 * EmployeeMiddleware — ensures the authenticated user has user_type = 'employee'.
 */
class EmployeeMiddleware
{
    public static function handle(Request $request): void
    {
        if (($request->user['user_type'] ?? '') !== 'employee') {
            Response::error('Employee access required', 403);
        }
    }
}
