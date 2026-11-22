<?php
declare(strict_types=1);

/**
 * Validator đơn giản theo tên trường; dùng regex rõ ràng, dễ sửa.
 */
final class Validator
{
    public const RE_PHONE = '/^0\d{9}$/';
    public const RE_PASSWORD = '/^(?=.*[a-z])(?=.*\d).{8,}$/';
    public const RE_NAME = '/^\p{L}+(?:[\s\p{L}]+)+$/u';
    public const RE_OTP = '/^\d{6}$/';

    public function validate(array $data, array $rules): array
    {
        $errors = [];
        foreach ($rules as $field => $fieldRules) {
            $value = $data[$field] ?? null;
            foreach ($fieldRules as $rule) {
                if ($rule === 'required' && ($value === null || trim((string) $value) === '')) {
                    $errors[$field] = 'Trường này không được để trống';
                    break;
                }

                if ($value === null || $value === '') {
                    continue;
                }

                if ($rule === 'phone' && !preg_match(self::RE_PHONE, (string) $value)) {
                    $errors[$field] = 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0';
                    break;
                }
                if ($rule === 'email' && (strlen((string) $value) > 150 || filter_var($value, FILTER_VALIDATE_EMAIL) === false)) {
                    $errors[$field] = 'Email không hợp lệ';
                    break;
                }
                if ($rule === 'password' && !preg_match(self::RE_PASSWORD, (string) $value)) {
                    $errors[$field] = 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ thường và chữ số';
                    break;
                }
                if ($rule === 'name' && !preg_match(self::RE_NAME, (string) $value)) {
                    $errors[$field] = 'Họ tên phải có ít nhất hai từ và chỉ gồm chữ với khoảng trắng';
                    break;
                }
                if ($rule === 'otp' && !preg_match(self::RE_OTP, (string) $value)) {
                    $errors[$field] = 'OTP phải gồm đúng 6 chữ số';
                    break;
                }
            }
        }
        return $errors;
    }
}
