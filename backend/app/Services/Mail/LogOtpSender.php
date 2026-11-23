<?php
declare(strict_types=1);

namespace App\Services\Mail;

final class LogOtpSender implements OtpSenderInterface
{
    public function send(string $email, string $otp, string $purpose): void
    {
        $baseDir = dirname(__DIR__, 3);
        $mailDir = $baseDir . '/storage/mail_outbox';
        $logDir = $baseDir . '/storage/logs';

        if (!is_dir($mailDir)) {
            mkdir($mailDir, 0775, true);
        }
        if (!is_dir($logDir)) {
            mkdir($logDir, 0775, true);
        }

        $purposeText = match ($purpose) {
            'DANG_KY' => 'Đăng ký tài khoản',
            'QUEN_MAT_KHAU' => 'Quên mật khẩu',
            'DANG_NHAP_ADMIN' => 'Đăng nhập quản trị',
            default => 'Xác thực OTP',
        };
        $stamp = date('YmdHis');
        $fileName = $stamp . '_' . bin2hex(random_bytes(4)) . '.txt';
        $content = "MON SMOKEE - {$purposeText}\n"
            . "Đến: {$email}\n"
            . "OTP: {$otp}\n"
            . "Hiệu lực: 300 giây\n";

        file_put_contents($mailDir . '/' . $fileName, $content, LOCK_EX);
        file_put_contents(
            $logDir . '/otp.log',
            '[' . date('Y-m-d H:i:s') . '] ' . $email . ' | muc_dich=' . $purpose . ' | file=' . $fileName . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    }
}
