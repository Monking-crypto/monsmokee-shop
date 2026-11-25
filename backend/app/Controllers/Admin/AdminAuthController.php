<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Services\OtpService;
use DateTimeImmutable;
use PDO;
use Request;
use Response;
use RuntimeException;
use Session;
use Throwable;
use Validator;

/**
 * Đăng nhập bước một cho tài khoản Admin; phiên Admin chỉ hình thành sau OTP.
 */
final class AdminAuthController
{
    private const DUMMY_PASSWORD_HASH = '$2y$10$QBEKRbHMcArA1dK/DR5XOe3KZG0KzC3.d6GF1L12rptaK2vR.uN3i';

    public function __construct(
        private PDO $pdo,
        private Validator $validator,
        private OtpService $otpService,
        private array $business,
        private array $extraOtpEmails = []
    ) {
    }

    public function login(Request $request, array $params = []): void
    {
        $input = $request->all();
        $phone = is_string($input['so_dien_thoai'] ?? null)
            ? trim($input['so_dien_thoai'])
            : '';
        $password = is_string($input['mat_khau'] ?? null)
            ? $input['mat_khau']
            : '';
        $errors = $this->validator->validate(
            ['so_dien_thoai' => $phone, 'mat_khau' => $password],
            ['so_dien_thoai' => ['required', 'phone'], 'mat_khau' => ['required']]
        );
        if ($errors !== []) {
            Response::error('Dữ liệu đăng nhập không hợp lệ', 422, $errors);
            return;
        }

        $maxFailures = (int) ($this->business['login']['max_fail'] ?? 5);
        $windowSeconds = (int) ($this->business['login']['lock_minutes'] ?? 15) * 60;
        $ip = $request->ip();
        $rateKey = 'admin_login:' . hash('sha256', $ip . "\0" . $phone);

        $this->pdo->beginTransaction();
        try {
            $createRateRow = $this->pdo->prepare(
                'INSERT IGNORE INTO rate_limit (khoa, so_lan, bat_dau, khoa_den)
                 VALUES (?, 0, NOW(), NULL)'
            );
            $createRateRow->execute([$rateKey]);

            $rateQuery = $this->pdo->prepare(
                'SELECT so_lan, bat_dau
                 FROM rate_limit
                 WHERE khoa = ?
                 FOR UPDATE'
            );
            $rateQuery->execute([$rateKey]);
            $rate = $rateQuery->fetch(PDO::FETCH_ASSOC);
            if ($rate === false) {
                throw new RuntimeException('Không thể đọc bộ đếm đăng nhập Admin.');
            }

            $now = new DateTimeImmutable('now');
            $windowStart = new DateTimeImmutable((string) $rate['bat_dau']);
            $windowEnd = $windowStart->modify('+' . $windowSeconds . ' seconds');
            $failureCount = (int) $rate['so_lan'];
            if ($now >= $windowEnd) {
                $failureCount = 0;
                $windowStart = $now;
                $windowEnd = $windowStart->modify('+' . $windowSeconds . ' seconds');
            }

            if ($failureCount >= $maxFailures) {
                $retryAfter = max(1, $windowEnd->getTimestamp() - $now->getTimestamp());
                $updateLock = $this->pdo->prepare(
                    'UPDATE rate_limit SET khoa_den = ? WHERE khoa = ?'
                );
                $updateLock->execute([$windowEnd->format('Y-m-d H:i:s'), $rateKey]);
                $this->pdo->commit();
                $outcome = ['type' => 'rate_limited', 'retry_after' => $retryAfter];
            } else {
                if ((int) $rate['so_lan'] !== $failureCount) {
                    $reset = $this->pdo->prepare(
                        'UPDATE rate_limit
                         SET so_lan = 0, bat_dau = ?, khoa_den = NULL
                         WHERE khoa = ?'
                    );
                    $reset->execute([$windowStart->format('Y-m-d H:i:s'), $rateKey]);
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
                    $outcome = ['type' => 'invalid_credentials'];
                } elseif ($user['ten_vai_tro'] !== 'Admin') {
                    $this->pdo->commit();
                    $outcome = ['type' => 'not_admin'];
                } elseif ((int) $user['trang_thai'] !== 1) {
                    $this->pdo->commit();
                    $outcome = ['type' => 'account_locked'];
                } else {
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
                    $outcome = [
                        'type' => 'admin_credentials_valid',
                        'user' => [
                            'id' => (int) $user['id'],
                            'email' => (string) $user['email'],
                        ],
                    ];
                }
            }
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        if ($outcome['type'] === 'rate_limited') {
            Response::error(
                'Đã đăng nhập sai quá số lần cho phép, vui lòng thử lại sau',
                429,
                ['retry_after' => $outcome['retry_after']]
            );
            return;
        }
        if ($outcome['type'] === 'invalid_credentials') {
            Response::error('Sai số điện thoại hoặc mật khẩu', 401);
            return;
        }
        if ($outcome['type'] === 'not_admin') {
            Response::error('Tài khoản không có quyền Admin', 403);
            return;
        }
        if ($outcome['type'] === 'account_locked') {
            Response::error('Tài khoản Admin đã bị khóa', 403);
            return;
        }

        try {
            $otp = $this->otpService->issue(
                $outcome['user']['email'],
                'DANG_NHAP_ADMIN',
                null,
                $ip
            );
        } catch (RuntimeException $error) {
            if (str_starts_with($error->getMessage(), 'OTP_RESEND_COOLDOWN:')) {
                $remaining = (int) substr($error->getMessage(), strlen('OTP_RESEND_COOLDOWN:'));
                Response::error(
                    'Vui lòng chờ trước khi yêu cầu mã OTP mới',
                    429,
                    ['resend_after_seconds' => $remaining]
                );
                return;
            }
            if ($error->getMessage() === 'OTP_MAX_SENDS_PER_HOUR') {
                Response::error('Đã vượt quá số lần gửi OTP cho phép, vui lòng thử lại sau', 429);
                return;
            }
            if ($error->getMessage() === 'OTP_SEND_FAILED') {
                Response::error('Không thể gửi email OTP lúc này, vui lòng thử lại sau', 500);
                return;
            }
            throw $error;
        }

        Session::remove('user_id');
        Session::remove('user_role');
        Session::remove('auth_user');
        Session::remove('admin_otp_verified');
        Session::remove('admin_otp_verified_at');
        Session::remove('admin_pending_user_id');
        Session::remove('admin_pending_started_at');
        Session::remove('admin_pending_expires_at');
        Session::remove('session_expired');
        Session::regenerate();

        $expiresAt = (new DateTimeImmutable($otp['expires_at']))->getTimestamp();
        $startedAt = $expiresAt - (int) $otp['expires_in_seconds'];
        Session::set('admin_pending_user_id', $outcome['user']['id']);
        Session::set('admin_pending_started_at', $startedAt);
        Session::set('admin_pending_expires_at', $expiresAt);

        Response::success('Mã OTP đăng nhập Admin đã được gửi qua email', [
            'requires_otp' => true,
            'email_masked' => $this->maskEmail($outcome['user']['email']),
            'emails_masked' => $this->maskedAdminEmails((string) $outcome['user']['email']),
            'expires_in_seconds' => $otp['expires_in_seconds'],
            'resend_after_seconds' => (int) $this->business['otp']['resend_cooldown_seconds'],
        ]);
    }

    public function verifyOtp(Request $request, array $params = []): void
    {
        $userId = $this->pendingAdminUserId();
        if ($userId === null) {
            Response::error('Phiên chờ xác thực OTP không hợp lệ hoặc đã hết hạn', 401);
            return;
        }

        $user = $this->findUser($userId);
        if (
            $user === false
            || $user['ten_vai_tro'] !== 'Admin'
            || (int) $user['trang_thai'] !== 1
        ) {
            $this->clearPendingAdmin();
            Response::error('Tài khoản Admin không còn khả dụng', 403);
            return;
        }

        $input = $request->all();
        $otp = is_string($input['otp'] ?? null) ? trim($input['otp']) : '';
        $verification = $this->otpService->verify((string) $user['email'], 'DANG_NHAP_ADMIN', $otp);
        if (!$verification['valid']) {
            $reason = $verification['reason'] ?? 'OTP_WRONG';
            $remainingAttempts = (int) ($verification['remaining_attempts'] ?? 0);
            if (in_array($reason, ['OTP_EXPIRED', 'OTP_INVALIDATED', 'OTP_NOT_FOUND'], true)) {
                $this->clearPendingAdmin();
            }

            $message = $reason === 'OTP_EXPIRED'
                ? 'Mã OTP đã hết hạn, vui lòng đăng nhập lại'
                : 'Mã OTP không đúng, vui lòng thử lại';
            Response::error($message, 422, ['remaining_attempts' => $remainingAttempts]);
            return;
        }

        Session::remove('user_id');
        Session::remove('user_role');
        Session::remove('auth_user');
        $this->clearPendingAdmin();
        Session::regenerate();
        Session::set('user_id', (int) $user['id']);
        Session::set('user_role', 'Admin');
        Session::set('admin_otp_verified', true);
        Session::set('admin_otp_verified_at', time());

        Response::success('Đăng nhập Admin thành công', [
            'user' => $this->publicUser($user),
        ]);
    }

    public function resendOtp(Request $request, array $params = []): void
    {
        $userId = $this->pendingAdminUserId();
        if ($userId === null) {
            Response::error('Phiên chờ xác thực OTP không hợp lệ hoặc đã hết hạn', 401);
            return;
        }

        $user = $this->findUser($userId);
        if (
            $user === false
            || $user['ten_vai_tro'] !== 'Admin'
            || (int) $user['trang_thai'] !== 1
        ) {
            $this->clearPendingAdmin();
            Response::error('Tài khoản Admin không còn khả dụng', 403);
            return;
        }

        try {
            $otp = $this->otpService->resend(
                (string) $user['email'],
                'DANG_NHAP_ADMIN',
                $request->ip()
            );
        } catch (RuntimeException $error) {
            if ($error->getMessage() === 'OTP_NOT_FOUND') {
                $this->clearPendingAdmin();
                Response::error('Không tìm thấy OTP đăng nhập đang chờ xác thực', 401);
                return;
            }
            if (str_starts_with($error->getMessage(), 'OTP_RESEND_COOLDOWN:')) {
                $remaining = (int) substr($error->getMessage(), strlen('OTP_RESEND_COOLDOWN:'));
                Response::error(
                    'Vui lòng chờ trước khi yêu cầu mã OTP mới',
                    429,
                    ['resend_after_seconds' => $remaining]
                );
                return;
            }
            if ($error->getMessage() === 'OTP_MAX_SENDS_PER_HOUR') {
                Response::error(
                    'Đã vượt quá số lần gửi OTP cho phép, vui lòng thử lại sau',
                    429
                );
                return;
            }
            if ($error->getMessage() === 'OTP_SEND_FAILED') {
                Response::error('Không thể gửi email OTP lúc này, vui lòng thử lại sau', 500);
                return;
            }
            throw $error;
        }

        $expiresAt = (new DateTimeImmutable($otp['expires_at']))->getTimestamp();
        Session::set(
            'admin_pending_started_at',
            $expiresAt - (int) $otp['expires_in_seconds']
        );
        Session::set('admin_pending_expires_at', $expiresAt);

        Response::success('Đã gửi lại mã OTP đăng nhập Admin', [
            'email_masked' => $this->maskEmail((string) $user['email']),
            'emails_masked' => $this->maskedAdminEmails((string) $user['email']),
            'expires_in_seconds' => $otp['expires_in_seconds'],
            'resend_after_seconds' => (int) $this->business['otp']['resend_cooldown_seconds'],
        ]);
    }

    public function logout(Request $request, array $params = []): void
    {
        Session::destroy();
        Response::success('Đăng xuất Admin thành công');
    }

    public function me(Request $request, array $params = []): void
    {
        $user = $this->findUser((int) Session::get('user_id'));
        if ($user === false || (int) $user['trang_thai'] !== 1) {
            Session::destroy();
            Response::error('Phiên Admin không hợp lệ hoặc tài khoản đã bị khóa', 401);
            return;
        }
        if ($user['ten_vai_tro'] !== 'Admin') {
            Session::destroy();
            Response::error('Bạn không có quyền truy cập chức năng này', 403);
            return;
        }

        Response::success('Thông tin tài khoản Admin hiện tại', [
            'user' => $this->publicUser($user),
        ]);
    }

    private function pendingAdminUserId(): ?int
    {
        $userId = Session::get('admin_pending_user_id');
        $startedAt = Session::get('admin_pending_started_at');
        $expiresAt = Session::get('admin_pending_expires_at');
        $now = time();

        if (
            !is_numeric($userId)
            || (int) $userId < 1
            || !is_numeric($startedAt)
            || !is_numeric($expiresAt)
            || (int) $startedAt > $now
            || (int) $expiresAt <= $now
            || (int) $expiresAt <= (int) $startedAt
        ) {
            $this->clearPendingAdmin();
            return null;
        }

        return (int) $userId;
    }

    private function clearPendingAdmin(): void
    {
        Session::remove('admin_pending_user_id');
        Session::remove('admin_pending_started_at');
        Session::remove('admin_pending_expires_at');
    }

    private function findUser(int $userId): array|false
    {
        $query = $this->pdo->prepare(
            'SELECT u.id, u.ho_ten, u.so_dien_thoai, u.email, u.trang_thai, v.ten_vai_tro
             FROM nguoi_dung u
             JOIN vai_tro v ON v.id = u.vai_tro_id
             WHERE u.id = ?
             LIMIT 1'
        );
        $query->execute([$userId]);
        $user = $query->fetch(PDO::FETCH_ASSOC);
        return $user;
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'ho_ten' => $user['ho_ten'],
            'so_dien_thoai' => $user['so_dien_thoai'],
            'email' => $user['email'],
            'vai_tro' => $user['ten_vai_tro'],
        ];
    }

    private function maskEmail(string $email): string
    {
        [$localPart, $domain] = explode('@', $email, 2);
        $visibleLength = min(2, mb_strlen($localPart));
        return mb_substr($localPart, 0, $visibleLength)
            . str_repeat('*', max(3, mb_strlen($localPart) - $visibleLength))
            . '@'
            . $domain;
    }

    private function maskedAdminEmails(string $primaryEmail): array
    {
        $emails = array_values(array_unique([
            strtolower($primaryEmail),
            ...array_map(
                static fn(string $email): string => strtolower($email),
                $this->extraOtpEmails
            ),
        ]));
        return array_map(fn(string $email): string => $this->maskEmail($email), $emails);
    }
}
