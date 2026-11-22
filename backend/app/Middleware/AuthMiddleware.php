<?php
declare(strict_types=1);

namespace App\Middleware;

use Request;
use Response;
use Session;

/**
 * Yêu cầu request có user_id và vai trò trong session.
 */
final class AuthMiddleware
{
    public static function isAuthenticated(): bool
    {
        $userId = Session::get('user_id');
        $role = Session::get('user_role');

        return is_numeric($userId)
            && (int) $userId > 0
            && is_string($role)
            && $role !== '';
    }

    public static function handle(Request $request): bool
    {
        if (self::isAuthenticated()) {
            return true;
        }

        Response::error('Vui lòng đăng nhập để tiếp tục', 401);
        return false;
    }
}
