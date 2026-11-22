<?php
declare(strict_types=1);

/**
 * Trả JSON theo một envelope duy nhất.
 */
final class Response
{
    public static function json(
        bool $success,
        string $message,
        mixed $data = null,
        array|object|null $errors = null,
        int $status = 200
    ): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => $success,
            'message' => $message,
            'data' => $data,
            'errors' => $errors,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function success(string $message = 'Thành công', mixed $data = null, int $status = 200): void
    {
        self::json(true, $message, $data, null, $status);
    }

    public static function error(string $message, int $status = 400, array|object|null $errors = null): void
    {
        self::json(false, $message, null, $errors, $status);
    }

    public static function notImplemented(string $message = 'Tính năng đang được phát triển'): void
    {
        self::error($message, 501);
    }
}
