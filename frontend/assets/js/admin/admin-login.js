// admin-login.js - chuyển URL đăng nhập quản trị cũ sang giao diện chung.
const params = new URLSearchParams(location.search);
const originalRedirect = params.get('redirect') || params.get('redirect_to') || 'index.html';
const redirect = originalRedirect.startsWith('admin/')
  ? originalRedirect
  : `admin/${originalRedirect.split('/').pop() || 'index.html'}`;

params.delete('redirect_to');
params.set('redirect', redirect);
params.set('auth_required', '1');
location.replace(`../dang-nhap.html?${params.toString()}`);
