<?php
declare(strict_types=1);

/**
 * Quản lý phiên PHP an toàn và trạng thái đăng nhập.
 */
final class Session
{
    public static function start(array $config): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        session_name((string) ($config['name'] ?? 'MONSMOKEESID'));
        session_set_cookie_params([
            'lifetime' => 2 * 60 * 60,
            'path' => '/',
            'domain' => '',
            'secure' => $config['secure'] ?? false,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.gc_maxlifetime', '7200');
        session_start();

        $now = time();
        if (!isset($_SESSION['created_at'])) {
            $_SESSION['created_at'] = $now;
        }
        if ($now - (int) $_SESSION['created_at'] > 2 * 60 * 60) {
            session_unset();
            $_SESSION['created_at'] = $now;
        }
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function regenerate(): void
    {
        session_regenerate_id(true);
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                ['expires' => time() - 42000, 'path' => $params['path'], 'domain' => $params['domain'],
                 'secure' => $params['secure'], 'httponly' => $params['httponly'], 'samesite' => 'Lax']
            );
        }
        session_destroy();
    }
}
