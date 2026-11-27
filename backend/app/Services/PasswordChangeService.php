<?php
declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use PDO;
use RuntimeException;
use Session;
use Throwable;

final class PasswordChangeService
{
    public function __construct(
        private PDO $pdo,
        private array $business
    ) {
    }

    public function change(int $userId, string $expectedRole, array $input): array
    {
        $currentPassword = $input['mat_khau_hien_tai'] ?? null;
        $newPassword = $input['mat_khau_moi'] ?? null;
        $confirmation = $input['xac_nhan_mat_khau_moi'] ?? null;
        $errors = [];

        if (!is_string($currentPassword) || $currentPassword === '') {
            $errors['mat_khau_hien_tai'] = 'Vui lòng nhập mật khẩu hiện tại';
        }
        if (!is_string($newPassword) || $newPassword === '') {
            $errors['mat_khau_moi'] = 'Vui lòng nhập mật khẩu mới';
        } elseif (!preg_match(\Validator::RE_PASSWORD, $newPassword)) {
            $errors['mat_khau_moi'] = 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ thường và chữ số';
        }
        if (!is_string($confirmation) || $confirmation === '') {
            $errors['xac_nhan_mat_khau_moi'] = 'Vui lòng xác nhận mật khẩu mới';
        } elseif (is_string($newPassword) && !hash_equals($newPassword, $confirmation)) {
            $errors['xac_nhan_mat_khau_moi'] = 'Xác nhận mật khẩu mới không khớp';
        }
        if ($errors !== []) {
            return ['status' => 422, 'message' => 'Dữ liệu không hợp lệ', 'errors' => $errors];
        }

        $maxFailures = (int) ($this->business['password_change']['max_fail'] ?? 0);
        $lockMinutes = (int) ($this->business['password_change']['lock_minutes'] ?? 0);
        if ($maxFailures < 1 || $lockMinutes < 1) {
            throw new RuntimeException('PASSWORD_CHANGE_CONFIG_INVALID');
        }
        $windowSeconds = $lockMinutes * 60;
        $rateKey = 'password_change:' . hash('sha256', $expectedRole . ':' . $userId);

        $this->pdo->beginTransaction();
        try {
            $userQuery = $this->pdo->prepare(
                'SELECT u.id, u.email, u.mat_khau, u.trang_thai, v.ten_vai_tro
                 FROM nguoi_dung u
                 JOIN vai_tro v ON v.id = u.vai_tro_id
                 WHERE u.id = ?
                 LIMIT 1
                 FOR UPDATE'
            );
            $userQuery->execute([$userId]);
            $user = $userQuery->fetch(PDO::FETCH_ASSOC);
            if ($user === false || (int) $user['trang_thai'] !== 1) {
                $this->pdo->commit();
                return ['status' => 401, 'message' => 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa'];
            }
            if ($user['ten_vai_tro'] !== $expectedRole) {
                $this->pdo->commit();
                return ['status' => 403, 'message' => 'Bạn không có quyền truy cập chức năng này'];
            }

            $createRateRow = $this->pdo->prepare(
                'INSERT IGNORE INTO rate_limit (khoa, so_lan, bat_dau, khoa_den)
                 VALUES (?, 0, NOW(), NULL)'
            );
            $createRateRow->execute([$rateKey]);
            $rateQuery = $this->pdo->prepare(
                'SELECT so_lan, bat_dau, khoa_den
                 FROM rate_limit
                 WHERE khoa = ?
                 FOR UPDATE'
            );
            $rateQuery->execute([$rateKey]);
            $rate = $rateQuery->fetch(PDO::FETCH_ASSOC);
            if ($rate === false) {
                throw new RuntimeException('Không thể đọc bộ đếm đổi mật khẩu.');
            }

            $now = new DateTimeImmutable('now');
            $windowStart = new DateTimeImmutable((string) $rate['bat_dau']);
            $windowEnd = $windowStart->modify('+' . $windowSeconds . ' seconds');
            $failureCount = (int) $rate['so_lan'];
            if ($now >= $windowEnd) {
                $failureCount = 0;
                $windowStart = $now;
                $windowEnd = $windowStart->modify('+' . $windowSeconds . ' seconds');
                $this->pdo->prepare(
                    'UPDATE rate_limit
                     SET so_lan = 0, bat_dau = ?, khoa_den = NULL
                     WHERE khoa = ?'
                )->execute([$windowStart->format('Y-m-d H:i:s'), $rateKey]);
            }

            if ($failureCount >= $maxFailures) {
                $retryAfter = max(1, $windowEnd->getTimestamp() - $now->getTimestamp());
                $this->pdo->commit();
                return [
                    'status' => 429,
                    'message' => 'Bạn đã thử quá nhiều lần, vui lòng thử lại sau',
                    'errors' => ['retry_after' => $retryAfter],
                ];
            }

            if (!password_verify($currentPassword, (string) $user['mat_khau'])) {
                $failureCount++;
                $lockUntil = $failureCount >= $maxFailures
                    ? $windowEnd->format('Y-m-d H:i:s')
                    : null;
                $this->pdo->prepare(
                    'UPDATE rate_limit
                     SET so_lan = ?, bat_dau = ?, khoa_den = ?
                     WHERE khoa = ?'
                )->execute([
                    $failureCount,
                    $windowStart->format('Y-m-d H:i:s'),
                    $lockUntil,
                    $rateKey,
                ]);
                $this->pdo->commit();
                return [
                    'status' => 422,
                    'message' => 'Mật khẩu hiện tại không đúng',
                    'errors' => ['mat_khau_hien_tai' => 'Mật khẩu hiện tại không đúng'],
                ];
            }

            if (hash_equals($currentPassword, $newPassword)) {
                $this->pdo->commit();
                return [
                    'status' => 422,
                    'message' => 'Mật khẩu mới phải khác mật khẩu hiện tại',
                    'errors' => ['mat_khau_moi' => 'Mật khẩu mới phải khác mật khẩu hiện tại'],
                ];
            }

            $this->pdo->prepare(
                'UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?'
            )->execute([password_hash($newPassword, PASSWORD_BCRYPT), $userId]);
            $this->pdo->prepare(
                'UPDATE dat_lai_mat_khau_ticket
                 SET da_dung = 1
                 WHERE user_id = ? AND da_dung = 0 AND het_han_luc > NOW()'
            )->execute([$userId]);
            $this->pdo->prepare(
                "UPDATE otp_xac_thuc
                 SET da_su_dung = 1
                 WHERE email = ? AND muc_dich = 'QUEN_MAT_KHAU'
                   AND da_su_dung = 0 AND het_han_luc > NOW()"
            )->execute([(string) $user['email']]);
            $this->pdo->prepare(
                'UPDATE rate_limit
                 SET so_lan = 0, bat_dau = NOW(), khoa_den = NULL
                 WHERE khoa = ?'
            )->execute([$rateKey]);
            $this->pdo->commit();

            Session::regenerate();
            return ['status' => 200, 'message' => 'Đổi mật khẩu thành công'];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }
}
