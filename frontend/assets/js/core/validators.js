// validators.js - phản chiếu Validator.php (mục 11.2)
export const RE_PHONE = /^0\d{9}$/;
export const RE_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const RE_NAME = /^\p{L}+(?:[\s\p{L}]+)+$/u;
export const RE_OTP = /^\d{6}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const passwordChecks = (v) => ({
  len: v.length >= 8, lower: /[a-z]/.test(v), upper: /[A-Z]/.test(v), digit: /\d/.test(v), special: /[^A-Za-z0-9]/.test(v),
});

/** Mỗi hàm trả về chuỗi lỗi, hoặc '' nếu hợp lệ. */
export const rules = {
  ho_ten: (v) => (!v.trim() ? 'Vui lòng nhập họ tên' : RE_NAME.test(v.trim()) ? '' : 'Họ tên gồm ít nhất 2 từ, chỉ chứa chữ cái'),
  so_dien_thoai: (v) => (!v.trim() ? 'Vui lòng nhập số điện thoại' : RE_PHONE.test(v.trim()) ? '' : 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'),
  email: (v) => (!v.trim() ? 'Vui lòng nhập email' : v.length <= 150 && RE_EMAIL.test(v.trim()) ? '' : 'Email chưa đúng định dạng'),
  mat_khau: (v) => (!v ? 'Vui lòng nhập mật khẩu' : RE_PASSWORD.test(v) ? '' : 'Mật khẩu chưa đủ mạnh, xem các tiêu chí bên dưới'),
};
