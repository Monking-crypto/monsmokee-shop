<?php
declare(strict_types=1);

$env = Env::load(__DIR__ . '/../.env');

return [
    'driver' => strtolower((string) ($env['MAIL_DRIVER'] ?? 'log')),
    'smtp' => [
        'host' => (string) ($env['SMTP_HOST'] ?? 'smtp.gmail.com'),
        'port' => (int) ($env['SMTP_PORT'] ?? 587),
        'user' => (string) ($env['SMTP_USER'] ?? ''),
        'pass' => (string) ($env['SMTP_PASS'] ?? ''),
        'from' => (string) ($env['SMTP_FROM'] ?? 'admin@monsmokee.local'),
        'from_name' => (string) ($env['SMTP_FROM_NAME'] ?? 'MON SMOKEE'),
    ],
];
