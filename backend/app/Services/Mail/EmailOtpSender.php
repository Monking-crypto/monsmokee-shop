<?php
declare(strict_types=1);

namespace App\Services\Mail;

use PHPMailer\PHPMailer\PHPMailer;
use RuntimeException;

final class EmailOtpSender implements OtpSenderInterface
{
    public function __construct(private array $config)
    {
    }

    public function send(string $email, string $otp, string $purpose): void
    {
        $smtp = $this->config['smtp'];
        $mailer = new PHPMailer(true);
        $mailer->isSMTP();
        $mailer->Host = $smtp['host'];
        $mailer->Port = $smtp['port'];
        $mailer->SMTPAuth = true;
        $mailer->Username = $smtp['user'];
        $mailer->Password = $smtp['pass'];
        $mailer->SMTPSecure = match ($smtp['encryption']) {
            'tls' => PHPMailer::ENCRYPTION_STARTTLS,
            'ssl' => PHPMailer::ENCRYPTION_SMTPS,
            default => throw new RuntimeException('MAIL_ENCRYPTION phải là tls hoặc ssl.'),
        };
        $mailer->CharSet = 'UTF-8';
        $mailer->setFrom($smtp['from'], $smtp['from_name']);
        $mailer->addAddress($email);
        $mailer->isHTML(true);

        $purposeText = match ($purpose) {
            'DANG_KY' => 'Đăng ký tài khoản',
            'QUEN_MAT_KHAU' => 'Quên mật khẩu',
            'DANG_NHAP_ADMIN' => 'Đăng nhập quản trị',
            default => 'Xác thực OTP',
        };
        $mailer->Subject = 'MON SMOKEE - Ma OTP ' . $purposeText;
        $mailer->Body = '<p>Mã OTP của bạn là:</p><h2>' . htmlspecialchars($otp) . '</h2><p>Mã có hiệu lực 5 phút.</p>';
        $mailer->AltBody = 'Ma OTP: ' . $otp . '. Ma co hieu luc 5 phut.';
        $mailer->send();
    }
}
