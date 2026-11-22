<?php
declare(strict_types=1);

$env = Env::load(__DIR__ . '/../.env');

return [
    'host' => (string) ($env['DB_HOST'] ?? '127.0.0.1'),
    'port' => (string) ($env['DB_PORT'] ?? '3306'),
    'name' => (string) ($env['DB_NAME'] ?? 'monsmokee'),
    'user' => (string) ($env['DB_USER'] ?? 'root'),
    'pass' => (string) ($env['DB_PASS'] ?? ''),
];
