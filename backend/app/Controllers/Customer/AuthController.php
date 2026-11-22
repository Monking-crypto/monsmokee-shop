<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\OtpService;
use PDO;
use PDOException;
use Request;
use Response;
use RuntimeException;
use Validator;

/**
 * Endpoint xác thực dành cho khách hàng.
 */
final class AuthController
{
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
