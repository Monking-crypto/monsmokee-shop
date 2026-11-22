<?php
declare(strict_types=1);

/**
 * Đọc cấu hình cục bộ từ backend/.env.
 * Giá trị trong .env không được đưa vào mã nguồn hoặc Git.
 */
final class Env
{
    private static ?array $values = null;

    public static function load(string $path): array
    {
        if (self::$values !== null) {
            return self::$values;
        }

        if (!is_file($path)) {
            throw new RuntimeException('Không tìm thấy file backend/.env.');
        }

        $loaded = parse_ini_file($path, false, INI_SCANNER_RAW);
        if ($loaded === false) {
            throw new RuntimeException('Không thể đọc file backend/.env.');
        }

        self::$values = $loaded;
        return self::$values;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        if (self::$values === null) {
            throw new RuntimeException('Env chưa được nạp.');
        }
        return self::$values[$key] ?? $default;
    }
}
