<?php
declare(strict_types=1);

$env = Env::load(__DIR__ . '/../.env');
$adminOtpExtraEmails = [];
$configuredAdminOtpExtraEmails = trim((string) ($env['ADMIN_OTP_EXTRA_EMAILS'] ?? ''));
if ($configuredAdminOtpExtraEmails !== '') {
    $recipients = array_values(array_unique(array_filter(
        array_map(
            static fn(string $recipient): string => strtolower(trim($recipient)),
            explode(',', $configuredAdminOtpExtraEmails)
        ),
        static fn(string $recipient): bool => $recipient !== ''
    )));
    if (count($recipients) > 2) {
        throw new RuntimeException('ADMIN_OTP_EXTRA_EMAILS nhận tối đa hai địa chỉ email.');
    }
    foreach ($recipients as $recipient) {
        if (filter_var($recipient, FILTER_VALIDATE_EMAIL) === false) {
            throw new RuntimeException('ADMIN_OTP_EXTRA_EMAILS chứa địa chỉ email không hợp lệ.');
        }
        $adminOtpExtraEmails[] = $recipient;
    }
}

return [
    'driver' => strtolower((string) ($env['MAIL_DRIVER'] ?? 'log')),
    'admin_otp_extra_emails' => $adminOtpExtraEmails,
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
