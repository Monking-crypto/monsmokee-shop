<?php
declare(strict_types=1);

/**
 * Kết nối PDO dùng chung cho toàn bộ backend.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(array $config): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $config['host'],
            $config['port'],
            $config['name']
        );

        self::$pdo = new PDO($dsn, $config['user'], $config['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        return self::$pdo;
    }

    public static function transaction(callable $callback): mixed
    {
        if (!self::$pdo instanceof PDO) {
            throw new RuntimeException('CSDL chưa được kết nối.');
        }

        self::$pdo->beginTransaction();
        try {
            $result = $callback(self::$pdo);
            self::$pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if (self::$pdo->inTransaction()) {
                self::$pdo->rollBack();
            }
            throw $error;
        }
    }
}
