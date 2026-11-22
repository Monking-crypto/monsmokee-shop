<?php
declare(strict_types=1);

$backendRoot = dirname(__DIR__);
$autoload = $backendRoot . '/vendor/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "Composer dependencies are missing; run composer install in backend/.\n");
    exit(1);
}

require_once $autoload;
require_once $backendRoot . '/core/Env.php';

$recipient = $argv[1] ?? '';
if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage: php backend/scripts/test_email.php recipient@example.com\n");
    exit(2);
}

$config = require $backendRoot . '/config/mail.php';
if ($config['driver'] !== 'smtp') {
    fwrite(STDERR, "Set MAIL_DRIVER=smtp in backend/.env before testing email.\n");
    exit(2);
}

$smtp = $config['smtp'];
$mailer = new PHPMailer\PHPMailer\PHPMailer(true);
$mailer->isSMTP();
$mailer->Host = $smtp['host'];
$mailer->Port = $smtp['port'];
$mailer->SMTPAuth = true;
$mailer->Username = $smtp['user'];
$mailer->Password = $smtp['pass'];
$mailer->SMTPSecure = match ($smtp['encryption']) {
    'tls' => PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS,
    'ssl' => PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS,
    default => throw new RuntimeException('MAIL_ENCRYPTION phải là tls hoặc ssl.'),
};
$mailer->CharSet = 'UTF-8';
$mailer->setFrom($smtp['from'], $smtp['from_name']);
$mailer->addAddress($recipient);
$mailer->Subject = 'MON SMOKEE - SMTP test';
$mailer->Body = 'This is a test email confirming the SMTP configuration.';
$mailer->AltBody = $mailer->Body;
$mailer->send();

fwrite(STDOUT, "Test email sent successfully.\n");
