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

        $lifetime = max(0, (int) ($config['lifetime_seconds'] ?? 7200));
        $customerIdleTimeout = max(1, (int) ($config['idle_timeout_seconds'] ?? 7200));
        $adminIdleTimeout = max(1, (int) ($config['admin_idle_timeout_seconds'] ?? 1800));
        session_name((string) ($config['name'] ?? 'MONSMOKEESID'));
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => '/',
            'domain' => '',
            'secure' => (bool) ($config['secure'] ?? false),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set(
            'session.gc_maxlifetime',
            (string) max($customerIdleTimeout, $adminIdleTimeout)
        );
        session_start();

        $now = time();
        if (!isset($_SESSION['created_at'])) {
            $_SESSION['created_at'] = $now;
        }
        $isVerifiedAdmin = ($_SESSION['user_role'] ?? null) === 'Admin'
            && ($_SESSION['admin_otp_verified'] ?? false) === true;
        $idleTimeout = $isVerifiedAdmin ? $adminIdleTimeout : $customerIdleTimeout;
        $lastActivity = (int) ($_SESSION['last_activity'] ?? $_SESSION['created_at']);
        $lifetimeExpired = $lifetime > 0 && $now - (int) $_SESSION['created_at'] >= $lifetime;
        $idleExpired = $now - $lastActivity >= $idleTimeout;
        if ($lifetimeExpired || $idleExpired) {
            session_unset();
            session_regenerate_id(true);
            $_SESSION['created_at'] = $now;
        }
        $_SESSION['last_activity'] = $now;
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
