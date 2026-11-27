<?php
declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use PDO;
use RuntimeException;
use Throwable;

final class UnifiedLoginService
{
    private const DUMMY_PASSWORD_HASH = '$2y$10$QBEKRbHMcArA1dK/DR5XOe3KZG0KzC3.c6GF1L12rptaK2vR.uN3i';

    public function __construct(
        private PDO $pdo,
        private array $business
    ) {
    }

    public function authenticate(string $phone, string $password, string $ip): array
    {
        $maxFailures = (int) ($this->business['login']['max_fail'] ?? 5);
        $windowSeconds = (int) ($this->business['login']['lock_minutes'] ?? 15) * 60;
        $rateKey = 'common_login:' . hash('sha256', $ip . "\0" . $phone);

        $this->pdo->beginTransaction();
        try {
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
                throw new RuntimeException('Không thể đọc bộ đếm đăng nhập.');
            }

            $now = new DateTimeImmutable('now');
            $windowStart = new DateTimeImmutable((string) $rate['bat_dau']);
            $windowEnd = $windowStart->modify('+' . $windowSeconds . ' seconds');
            $failureCount = (int) $rate['so_lan'];
            if ($now >= $windowEnd) {
                $failureCount = 0;
                $windowStart = $now;
                $windowEnd = $windowStart->modify('+' . $windowSeconds . ' seconds');
                $reset = $this->pdo->prepare(
                    'UPDATE rate_limit
                     SET so_lan = 0, bat_dau = ?, khoa_den = NULL
                     WHERE khoa = ?'
                );
                $reset->execute([$windowStart->format('Y-m-d H:i:s'), $rateKey]);
            }

            if ($failureCount >= $maxFailures) {
                $retryAfter = max(1, $windowEnd->getTimestamp() - $now->getTimestamp());
                $this->pdo->commit();
                return ['type' => 'rate_limited', 'retry_after' => $retryAfter];
            }

            $userQuery = $this->pdo->prepare(
                'SELECT u.id, u.vai_tro_id, u.ho_ten, u.so_dien_thoai, u.email,
                        u.mat_khau, u.trang_thai, v.ten_vai_tro
                 FROM nguoi_dung u
                 JOIN vai_tro v ON v.id = u.vai_tro_id
                 WHERE u.so_dien_thoai = ?
                 LIMIT 1
                 FOR UPDATE'
            );
            $userQuery->execute([$phone]);
            $user = $userQuery->fetch(PDO::FETCH_ASSOC);
            $hash = $user === false
                ? self::DUMMY_PASSWORD_HASH
                : (string) $user['mat_khau'];
            $passwordMatches = password_verify($password, $hash);

            if ($user === false || !$passwordMatches) {
                $failureCount++;
                $lockUntil = $failureCount >= $maxFailures
                    ? $windowEnd->format('Y-m-d H:i:s')
                    : null;
                $recordFailure = $this->pdo->prepare(
                    'UPDATE rate_limit
                     SET so_lan = ?, bat_dau = ?, khoa_den = ?
                     WHERE khoa = ?'
                );
                $recordFailure->execute([
                    $failureCount,
                    $windowStart->format('Y-m-d H:i:s'),
                    $lockUntil,
                    $rateKey,
                ]);
                $this->pdo->commit();
                if ($failureCount >= $maxFailures) {
                    $retryAfter = max(1, $windowEnd->getTimestamp() - $now->getTimestamp());
                    return ['type' => 'rate_limited', 'retry_after' => $retryAfter];
                }
                return ['type' => 'invalid_credentials'];
            }

            if ((int) $user['trang_thai'] !== 1) {
                $this->pdo->commit();
                return ['type' => 'account_locked'];
            }

            if (password_needs_rehash((string) $user['mat_khau'], PASSWORD_BCRYPT)) {
                $newHash = password_hash($password, PASSWORD_BCRYPT);
                $updatePassword = $this->pdo->prepare(
                    'UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?'
                );
                $updatePassword->execute([$newHash, (int) $user['id']]);
            }

            $clearFailures = $this->pdo->prepare('DELETE FROM rate_limit WHERE khoa = ?');
            $clearFailures->execute([$rateKey]);
            $this->pdo->commit();

            $publicUser = [
                'id' => (int) $user['id'],
                'ho_ten' => $user['ho_ten'],
                'so_dien_thoai' => $user['so_dien_thoai'],
                'email' => $user['email'],
                'vai_tro' => $user['ten_vai_tro'],
            ];
            return [
                'type' => $user['ten_vai_tro'] === 'Admin'
                    ? 'admin_credentials_valid'
                    : 'customer_credentials_valid',
                'user' => $publicUser,
            ];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }
}
