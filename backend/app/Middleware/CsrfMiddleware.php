<?php
declare(strict_types=1);

/**
 * Kiểm tra CSRF cho mọi POST/PUT/PATCH/DELETE.
 */
final class CsrfMiddleware
{
    public static function handle(Request $request): bool
    {
        if (!in_array($request->method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return true;
        }

        $token = $request->header('X-CSRF-Token');
        if (!is_string($token) || !Csrf::validate($token)) {
            Response::error('CSRF token không hợp lệ', 403, ['code' => 'CSRF_INVALID']);
            return false;
        }
        return true;
    }
}
