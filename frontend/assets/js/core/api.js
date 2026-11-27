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
    this.code = typeof errors?.code === 'string' ? errors.code : null;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const isAuthPath = (path) => path === '/csrf'
  || path.startsWith('/auth/')
  || path.startsWith('/admin/auth/')
  || path === '/admin/me'
  || path.startsWith('/admin/me/');

let serverOffsetMs = 0;

function developmentFriday() {
  if (typeof location === 'undefined'
    || (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')) return '';
  let override = '';
  try { override = localStorage.getItem('ms_dev_friday') || ''; } catch { return ''; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(override)) return '';
  const [year, month, day] = override.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCDay() === 5
    ? override
    : '';
}

export function serverNow() {
  const override = developmentFriday();
  return override ? new Date(`${override}T12:00:00+07:00`) : new Date(Date.now() + serverOffsetMs);
}

function recordServerTime(response) {
  const dateHeader = response?.headers?.get('Date');
  if (!dateHeader) return;
  const serverTime = Date.parse(dateHeader);
  if (Number.isFinite(serverTime)) serverOffsetMs = serverTime - Date.now();
}

function useMock(path) {
  if (isAuthPath(path)) return CONFIG.USE_AUTH_MOCK;
  const route = path.split('?')[0];
  if (route === '/categories' || route === '/products' || /^\/products\/\d+$/.test(route)) {
    return !CONFIG.LIVE.catalog;
  }
  if (route === '/promotions/active') return !CONFIG.LIVE.promotions;
  if (route === '/store-info') return !CONFIG.LIVE.store;
  if (route === '/shipping/areas' || route === '/shipping/quote') return !CONFIG.LIVE.shipping;
  if (route === '/admin/stock-receipts' || route.startsWith('/admin/stock-receipts/')
    || route === '/admin/batches' || route === '/admin/stock-history') {
    return !CONFIG.LIVE.adminInventory;
  }
  if (route === '/admin/promotions' || route.startsWith('/admin/promotions/')) {
    return !CONFIG.LIVE.adminPromotions;
  }
  if (route === '/admin/delivery-areas' || route.startsWith('/admin/delivery-areas/')) {
    return !CONFIG.LIVE.adminDeliveryAreas;
  }
  if (
    route === '/admin/me'
    || route.startsWith('/admin/me/')
    || route === '/admin/categories'
    || route.startsWith('/admin/categories/')
    || route === '/admin/products'
    || route.startsWith('/admin/products/')
  ) return false;
  return CONFIG.USE_MOCK;
}

function developmentDate(path, method) {
  if (method !== 'GET' || !/^\/(?:products(?:\/\d+)?|promotions\/active)(?:\?|$)/.test(path)) {
    return path;
  }
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return path;
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  if (params.has('now')) return path;
  const override = developmentFriday();
  if (!override) return path;
  params.set('now', override);
  return `${route}?${params.toString()}`;
}

function parseRetryAfter(response, errors) {
  const bodyDelay = Number(errors?.retry_after ?? errors?.resend_after_seconds);
  if (Number.isFinite(bodyDelay) && bodyDelay > 0) return bodyDelay;
  const headerDelay = Number(response?.headers?.get('Retry-After'));
  return Number.isFinite(headerDelay) && headerDelay > 0 ? headerDelay : 0;
}

function isCsrfFailure(json) {
  return json?.errors?.code === 'CSRF_INVALID';
}

function friendlyMessage(status, json, csrfFailure = false) {
  const serverMessage = typeof json?.message === 'string' ? json.message : '';
  if (csrfFailure) return 'Phiên gửi biểu mẫu đã hết hạn. Vui lòng thử lại.';
  if (status === 401) return serverMessage || 'Bạn chưa đăng nhập hoặc thông tin đăng nhập chưa đúng.';
  if (status === 403) return serverMessage || 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 409) return serverMessage || 'Thông tin này đã được sử dụng.';
  if (status === 422) return serverMessage || 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.';
  if (status === 429) return serverMessage || 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.';
  if (status === 404 || status === 405) return serverMessage || 'Tính năng này chưa được backend hỗ trợ.';
  if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  return serverMessage || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

function handleExpiredSession(path) {
  if (typeof window === 'undefined') return;
  const isAdmin = path.startsWith('/admin/');
  localStorage.removeItem(isAdmin ? 'ms_mock_adminAuth' : 'ms_mock_me');
  if (isAdmin) {
    localStorage.removeItem('ms_mock_adminPending');
    localStorage.removeItem('ms_mock_adminPendingAt');
    localStorage.removeItem('ms_mock_adminWrong');
  }
  const frontendIndex = location.pathname.indexOf('/frontend/');
  const frontendRoot = frontendIndex >= 0
    ? `${location.pathname.slice(0, frontendIndex)}/frontend`
    : '';
  const currentPath = frontendIndex >= 0
    ? location.pathname.slice(frontendIndex + '/frontend/'.length)
    : '';
  const destination = currentPath.startsWith('admin/')
    ? `${currentPath}${location.search}`
    : new URLSearchParams(location.search).get('redirect')
      || new URLSearchParams(location.search).get('redirect_to');
  const redirect = destination
    ? `?${new URLSearchParams({
      redirect: destination,
      auth_required: '1',
    })}`
    : '';
  window.location.replace(`${frontendRoot}/dang-nhap.html${redirect}`);
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
  recordServerTime(response);
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
  recordServerTime(response);
  return { response, json: await parseResponse(response) };
}

async function raw(method, path, body) {
  path = developmentDate(path, method);
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
  if (status === 401 && errors?.code === 'SESSION_EXPIRED') {
    handleExpiredSession(path);
    if (path.startsWith('/admin/')) {
      window.dispatchEvent(new CustomEvent('ms:admin-session-expired'));
    }
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
