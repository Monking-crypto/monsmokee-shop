<?php
declare(strict_types=1);

/**
 * Ghi log ứng dụng ra backend/storage/logs.
 */
final class Logger
{
    public static function write(string $fileName, string $message): void
    {
        $directory = dirname(__DIR__) . '/storage/logs';
        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }
        $safeName = preg_replace('/[^A-Za-z0-9_.-]/', '_', $fileName) ?: 'app.log';
        $line = '[' . date('Y-m-d H:i:s') . '] ' . trim($message) . PHP_EOL;
        file_put_contents($directory . '/' . $safeName, $line, FILE_APPEND | LOCK_EX);
    }

    public static function error(string $message): void
    {
        self::write('app.log', $message);
    }
}
