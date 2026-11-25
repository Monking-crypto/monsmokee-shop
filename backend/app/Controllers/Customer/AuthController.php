<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\OtpService;
use DateTimeImmutable;
use Logger;
use PDO;
use PDOException;
use Request;
use Response;
use RuntimeException;
use Session;
use Throwable;
use Validator;

/**
 * Endpoint xác thực dành cho khách hàng.
 */
final class AuthController
{
    private const DUMMY_PASSWORD_HASH = '$2y$10$QBEKRbHMcArA1dK/DR5XOe3KZG0KzC3.d6GF1L12rptaK2vR.uN3i';

    public function __construct(
        private PDO $pdo,
        private Validator $validator,
        private OtpService $otpService,
        private array $business
    ) {
    }

    /**
     * Kiểm tra dữ liệu đăng ký, lưu tạm mật khẩu đã băm và gửi OTP email.
     */
    public function registerStart(Request $request, array $params = []): void
    {
        $input = $request->all();
        $data = [
            'ho_ten' => is_string($input['ho_ten'] ?? null) ? trim($input['ho_ten']) : '',
            'so_dien_thoai' => is_string($input['so_dien_thoai'] ?? null)
                ? trim($input['so_dien_thoai'])
                : '',
            'email' => is_string($input['email'] ?? null)
                ? strtolower(trim($input['email']))
                : '',
            'mat_khau' => is_string($input['mat_khau'] ?? null) ? $input['mat_khau'] : '',
            'nhap_lai_mat_khau' => is_string($input['nhap_lai_mat_khau'] ?? null)
                ? $input['nhap_lai_mat_khau']
                : '',
        ];

        $errors = $this->validator->validate($data, [
            'ho_ten' => ['required', 'name'],
            'so_dien_thoai' => ['required', 'phone'],
            'email' => ['required', 'email'],
            'mat_khau' => ['required', 'password'],
            'nhap_lai_mat_khau' => ['required'],
        ]);
        if (mb_strlen($data['ho_ten']) > 100) {
            $errors['ho_ten'] = 'Họ tên không được vượt quá 100 ký tự';
        }
        if ($data['mat_khau'] !== $data['nhap_lai_mat_khau']) {
            $errors['nhap_lai_mat_khau'] = 'Mật khẩu nhập lại không khớp';
        }
        if ($errors !== []) {
            Response::error('Dữ liệu đăng ký không hợp lệ', 422, $errors);
            return;
        }

        $existing = $this->pdo->prepare(
            'SELECT id FROM nguoi_dung
             WHERE so_dien_thoai = ? OR email = ?
             LIMIT 1'
        );
        $existing->execute([$data['so_dien_thoai'], $data['email']]);
        if ($existing->fetchColumn() !== false) {
            Response::error(
                'Số điện thoại hoặc email đã được đăng ký',
                409,
                ['tai_khoan' => 'Vui lòng dùng số điện thoại và email khác']
            );
            return;
        }

        $temporaryData = [
            'ho_ten' => $data['ho_ten'],
            'so_dien_thoai' => $data['so_dien_thoai'],
            'email' => $data['email'],
            'mat_khau' => password_hash($data['mat_khau'], PASSWORD_BCRYPT),
        ];

        try {
            $otp = $this->otpService->issue(
                $data['email'],
                'DANG_KY',
                $temporaryData,
                $request->ip()
            );
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                Response::error(
                    'Số điện thoại hoặc email đã được đăng ký',
                    409,
                    ['tai_khoan' => 'Vui lòng dùng số điện thoại và email khác']
                );
                return;
            }
            throw $error;
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

        Response::success('Mã xác thực đã được gửi đến email', [
            'email_masked' => $this->maskEmail($data['email']),
            'expires_in_seconds' => $otp['expires_in_seconds'],
            'expires_at' => $otp['expires_at'],
            'resend_after_seconds' => (int) $this->business['otp']['resend_cooldown_seconds'],
        ]);
    }

    /**
     * Xác nhận OTP rồi tạo tài khoản và đăng nhập trong cùng transaction.
     */
    public function registerVerify(Request $request, array $params = []): void
    {
        $input = $request->all();
        $email = is_string($input['email'] ?? null) ? strtolower(trim($input['email'])) : '';
        $otp = is_string($input['otp'] ?? null) ? trim($input['otp']) : '';
        $errors = $this->validator->validate(
            ['email' => $email, 'otp' => $otp],
            ['email' => ['required', 'email'], 'otp' => ['required', 'otp']]
        );
        if ($errors !== []) {
            Response::error('Dữ liệu xác thực không hợp lệ', 422, $errors);
            return;
        }

        $verification = $this->otpService->verifyAndConsume(
            $email,
            'DANG_KY',
            $otp,
            function (?array $temporaryData) use ($email): array {
                if (!$this->isValidRegistrationData($temporaryData, $email)) {
                    return ['outcome' => 'invalid_data'];
                }

                $duplicate = $this->pdo->prepare(
                    'SELECT id FROM nguoi_dung
                     WHERE so_dien_thoai = ? OR email = ?
                     LIMIT 1'
                );
                $duplicate->execute([
                    $temporaryData['so_dien_thoai'],
                    $temporaryData['email'],
                ]);
                if ($duplicate->fetchColumn() !== false) {
                    return ['outcome' => 'duplicate'];
                }

                $roleQuery = $this->pdo->prepare(
                    'SELECT id FROM vai_tro WHERE ten_vai_tro = ? LIMIT 1'
                );
                $roleQuery->execute(['Customer']);
                $roleId = $roleQuery->fetchColumn();
                if ($roleId === false) {
                    throw new RuntimeException('Vai trò Customer chưa được tạo trong CSDL.');
                }

                try {
                    $insert = $this->pdo->prepare(
                        'INSERT INTO nguoi_dung
                         (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau)
                         VALUES (?, ?, ?, ?, ?)'
                    );
                    $insert->execute([
                        (int) $roleId,
                        $temporaryData['ho_ten'],
                        $temporaryData['so_dien_thoai'],
                        $temporaryData['email'],
                        $temporaryData['mat_khau'],
                    ]);
                } catch (PDOException $error) {
                    if ($error->getCode() === '23000') {
                        return ['outcome' => 'duplicate'];
                    }
                    throw $error;
                }

                return [
                    'outcome' => 'created',
                    'user' => [
                        'id' => (int) $this->pdo->lastInsertId(),
                        'ho_ten' => $temporaryData['ho_ten'],
                        'so_dien_thoai' => $temporaryData['so_dien_thoai'],
                        'email' => $temporaryData['email'],
                        'vai_tro' => 'Customer',
                    ],
                ];
            }
        );

        if (!$verification['valid']) {
            $this->respondToOtpFailure($verification);
            return;
        }

        $result = $verification['result'];
        if (($result['outcome'] ?? null) === 'duplicate') {
            Response::error(
                'Số điện thoại hoặc email đã được đăng ký',
                409,
                ['tai_khoan' => 'Vui lòng dùng số điện thoại và email khác']
            );
            return;
        }
        if (($result['outcome'] ?? null) !== 'created' || !isset($result['user'])) {
            Response::error(
                'Thông tin đăng ký tạm không hợp lệ, vui lòng đăng ký lại',
                409
            );
            return;
        }

        $this->startCustomerSession($result['user']);
        Response::success('Đăng ký thành công', ['user' => $result['user']], 201);
    }

    public function forgotPasswordStart(Request $request, array $params = []): void
    {
        $input = $request->all();
        $email = is_string($input['email'] ?? null)
            ? strtolower(trim($input['email']))
            : '';
        $rateLimit = $this->consumeForgotPasswordSendLimit($email, $request->ip());
        if (!$rateLimit['allowed']) {
            $this->respondForgotPasswordGeneric();
            return;
        }

        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $customer = $this->findActiveCustomerByEmail($email);
            if ($customer !== false) {
                try {
                    $this->otpService->issue(
                        $email,
                        'QUEN_MAT_KHAU',
                        null,
                        $request->ip()
                    );
                } catch (RuntimeException $error) {
                    if (
                        !str_starts_with($error->getMessage(), 'OTP_RESEND_COOLDOWN:')
                        && $error->getMessage() !== 'OTP_MAX_SENDS_PER_HOUR'
                        && $error->getMessage() !== 'OTP_SEND_FAILED'
                    ) {
                        throw $error;
                    }
                    Logger::error('Forgot-password OTP dispatch failed: ' . $error->getMessage());
                }
            }
        }

        $this->respondForgotPasswordGeneric();
    }

    public function forgotPasswordVerify(Request $request, array $params = []): void
    {
        $input = $request->all();
        $data = [
            'email' => is_string($input['email'] ?? null)
                ? strtolower(trim($input['email']))
                : '',
            'otp' => is_string($input['otp'] ?? null) ? trim($input['otp']) : '',
            'mat_khau' => is_string($input['mat_khau'] ?? null) ? $input['mat_khau'] : '',
            'nhap_lai_mat_khau' => is_string($input['nhap_lai_mat_khau'] ?? null)
                ? $input['nhap_lai_mat_khau']
                : '',
        ];
        $errors = $this->validator->validate($data, [
            'email' => ['required', 'email'],
            'otp' => ['required', 'otp'],
            'mat_khau' => ['required', 'password'],
            'nhap_lai_mat_khau' => ['required'],
        ]);
        if ($data['mat_khau'] !== $data['nhap_lai_mat_khau']) {
            $errors['nhap_lai_mat_khau'] = 'Mật khẩu nhập lại không khớp';
        }
        if ($errors !== []) {
            Response::error('Dữ liệu đặt lại mật khẩu không hợp lệ', 422, $errors);
            return;
        }

        $rateLimit = $this->consumeForgotPasswordVerifyLimit($data['email'], $request->ip());
        if (!$rateLimit['allowed']) {
            Response::error(
                'Đã thử quá nhiều lần, vui lòng thử lại sau',
                429,
                ['retry_after' => $rateLimit['retry_after']]
            );
            return;
        }

        $newPasswordHash = password_hash($data['mat_khau'], PASSWORD_BCRYPT);
        $verification = $this->otpService->verifyAndConsume(
            $data['email'],
            'QUEN_MAT_KHAU',
            $data['otp'],
            function () use ($data, $newPasswordHash): array {
                $customer = $this->findActiveCustomerByEmail($data['email'], true);
                if ($customer === false) {
                    return ['outcome' => 'account_unavailable'];
                }

                $update = $this->pdo->prepare(
                    'UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?'
                );
                $update->execute([$newPasswordHash, (int) $customer['id']]);
                return ['outcome' => 'password_updated'];
            }
        );

        if (!$verification['valid']) {
            $this->respondToOtpFailure($verification);
            return;
        }
        if (($verification['result']['outcome'] ?? null) !== 'password_updated') {
            Response::error('Không tìm thấy tài khoản khách hàng đang hoạt động', 422);
            return;
        }

        Session::destroy();
        Response::success('Đặt lại mật khẩu thành công, vui lòng đăng nhập lại');
    }

    public function forgotPasswordVerifyOtp(Request $request, array $params = []): void
    {
        $input = $request->all();
        $email = is_string($input['email'] ?? null)
            ? strtolower(trim($input['email']))
            : '';
        $otp = is_string($input['otp'] ?? null) ? trim($input['otp']) : '';
        $rateLimit = $this->consumeForgotPasswordActionLimit(
            'forgot_password_verify_otp',
            $email,
            $request->ip()
        );
        if (!$rateLimit['allowed']) {
            Response::error(
                'Đã thử quá nhiều lần, vui lòng thử lại sau',
                429,
                ['retry_after' => $rateLimit['retry_after']]
            );
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $otp)) {
            password_verify($otp, self::DUMMY_PASSWORD_HASH);
            $this->respondToForgotPasswordOtpFailure();
            return;
        }

        $customer = $this->findActiveCustomerByEmail($email);
        if ($customer === false) {
            password_verify($otp, self::DUMMY_PASSWORD_HASH);
            $this->respondToForgotPasswordOtpFailure();
            return;
        }

        $verification = $this->otpService->verifyAndConsume(
            $email,
            'QUEN_MAT_KHAU',
            $otp,
            function () use ($email): array {
                $lockedCustomer = $this->findActiveCustomerByEmail($email, true);
                if ($lockedCustomer === false) {
                    return ['outcome' => 'account_unavailable'];
                }

                $this->pdo->prepare(
                    'DELETE FROM dat_lai_mat_khau_ticket WHERE het_han_luc <= NOW()'
                )->execute();
                $this->pdo->prepare(
                    'UPDATE dat_lai_mat_khau_ticket
                     SET da_dung = 1
                     WHERE user_id = ? AND da_dung = 0'
                )->execute([(int) $lockedCustomer['id']]);

                $ticket = bin2hex(random_bytes(32));
                $ttl = max(1, (int) ($this->business['password_reset_ticket']['ttl_seconds'] ?? 600));
                $expiresAt = (new DateTimeImmutable('now'))
                    ->modify('+' . $ttl . ' seconds');
                $insert = $this->pdo->prepare(
                    'INSERT INTO dat_lai_mat_khau_ticket
                     (user_id, email, ticket_hash, het_han_luc, da_dung)
                     VALUES (?, ?, ?, ?, 0)'
                );
                $insert->execute([
                    (int) $lockedCustomer['id'],
                    $email,
                    hash('sha256', $ticket),
                    $expiresAt->format('Y-m-d H:i:s'),
                ]);

                return [
                    'outcome' => 'ticket_created',
                    'ticket' => $ticket,
                    'expires_in_seconds' => $ttl,
                ];
            }
        );

        if (!$verification['valid']) {
            $this->respondToForgotPasswordOtpFailure(
                in_array($verification['reason'] ?? null, ['OTP_WRONG', 'OTP_INVALIDATED'], true)
                    ? ($verification['remaining_attempts'] ?? null)
                    : null
            );
            return;
        }

        $result = $verification['result'] ?? [];
        if (($result['outcome'] ?? null) !== 'ticket_created') {
            $this->respondToForgotPasswordOtpFailure();
            return;
        }

        Response::success('Mã xác thực hợp lệ', [
            'reset_ticket' => $result['ticket'],
            'expires_in_seconds' => $result['expires_in_seconds'],
        ]);
    }

    public function forgotPasswordReset(Request $request, array $params = []): void
    {
        $input = $request->all();
        $email = is_string($input['email'] ?? null)
            ? strtolower(trim($input['email']))
            : '';
        $ticket = is_string($input['reset_ticket'] ?? null)
            ? trim($input['reset_ticket'])
            : '';
        $rateLimit = $this->consumeForgotPasswordActionLimit(
            'forgot_password_reset',
            $email,
            $request->ip()
        );
        if (!$rateLimit['allowed']) {
            Response::error(
                'Đã thử quá nhiều lần, vui lòng thử lại sau',
                429,
                ['retry_after' => $rateLimit['retry_after']]
            );
            return;
        }

        if (
            !filter_var($email, FILTER_VALIDATE_EMAIL)
            || !preg_match('/^[a-f0-9]{64}$/i', $ticket)
        ) {
            $this->respondToInvalidResetTicket();
            return;
        }

        $password = is_string($input['mat_khau'] ?? null) ? $input['mat_khau'] : '';
        $confirmPassword = is_string($input['nhap_lai_mat_khau'] ?? null)
            ? $input['nhap_lai_mat_khau']
            : '';
        $passwordErrors = $this->validator->validate(
            ['mat_khau' => $password, 'nhap_lai_mat_khau' => $confirmPassword],
            ['mat_khau' => ['required', 'password'], 'nhap_lai_mat_khau' => ['required']]
        );
        if ($password !== $confirmPassword) {
            $passwordErrors['nhap_lai_mat_khau'] = 'Mật khẩu nhập lại không khớp';
        }

        $this->pdo->beginTransaction();
        try {
            $ticketHash = hash('sha256', $ticket);
            $customer = $this->pdo->prepare(
                'SELECT u.id
                 FROM nguoi_dung u
                 JOIN vai_tro v ON v.id = u.vai_tro_id
                 WHERE u.email = ? AND u.trang_thai = 1 AND v.ten_vai_tro = ?
                 LIMIT 1
                 FOR UPDATE'
            );
            $customer->execute([$email, 'Customer']);
            $customerId = $customer->fetchColumn();
            if ($customerId === false) {
                $this->pdo->rollBack();
                $this->respondToInvalidResetTicket();
                return;
            }

            $find = $this->pdo->prepare(
                'SELECT id, user_id, email, ticket_hash, het_han_luc
                 FROM dat_lai_mat_khau_ticket
                 WHERE email = ? AND ticket_hash = ? AND da_dung = 0
                 ORDER BY id DESC
                 LIMIT 1
                 FOR UPDATE'
            );
            $find->execute([$email, $ticketHash]);
            $row = $find->fetch(PDO::FETCH_ASSOC);
            if (
                $row === false
                || !hash_equals((string) ($row['ticket_hash'] ?? ''), $ticketHash)
                || (int) $row['user_id'] !== (int) $customerId
                || new DateTimeImmutable((string) $row['het_han_luc']) <= new DateTimeImmutable('now')
            ) {
                $this->pdo->rollBack();
                $this->respondToInvalidResetTicket();
                return;
            }

            if ($passwordErrors !== []) {
                $this->pdo->rollBack();
                Response::error('Mật khẩu mới không hợp lệ', 422, $passwordErrors);
                return;
            }

            $updatePassword = $this->pdo->prepare(
                'UPDATE nguoi_dung SET mat_khau = ? WHERE id = ?'
            );
            $updatePassword->execute([
                password_hash($password, PASSWORD_BCRYPT),
                (int) $row['user_id'],
            ]);
            $consumeTicket = $this->pdo->prepare(
                'UPDATE dat_lai_mat_khau_ticket SET da_dung = 1 WHERE id = ?'
            );
            $consumeTicket->execute([(int) $row['id']]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        Session::destroy();
        Response::success('Đặt lại mật khẩu thành công, vui lòng đăng nhập lại');
    }

    public function forgotPasswordResend(Request $request, array $params = []): void
    {
        $input = $request->all();
        $email = is_string($input['email'] ?? null)
            ? strtolower(trim($input['email']))
            : '';
        $rateLimit = $this->consumeForgotPasswordSendLimit($email, $request->ip());
        if (!$rateLimit['allowed']) {
            Response::error(
                'Vui lòng chờ trước khi yêu cầu mã xác thực mới',
                429,
                ['retry_after' => $rateLimit['retry_after']]
            );
            return;
        }

        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $customer = $this->findActiveCustomerByEmail($email);
            if ($customer !== false) {
                try {
                    $this->otpService->resend(
                        $email,
                        'QUEN_MAT_KHAU',
                        $request->ip()
                    );
                } catch (RuntimeException $error) {
                    if (str_starts_with($error->getMessage(), 'OTP_RESEND_COOLDOWN:')) {
                        $retryAfter = (int) substr(
                            $error->getMessage(),
                            strlen('OTP_RESEND_COOLDOWN:')
                        );
                        Response::error(
                            'Vui lòng chờ trước khi yêu cầu mã xác thực mới',
                            429,
                            ['retry_after' => $retryAfter]
                        );
                        return;
                    }
                    if ($error->getMessage() === 'OTP_MAX_SENDS_PER_HOUR') {
                        Response::error(
                            'Đã vượt quá số lần gửi mã xác thực cho phép',
                            429
                        );
                        return;
                    }
                    if ($error->getMessage() === 'OTP_SEND_FAILED') {
                        Logger::error('Forgot-password OTP resend failed: OTP_SEND_FAILED');
                    } elseif (!in_array(
                        $error->getMessage(),
                        ['OTP_NOT_FOUND', 'OTP_DATA_NOT_FOUND'],
                        true
                    )) {
                        throw $error;
                    }
                }
            }
        }

        $this->respondForgotPasswordGeneric();
    }

    /**
     * Đăng nhập khách hàng; mật khẩu chỉ được so sánh với hash đã lưu.
     */
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
        $rateKey = 'customer_login:' . hash('sha256', $request->ip() . "\0" . $phone);

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

                if (
                    $user === false
                    || $user['ten_vai_tro'] !== 'Customer'
                    || ((int) $user['trang_thai'] === 1 && !$passwordMatches)
                ) {
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
                        'type' => 'success',
                        'user' => [
                            'id' => (int) $user['id'],
                            'ho_ten' => $user['ho_ten'],
                            'so_dien_thoai' => $user['so_dien_thoai'],
                            'email' => $user['email'],
                            'vai_tro' => 'Customer',
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
        if ($outcome['type'] === 'account_locked') {
            Response::error('Tài khoản đã bị khóa', 403);
            return;
        }
        if ($outcome['type'] !== 'success') {
            Response::error('Số điện thoại hoặc mật khẩu không đúng', 401);
            return;
        }

        $this->startCustomerSession($outcome['user']);
        Response::success('Đăng nhập thành công', ['user' => $outcome['user']]);
    }

    /**
     * Lấy lại thông tin người dùng từ CSDL thay vì tin dữ liệu session đã cũ.
     */
    public function me(Request $request, array $params = []): void
    {
        $userId = (int) Session::get('user_id');
        $query = $this->pdo->prepare(
            'SELECT u.id, u.ho_ten, u.so_dien_thoai, u.email, u.trang_thai, v.ten_vai_tro
             FROM nguoi_dung u
             JOIN vai_tro v ON v.id = u.vai_tro_id
             WHERE u.id = ?
             LIMIT 1'
        );
        $query->execute([$userId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);

        if ($row === false || (int) $row['trang_thai'] !== 1) {
            Session::destroy();
            Response::error('Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa', 401);
            return;
        }

        $user = [
            'id' => (int) $row['id'],
            'ho_ten' => $row['ho_ten'],
            'so_dien_thoai' => $row['so_dien_thoai'],
            'email' => $row['email'],
            'vai_tro' => $row['ten_vai_tro'],
        ];
        Session::set('user_role', $user['vai_tro']);
        Session::set('auth_user', $user);
        Response::success('Thông tin tài khoản hiện tại', ['user' => $user]);
    }

    /**
     * Hủy session và cookie; gọi nhiều lần vẫn thành công.
     */
    public function logout(Request $request, array $params = []): void
    {
        Session::destroy();
        Response::success('Đăng xuất thành công');
    }

    /**
     * Gửi lại OTP đăng ký, lấy dữ liệu tạm từ yêu cầu đăng ký ban đầu.
     */
    public function resendRegistrationOtp(Request $request, array $params = []): void
    {
        $input = $request->all();
        $email = is_string($input['email'] ?? null) ? strtolower(trim($input['email'])) : '';
        $errors = $this->validator->validate(
            ['email' => $email],
            ['email' => ['required', 'email']]
        );
        if ($errors !== []) {
            Response::error('Email không hợp lệ', 422, $errors);
            return;
        }

        $existing = $this->pdo->prepare('SELECT id FROM nguoi_dung WHERE email = ? LIMIT 1');
        $existing->execute([$email]);
        if ($existing->fetchColumn() !== false) {
            Response::error('Email đã được đăng ký', 409);
            return;
        }

        try {
            $otp = $this->otpService->resend(
                $email,
                'DANG_KY',
                $request->ip(),
                true
            );
        } catch (RuntimeException $error) {
            if (in_array($error->getMessage(), ['OTP_NOT_FOUND', 'OTP_DATA_NOT_FOUND'], true)) {
                Response::error('Không tìm thấy yêu cầu đăng ký đang chờ xác thực', 404);
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
                Response::error('Đã vượt quá số lần gửi OTP cho phép, vui lòng thử lại sau', 429);
                return;
            }
            if ($error->getMessage() === 'OTP_SEND_FAILED') {
                Response::error('Không thể gửi email OTP lúc này, vui lòng thử lại sau', 500);
                return;
            }
            throw $error;
        }

        Response::success('Mã xác thực mới đã được gửi đến email', [
            'email_masked' => $this->maskEmail($email),
            'expires_in_seconds' => $otp['expires_in_seconds'],
            'expires_at' => $otp['expires_at'],
            'resend_after_seconds' => (int) $this->business['otp']['resend_cooldown_seconds'],
        ]);
    }

    private function isValidRegistrationData(?array $data, string $email): bool
    {
        if (
            $data === null
            || !is_string($data['ho_ten'] ?? null)
            || !is_string($data['so_dien_thoai'] ?? null)
            || !is_string($data['email'] ?? null)
            || !is_string($data['mat_khau'] ?? null)
            || strtolower($data['email']) !== $email
            || mb_strlen($data['ho_ten']) > 100
            || password_get_info($data['mat_khau'])['algoName'] !== 'bcrypt'
        ) {
            return false;
        }

        return $this->validator->validate($data, [
            'ho_ten' => ['required', 'name'],
            'so_dien_thoai' => ['required', 'phone'],
            'email' => ['required', 'email'],
        ]) === [];
    }

    private function findActiveCustomerByEmail(string $email, bool $forUpdate = false): array|false
    {
        $query = $this->pdo->prepare(
            'SELECT u.id
             FROM nguoi_dung u
             JOIN vai_tro v ON v.id = u.vai_tro_id
             WHERE u.email = ? AND v.ten_vai_tro = ? AND u.trang_thai = 1
             LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $query->execute([$email, 'Customer']);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    private function respondForgotPasswordGeneric(): void
    {
        Response::success('Nếu email tồn tại, mã xác thực đã được gửi');
    }

    private function consumeForgotPasswordSendLimit(string $email, string $ip): array
    {
        $maxSends = (int) ($this->business['otp']['max_sends_per_hour'] ?? 5);
        $emailKey = 'forgot_password_send:email:' . hash('sha256', $email);
        return $this->consumeForgotPasswordRateLimit(
            [
                $emailKey,
                'forgot_password_send:ip:' . hash('sha256', $ip),
            ],
            $maxSends,
            3600,
            60,
            $emailKey
        );
    }

    private function consumeForgotPasswordVerifyLimit(string $email, string $ip): array
    {
        return $this->consumeForgotPasswordRateLimit(
            [
                'forgot_password_verify:email:' . hash('sha256', $email),
                'forgot_password_verify:ip:' . hash('sha256', $ip),
            ],
            10,
            900
        );
    }

    private function consumeForgotPasswordActionLimit(string $action, string $email, string $ip): array
    {
        return $this->consumeForgotPasswordRateLimit(
            [
                $action . ':email:' . hash('sha256', $email),
                $action . ':ip:' . hash('sha256', $ip),
            ],
            10,
            900
        );
    }

    private function consumeForgotPasswordRateLimit(
        array $keys,
        int $maxAttempts,
        int $windowSeconds,
        ?int $cooldownSeconds = null,
        ?string $cooldownKey = null
    ): array {
        sort($keys, SORT_STRING);
        $this->pdo->beginTransaction();
        try {
            $insert = $this->pdo->prepare(
                'INSERT IGNORE INTO rate_limit (khoa, so_lan, bat_dau, khoa_den)
                 VALUES (?, 0, NOW(), NULL)'
            );
            foreach ($keys as $key) {
                $insert->execute([$key]);
            }

            $select = $this->pdo->prepare(
                'SELECT so_lan, TIMESTAMPDIFF(SECOND, bat_dau, NOW()) AS elapsed_seconds,
                        GREATEST(TIMESTAMPDIFF(SECOND, NOW(), khoa_den), 0) AS cooldown_seconds
                 FROM rate_limit
                 WHERE khoa = ?
                 FOR UPDATE'
            );
            $limits = [];
            foreach ($keys as $key) {
                $select->execute([$key]);
                $row = $select->fetch(PDO::FETCH_ASSOC);
                if ($row === false) {
                    throw new RuntimeException('Không thể đọc bộ đếm đặt lại mật khẩu.');
                }
                $elapsed = (int) $row['elapsed_seconds'];
                $limits[] = [
                    'key' => $key,
                    'count' => $elapsed >= $windowSeconds ? 0 : (int) $row['so_lan'],
                    'window_expired' => $elapsed >= $windowSeconds,
                    'retry_after' => $elapsed >= $windowSeconds
                        ? 0
                        : max(1, $windowSeconds - $elapsed),
                    'cooldown_seconds' => (int) $row['cooldown_seconds'],
                ];
            }

            foreach ($limits as $limit) {
                if ($limit['count'] >= $maxAttempts) {
                    $this->pdo->commit();
                    return [
                        'allowed' => false,
                        'reason' => 'rate_limited',
                        'retry_after' => $limit['retry_after'],
                    ];
                }
            }
            if ($cooldownSeconds !== null && $cooldownKey !== null) {
                foreach ($limits as $limit) {
                    if (
                        $limit['key'] === $cooldownKey
                        && $limit['cooldown_seconds'] > 0
                    ) {
                        $this->pdo->commit();
                        return [
                            'allowed' => false,
                            'reason' => 'cooldown',
                            'retry_after' => $limit['cooldown_seconds'],
                        ];
                    }
                }
            }

            $update = $this->pdo->prepare(
                'UPDATE rate_limit
                 SET so_lan = ?,
                     bat_dau = CASE WHEN ? = 1 THEN NOW() ELSE bat_dau END,
                     khoa_den = ?
                 WHERE khoa = ?'
            );
            foreach ($limits as $limit) {
                $count = $limit['count'] + 1;
                if (
                    $cooldownSeconds !== null
                    && $limit['key'] === $cooldownKey
                ) {
                    $cooldownUntil = date(
                        'Y-m-d H:i:s',
                        time() + $cooldownSeconds
                    );
                } else {
                    $cooldownUntil = null;
                }
                $update->execute([
                    $count,
                    $limit['window_expired'] ? 1 : 0,
                    $cooldownUntil,
                    $limit['key'],
                ]);
            }
            $this->pdo->commit();
            return ['allowed' => true, 'retry_after' => 0];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    private function respondToOtpFailure(array $verification): void
    {
        $reason = $verification['reason'] ?? 'OTP_NOT_FOUND';
        if ($reason === 'OTP_WRONG') {
            Response::error(
                'Mã OTP không đúng',
                422,
                [
                    'otp' => 'Mã OTP không đúng',
                    'remaining_attempts' => $verification['remaining_attempts'],
                ]
            );
            return;
        }
        if ($reason === 'OTP_INVALIDATED') {
            Response::error('Mã OTP đã hết hiệu lực do nhập sai quá số lần cho phép', 422);
            return;
        }
        if ($reason === 'OTP_EXPIRED') {
            Response::error('Mã OTP đã hết hạn, vui lòng yêu cầu mã mới', 422);
            return;
        }

        Response::error('Mã OTP không hợp lệ hoặc đã được sử dụng', 422);
    }

    private function respondToForgotPasswordOtpFailure(?int $remainingAttempts = null): void
    {
        $errors = ['otp' => 'Mã xác thực không hợp lệ hoặc đã hết hạn'];
        if ($remainingAttempts !== null) {
            $errors['remaining_attempts'] = $remainingAttempts;
        }
        Response::error('Mã xác thực không hợp lệ hoặc đã hết hạn', 422, $errors);
    }

    private function respondToInvalidResetTicket(): void
    {
        Response::error('Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 422, [
            'reset_ticket' => 'Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
        ]);
    }

    private function startCustomerSession(array $user): void
    {
        Session::regenerate();
        Session::remove('admin_pending_user_id');
        Session::remove('admin_pending_started_at');
        Session::remove('admin_pending_expires_at');
        Session::remove('admin_otp_verified');
        Session::remove('admin_otp_verified_at');
        Session::set('user_id', $user['id']);
        Session::set('user_role', $user['vai_tro']);
        Session::set('auth_user', $user);
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
}
