// api.js - client REST: tự gắn CSRF, parse envelope, xử lý lỗi theo mã HTTP
import { CONFIG } from './config.js';
import { toast, notImplemented } from './ui.js';

export class ApiError extends Error {
  constructor(status, message, errors = null, retryAfterSeconds = 0, isCsrf = false) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.retryAfterSeconds = retryAfterSeconds;
    this.isCsrf = isCsrf;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const isAuthPath = (path) => path === '/csrf'
  || path.startsWith('/auth/')
  || path.startsWith('/admin/auth/')
  || path === '/admin/me';

function useMock(path) {
  if (isAuthPath(path)) return CONFIG.USE_AUTH_MOCK;
  const route = path.split('?')[0];
  if (
    route === '/admin/categories'
    || route.startsWith('/admin/categories/')
    || route === '/admin/products'
    || route.startsWith('/admin/products/')
  ) return false;
  return CONFIG.USE_MOCK;
}

function parseRetryAfter(response, errors) {
  const bodyDelay = Number(errors?.retry_after ?? errors?.resend_after_seconds);
  if (Number.isFinite(bodyDelay) && bodyDelay > 0) return bodyDelay;
  const headerDelay = Number(response?.headers?.get('Retry-After'));
  return Number.isFinite(headerDelay) && headerDelay > 0 ? headerDelay : 0;
}

function isCsrfFailure(json) {
  return /csrf/i.test(String(json?.message || ''))
    || Boolean(json?.errors && Object.prototype.hasOwnProperty.call(json.errors, 'csrf'));
}

function friendlyMessage(status, json, csrfFailure = false) {
  const serverMessage = typeof json?.message === 'string' ? json.message : '';
  if (csrfFailure) return 'Phiên gửi biểu mẫu đã hết hạn. Vui lòng thử lại.';
  if (status === 401) return serverMessage || 'Bạn chưa đăng nhập hoặc thông tin đăng nhập chưa đúng.';
  if (status === 403) return serverMessage || 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 409) return serverMessage || 'Thông tin này đã được sử dụng.';
  if (status === 422) return serverMessage || 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.';
  if (status === 429) return serverMessage || 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.';
  if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  return serverMessage || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchCsrf() {
  const response = await fetch(`${CONFIG.API_BASE}/csrf`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  const json = await parseResponse(response);
  const token = json?.data?.csrf_token;
  if (!response.ok || !json?.success || typeof token !== 'string' || !token) {
    const status = response.status >= 400 ? response.status : 500;
    throw new ApiError(status, friendlyMessage(status, json), json?.errors ?? null);
  }
  return token;
}

async function fetchApi(method, path, body, csrfToken) {
  const headers = { Accept: 'application/json' };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (MUTATING_METHODS.has(method)) {
    headers['X-CSRF-Token'] = csrfToken;
    if (!isFormData) headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(CONFIG.API_BASE + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: MUTATING_METHODS.has(method)
      ? (isFormData ? body : JSON.stringify(body ?? {}))
      : undefined,
  });
  return { response, json: await parseResponse(response) };
}

async function raw(method, path, body) {
  if (useMock(path)) {
    const { handle } = await import('./mock.js');
    const r = await handle(method, path, body);
    return { status: r.status ?? 200, json: r, response: null };
  }

  if (!MUTATING_METHODS.has(method)) {
    const { response, json } = await fetchApi(method, path, body);
    return { status: response.status, json, response };
  }

  let token = await fetchCsrf();
  let result = await fetchApi(method, path, body, token);
  if (result.response.status === 403 && isCsrfFailure(result.json)) {
    token = await fetchCsrf();
    result = await fetchApi(method, path, body, token);
  }
  return { status: result.response.status, json: result.json, response: result.response };
}

/** Trả về `data` khi thành công; ném ApiError khi thất bại. */
export async function request(method, path, body) {
  let out;
  try { out = await raw(method, path, body); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Không thể kết nối máy chủ. Vui lòng thử lại.');
  }
  const { status, json } = out;
  if (status >= 200 && status < 300 && json?.success) return json.data;
  const errors = json?.errors ?? null;
  const csrfFailure = status === 403 && isCsrfFailure(json);
  if (
    status === 401
    && path.startsWith('/admin/')
    && !path.startsWith('/admin/auth/')
    && typeof window !== 'undefined'
  ) {
    window.dispatchEvent(new CustomEvent('ms:admin-session-expired'));
  }
  if (status === 501 && !isAuthPath(path)) notImplemented();
  throw new ApiError(
    status,
    friendlyMessage(status, json, csrfFailure),
    errors,
    parseRetryAfter(out.response, errors),
    csrfFailure,
  );
}
export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  patch: (p, b = {}) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};
