<?php
declare(strict_types=1);

namespace App\Middleware;

use Request;
use Response;
use Session;

/**
 * Chỉ cho phép các vai trò được khai báo truy cập route.
 */
final class RoleMiddleware
{
    public static function handle(Request $request, string|array $allowedRoles): bool
    {
        if (!AuthMiddleware::isAuthenticated()) {
            Response::error('Vui lòng đăng nhập để tiếp tục', 401);
            return false;
        }

        $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
        $currentRole = Session::get('user_role');

        // Admin routes must use AdminMiddleware to require OTP verification.
        if (!is_string($currentRole) || !in_array($currentRole, $roles, true)) {
            Response::error('Bạn không có quyền truy cập chức năng này', 403);
            return false;
        }

        return true;
    }
}
