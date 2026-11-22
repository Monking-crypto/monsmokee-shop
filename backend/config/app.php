<?php
declare(strict_types=1);

$env = Env::load(__DIR__ . '/../.env');

$appUrl = rtrim((string) ($env['APP_URL'] ?? 'http://localhost/monsmokee'), '/');

return [
    'env' => (string) ($env['APP_ENV'] ?? 'development'),
    'url' => $appUrl,
    'debug' => filter_var($env['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN),
    'timezone' => (string) ($env['TIMEZONE'] ?? 'Asia/Ho_Chi_Minh'),
    'session' => [
        'name' => (string) ($env['SESSION_NAME'] ?? 'MONSMOKEESID'),
        'secure' => str_starts_with($appUrl, 'https://'),
    ],
];
