<?php
declare(strict_types=1);

namespace App\Middleware;

use Request;
use Response;
use Session;

final class AdminMiddleware
{
    public static function handle(Request $request): bool
    {
        if (!AuthMiddleware::isAuthenticated()) {
            Response::error('Vui lòng đăng nhập để tiếp tục', 401);
            return false;
        }

        if (
            Session::get('user_role') !== 'Admin'
            || Session::get('admin_otp_verified') !== true
        ) {
            Response::error('Bạn không có quyền truy cập chức năng này', 403);
            return false;
        }

        return true;
    }
}
