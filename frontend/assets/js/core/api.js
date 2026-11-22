// api.js - client REST: tự gắn CSRF, parse envelope, xử lý lỗi theo mã HTTP (mục 11.3)
import { CONFIG } from './config.js';
import { toast, notImplemented } from './ui.js';

export class ApiError extends Error {
  constructor(status, message, errors = null) { super(message); this.status = status; this.errors = errors; }
}
let csrfToken = null;

async function raw(method, path, body) {
  if (CONFIG.USE_MOCK) {
    const { handle } = await import('./mock.js');
    const r = await handle(method, path, body);
    return { status: r.status ?? 200, json: r };
  }
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    if (!csrfToken) csrfToken = (await request('GET', '/csrf')).token;
    headers['X-CSRF-Token'] = csrfToken;
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(CONFIG.API_BASE + path, {
    method, headers, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** Trả về `data` khi thành công; ném ApiError khi thất bại. */
export async function request(method, path, body) {
  let out;
  try { out = await raw(method, path, body); }
  catch { toast('Không kết nối được máy chủ. Vui lòng thử lại.', 'error'); throw new ApiError(0, 'network'); }
  const { status, json } = out;
  if (json?.success) return json.data;
  const msg = json?.message || 'Có lỗi xảy ra';
  if (status === 401 && !/\/auth\/(login|me)/.test(path)) {
    const page = path.startsWith('/admin/') ? 'login.html' : 'dang-nhap.html';
    const target = location.pathname.includes('/admin/') ? location.pathname.split('/').pop() + location.search : location.pathname.split('/').pop() + location.search;
    location.href = `${page}?redirect=${encodeURIComponent(target)}`;
  } else if (status === 403) toast('Bạn không có quyền thực hiện thao tác này', 'error');
  else if (status === 429) toast(msg || 'Bạn thao tác quá nhanh, vui lòng chờ một lúc', 'error');
  else if (status === 501) notImplemented();
  throw new ApiError(status, msg, json?.errors ?? null);
}
export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};
