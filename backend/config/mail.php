<?php
declare(strict_types=1);

$env = Env::load(__DIR__ . '/../.env');

return [
    'driver' => strtolower((string) ($env['MAIL_DRIVER'] ?? 'log')),
    'smtp' => [
        'host' => (string) ($env['MAIL_HOST'] ?? $env['SMTP_HOST'] ?? 'smtp.gmail.com'),
        'port' => (int) ($env['MAIL_PORT'] ?? $env['SMTP_PORT'] ?? 587),
        'encryption' => strtolower((string) ($env['MAIL_ENCRYPTION'] ?? 'tls')),
        'user' => (string) ($env['MAIL_USERNAME'] ?? $env['SMTP_USER'] ?? ''),
        'pass' => (string) ($env['MAIL_PASSWORD'] ?? $env['SMTP_PASS'] ?? ''),
        'from' => (string) ($env['MAIL_FROM'] ?? $env['SMTP_FROM'] ?? 'sender@example.invalid'),
        'from_name' => (string) ($env['MAIL_FROM_NAME'] ?? $env['SMTP_FROM_NAME'] ?? 'MON SMOKEE'),
    ],
];
