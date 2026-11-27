// admin-layout.js - xác thực phiên rồi tải dữ liệu trang quản trị
import './admin-shell.js';
import { requireAdmin } from '../core/guard.js';
import { api } from '../core/api.js';
import { escapeHtml, qs, toast } from '../core/ui.js';

const shell = window.MSAdminShell;
const page = shell?.page || document.body.dataset.page || 'overview';
const title = shell?.title || 'Quản trị';
const content = qs('#admin-page-content');
const adminUser = await requireAdmin();

if (adminUser) {
  if (typeof adminUser === 'object' && adminUser.ho_ten) {
    qs('#admin-role-name').textContent = adminUser.ho_ten;
  }
  window.addEventListener('ms:admin-session-expired', () => {
    const target = `admin/${location.pathname.split('/').pop()}${location.search}`;
    location.replace(`../dang-nhap.html?${new URLSearchParams({ redirect: target, auth_required: '1' })}`);
  }, { once: true });
  window.addEventListener('ms:admin-profile-updated', (event) => {
    const name = event.detail?.ho_ten?.trim();
    if (name) qs('#admin-role-name').textContent = name;
  });

  async function loadPage() {
    if (page === 'overview') await import('./dashboard.js');
    else if (page === 'categories') await import('./categories.js');
    else if (page === 'products') await import('./products.js');
    else if (page === 'promotions') await import('./promotions.js');
    else if (page === 'delivery-areas') await import('./delivery-areas.js');
    else if (page === 'orders') await import('./orders.js');
    else if (page === 'order-detail') await import('./order-detail.js');
    else if (page.startsWith('stock-')) await import('./inventory.js');
    else if (page === 'customers') await import('./customers.js');
    else if (page === 'statistics') await import('./statistics.js');
    else if (page === 'account') await import('./account.js');
    else {
      content.innerHTML = `<div class="admin-breadcrumb">Quản trị <span>/</span> ${escapeHtml(title)}</div>
        <section class="admin-placeholder"><i class="bi bi-cone-striped" aria-hidden="true"></i><h2>Đang phát triển</h2></section>`;
    }
  }

  async function updatePendingCount() {
    try {
      const pending = await api.get('/admin/orders?status=cho_xu_ly&page=1&per_page=1');
      if (Number.isFinite(Number(pending.total)) && Number(pending.total) >= 0) {
        shell?.setPendingCount(pending.total);
      }
    } catch (error) {
      if (error?.status === 0) toast('Không tải được số đơn chờ xử lý.', 'error');
    }
  }

  const pageTask = loadPage().catch((error) => {
    content.innerHTML = `<div class="ms-state"><strong>Không tải được trang quản trị</strong>${escapeHtml(error?.message || 'Vui lòng thử lại.')}</div>`;
    toast(error?.message || 'Không tải được trang quản trị.', 'error');
  });
  await Promise.all([pageTask, updatePendingCount()]);
  content.setAttribute('aria-busy', 'false');
}
