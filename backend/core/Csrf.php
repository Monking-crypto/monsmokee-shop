<?php
declare(strict_types=1);

/**
 * Tạo và xác thực token CSRF lưu trong phiên.
 */
final class Csrf
{
    private const SESSION_KEY = 'csrf_token';

    public static function token(): string
    {
        $token = Session::get(self::SESSION_KEY);
        if (!is_string($token) || $token === '') {
            $token = bin2hex(random_bytes(32));
            Session::set(self::SESSION_KEY, $token);
        }
        return $token;
    }

    public static function validate(?string $token): bool
    {
        $sessionToken = Session::get(self::SESSION_KEY);
        return is_string($sessionToken)
            && is_string($token)
            && hash_equals($sessionToken, $token);
    }
}
