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
export function formatPromotionDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/.exec(raw);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year)
      || date.getUTCMonth() + 1 !== Number(month)
      || date.getUTCDate() !== Number(day)
      || (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59))) return '';
    const formattedDate = `${day}/${month}/${year}`;
    return hour === undefined ? formattedDate : `${formattedDate} ${hour}:${minute}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  const formattedDate = `${parts.day}/${parts.month}/${parts.year}`;
  return /[T ]\d{2}:\d{2}/.test(raw)
    ? `${formattedDate} ${parts.hour}:${parts.minute}`
    : formattedDate;
}
export function removeAccents(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
export const normalizeKeyword = (s) => removeAccents(s).toLowerCase().replace(/\s+/g, ' ').trim();
export function maskEmail(email) {
  const [u = '', d = ''] = String(email).split('@');
  return `${u.slice(0, 2)}***@${d}`;
}
