<?php
declare(strict_types=1);

namespace App\Services;

use App\Services\Mail\OtpSenderInterface;
use DateInterval;
use DateTimeImmutable;
use PDO;
use RuntimeException;
use Throwable;

/**
 * Tạo, gửi, kiểm tra và vô hiệu OTP email.
 * OTP luôn được lưu dạng băm và không bao giờ trả về cho API.
 */
final class OtpService
{
    public function __construct(
        private PDO $pdo,
        private OtpSenderInterface $sender,
        private array $business
    ) {
    }

    public function issue(
        string $email,
        string $purpose,
        mixed $temporaryData = null,
        ?string $ip = null
    ): array {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('EMAIL_INVALID');
        }
        if (!in_array($purpose, ['DANG_KY', 'QUEN_MAT_KHAU', 'DANG_NHAP_ADMIN'], true)) {
            throw new RuntimeException('OTP_PURPOSE_INVALID');
        }

        $ip = $ip !== null ? substr($ip, 0, 45) : null;
        $config = $this->business['otp'];
        $ttl = (int) ($config['ttl_seconds'] ?? 300);
        $cooldown = (int) ($config['resend_cooldown_seconds'] ?? 60);
        $maxSends = (int) ($config['max_sends_per_hour'] ?? 5);

        $latest = $this->pdo->prepare(
            'SELECT TIMESTAMPDIFF(SECOND, ngay_tao, NOW()) AS elapsed_seconds
             FROM otp_xac_thuc
             WHERE email = ? AND muc_dich = ?
             ORDER BY id DESC LIMIT 1'
        );
        $latest->execute([$email, $purpose]);
        $latestRow = $latest->fetch(PDO::FETCH_ASSOC);
        if ($latestRow !== false) {
            $elapsed = (int) $latestRow['elapsed_seconds'];
            if ($elapsed >= 0 && $elapsed < $cooldown) {
                throw new RuntimeException('OTP_RESEND_COOLDOWN:' . ($cooldown - $elapsed));
            }
        }

        $emailCount = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM otp_xac_thuc
             WHERE email = ? AND muc_dich = ? AND ngay_tao >= NOW() - INTERVAL 1 HOUR'
        );
        $emailCount->execute([$email, $purpose]);
        if ((int) $emailCount->fetchColumn() >= $maxSends) {
            throw new RuntimeException('OTP_MAX_SENDS_PER_HOUR');
        }

        if ($ip !== null) {
            $ipCount = $this->pdo->prepare(
                'SELECT COUNT(*)
                 FROM otp_xac_thuc
                 WHERE ip = ? AND ngay_tao >= NOW() - INTERVAL 1 HOUR'
            );
            $ipCount->execute([$ip]);
            if ((int) $ipCount->fetchColumn() >= $maxSends) {
                throw new RuntimeException('OTP_MAX_SENDS_PER_HOUR');
            }
        }

        $otpLength = (int) ($config['length'] ?? 6);
        $otp = '';
        for ($index = 0; $index < $otpLength; $index++) {
            $otp .= (string) random_int(0, 9);
        }
        $otpHash = password_hash($otp, PASSWORD_BCRYPT);
        $expiresAt = (new DateTimeImmutable('now'))->add(new DateInterval('PT' . $ttl . 'S'));
        $expiresDb = $expiresAt->format('Y-m-d H:i:s');

        $this->pdo->beginTransaction();
        $insertedId = null;
        try {
            $invalidate = $this->pdo->prepare(
                'UPDATE otp_xac_thuc
                 SET da_su_dung = 1
                 WHERE email = ? AND muc_dich = ? AND da_su_dung = 0'
            );
            $invalidate->execute([$email, $purpose]);

            $insert = $this->pdo->prepare(
                'INSERT INTO otp_xac_thuc
                 (muc_dich, email, ma_otp_hash, du_lieu_tam, het_han_luc, so_lan_nhap_sai, da_su_dung, ip)
                 VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
            );
            $jsonData = $temporaryData === null ? null : json_encode(
                $temporaryData,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
            $insert->execute([$purpose, $email, $otpHash, $jsonData, $expiresDb, $ip]);
            $insertedId = (int) $this->pdo->lastInsertId();
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        try {
            $this->sender->send($email, $otp, $purpose);
        } catch (Throwable $error) {
            $invalidateSentOtp = $this->pdo->prepare(
                'UPDATE otp_xac_thuc SET da_su_dung = 1 WHERE id = ?'
            );
            $invalidateSentOtp->execute([$insertedId]);
            throw new RuntimeException('OTP_SEND_FAILED');
        }

        return [
            'expires_in_seconds' => $ttl,
            'expires_at' => $expiresAt->format(DATE_ATOM),
        ];
    }

    public function resend(
        string $email,
        string $purpose,
        ?string $ip = null,
        bool $requireTemporaryData = false
    ): array
    {
        $email = strtolower(trim($email));
        $latest = $this->pdo->prepare(
            'SELECT du_lieu_tam
             FROM otp_xac_thuc
             WHERE email = ? AND muc_dich = ?
             ORDER BY id DESC LIMIT 1'
        );
        $latest->execute([$email, $purpose]);
        $row = $latest->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            throw new RuntimeException('OTP_NOT_FOUND');
        }

        $temporaryData = null;
        if ($row !== false && is_string($row['du_lieu_tam']) && $row['du_lieu_tam'] !== '') {
            $decoded = json_decode($row['du_lieu_tam'], true);
            if (is_array($decoded)) {
                $temporaryData = $decoded;
            }
        }
        if ($requireTemporaryData && $temporaryData === null) {
            throw new RuntimeException('OTP_DATA_NOT_FOUND');
        }
        return $this->issue($email, $purpose, $temporaryData, $ip);
    }

    public function verify(string $email, string $purpose, string $otp): array
    {
        $verification = $this->verifyAndConsume(
            $email,
            $purpose,
            $otp,
            static fn(?array $temporaryData): ?array => $temporaryData
        );
        if (!$verification['valid']) {
            return $verification;
        }

        return [
            'valid' => true,
            'temporary_data' => $verification['temporary_data'],
        ];
    }

    /**
     * Chạy thao tác thành công khi OTP còn hợp lệ, trong cùng transaction với việc tiêu thụ OTP.
     */
    public function verifyAndConsume(
        string $email,
        string $purpose,
        string $otp,
        callable $onValid
    ): array
    {
        $email = strtolower(trim($email));
        $config = $this->business['otp'];
        $maxWrong = (int) ($config['max_wrong_attempts'] ?? 5);

        $this->pdo->beginTransaction();
        try {
            $find = $this->pdo->prepare(
                'SELECT id, ma_otp_hash, du_lieu_tam, het_han_luc, so_lan_nhap_sai
                 FROM otp_xac_thuc
                 WHERE email = ? AND muc_dich = ? AND da_su_dung = 0
                 ORDER BY id DESC
                 LIMIT 1
                 FOR UPDATE'
            );
            $find->execute([$email, $purpose]);
            $row = $find->fetch(PDO::FETCH_ASSOC);

            if ($row === false) {
                $this->pdo->commit();
                return ['valid' => false, 'reason' => 'OTP_NOT_FOUND'];
            }

            $now = new DateTimeImmutable('now');
            $expires = new DateTimeImmutable((string) $row['het_han_luc']);
            if ($expires < $now) {
                $expire = $this->pdo->prepare(
                    'UPDATE otp_xac_thuc SET da_su_dung = 1 WHERE id = ?'
                );
                $expire->execute([(int) $row['id']]);
                $this->pdo->commit();
                return ['valid' => false, 'reason' => 'OTP_EXPIRED'];
            }

            if (!preg_match('/^\d{6}$/', $otp) || !password_verify($otp, (string) $row['ma_otp_hash'])) {
                $wrongCount = (int) $row['so_lan_nhap_sai'] + 1;
                $invalidate = $wrongCount >= $maxWrong;
                $update = $this->pdo->prepare(
                    'UPDATE otp_xac_thuc
                     SET so_lan_nhap_sai = ?, da_su_dung = ?
                     WHERE id = ?'
                );
                $update->execute([$wrongCount, $invalidate ? 1 : 0, (int) $row['id']]);
                $this->pdo->commit();
                return [
                    'valid' => false,
                    'reason' => $invalidate ? 'OTP_INVALIDATED' : 'OTP_WRONG',
                    'wrong_attempts' => $wrongCount,
                    'remaining_attempts' => max(0, $maxWrong - $wrongCount),
                ];
            }

            $temporaryData = null;
            if (is_string($row['du_lieu_tam']) && $row['du_lieu_tam'] !== '') {
                $decoded = json_decode($row['du_lieu_tam'], true);
                if (is_array($decoded)) {
                    $temporaryData = $decoded;
                }
            }

            $result = $onValid($temporaryData);
            $consume = $this->pdo->prepare(
                'UPDATE otp_xac_thuc SET da_su_dung = 1 WHERE id = ?'
            );
            $consume->execute([(int) $row['id']]);
            $this->pdo->commit();
            return [
                'valid' => true,
                'temporary_data' => $temporaryData,
                'result' => $result,
            ];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }
}
