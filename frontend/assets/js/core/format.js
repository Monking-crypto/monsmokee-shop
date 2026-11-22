// format.js - định dạng tiền, ngày, bỏ dấu tiếng Việt
const vnd = new Intl.NumberFormat('vi-VN');
export const formatVnd = (n) => `${vnd.format(Math.round(Number(n) || 0))}đ`;
const p2 = (n) => String(n).padStart(2, '0');
export function formatDate(value, withTime = false) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} ${p2(d.getHours())}:${p2(d.getMinutes())}` : date;
}
export function removeAccents(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
export const normalizeKeyword = (s) => removeAccents(s).toLowerCase().replace(/\s+/g, ' ').trim();
export function maskEmail(email) {
  const [u = '', d = ''] = String(email).split('@');
  return `${u.slice(0, 2)}***@${d}`;
}
