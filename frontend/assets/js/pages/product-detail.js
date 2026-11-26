// product-detail.js - thông tin chi tiết sản phẩm
import { api, ApiError } from '../core/api.js';
import { escapeHtml, qs, setBusy, toast } from '../core/ui.js';
import { formatDate, formatVnd } from '../core/format.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';

const root = qs('#product-detail-app');
const id = new URLSearchParams(location.search).get('id');

function renderLoading() {
  root.setAttribute('aria-busy', 'true');
  root.innerHTML = '<div class="detail-skeleton" aria-hidden="true"><div></div><div></div></div>';
}

function renderState(title, message, error = false) {
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<section class="detail-state${error ? ' detail-state--error' : ''}">
    <span class="detail-state__icon"><i class="bi ${error ? 'bi-exclamation-circle' : 'bi-box-seam'}" aria-hidden="true"></i></span>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="detail-state__actions">
      ${error ? '<button class="ms-btn ms-btn--green" id="detail-retry" type="button">Thử lại</button>' : ''}
      <a class="ms-btn ms-btn--green" href="san-pham.html">Tiếp tục mua sắm</a>
    </div>
  </section>`;
  qs('#detail-retry')?.addEventListener('click', loadProduct);
}

function imageUrl(path) {
  const value = String(path || '').trim();
  if (!value || value === 'placeholder-product.svg') return 'assets/img/placeholder-product.svg';
  if (/^(https?:|data:|blob:)/i.test(value) || value.startsWith('/')) return value;
  return value.startsWith('uploads/') ? `../backend/${value}` : value;
}

function renderProduct(product) {
  const originalPrice = Number(product.gia_goc ?? product.gia_ban ?? product.gia);
  const currentPrice = Number(product.gia_ban_hieu_luc ?? product.gia_hieu_luc ?? product.gia_ban ?? product.gia);
  const discount = Math.max(0, Number(product.phan_tram_giam) || 0);
  const available = product.con_hang !== undefined
    ? Boolean(product.con_hang)
    : Number(product.so_luong_ton) > 0;
  const category = product.danh_muc && typeof product.danh_muc === 'object' ? product.danh_muc : {};
  const categoryName = category.ten_danh_muc || product.ten_danh_muc || '';
  const image = imageUrl(product.anh || product.hinh_anh || product.anh_thumb);
  const description = String(product.mo_ta || '').trim();
  const expiry = product.nhan_khuyen_mai === 'CAN_HAN' && product.han_su_dung
    ? `<p class="detail-expiry"><i class="bi bi-calendar-check" aria-hidden="true"></i> Hạn sử dụng: ${escapeHtml(formatDate(product.han_su_dung))}</p>`
    : '';
  const safeName = escapeHtml(product.ten_san_pham || product.ten || 'Sản phẩm');

  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `<nav class="detail-breadcrumb" aria-label="Đường dẫn">
      <a href="index.html">Trang chủ</a><i class="bi bi-chevron-right" aria-hidden="true"></i>
      <a href="san-pham.html${category.slug ? `?category=${encodeURIComponent(category.slug)}` : ''}">${escapeHtml(categoryName || 'Sản phẩm')}</a>
      <i class="bi bi-chevron-right" aria-hidden="true"></i><span>${safeName}</span>
    </nav>
    <article class="detail-layout">
      <div class="detail-gallery">
        <div class="detail-gallery__image"><img id="detail-image" src="${escapeHtml(image)}" alt="${safeName}"></div>
      </div>
      <section class="detail-info" aria-labelledby="detail-title">
        ${categoryName ? `<a class="detail-category" href="san-pham.html${category.slug ? `?category=${encodeURIComponent(category.slug)}` : ''}">${escapeHtml(categoryName)}</a>` : ''}
        <h1 id="detail-title">${safeName}</h1>
        <div class="detail-meta">
          ${product.don_vi_tinh ? `<span>Đơn vị: ${escapeHtml(product.don_vi_tinh)}</span>` : ''}
          <span class="detail-stock${available ? '' : ' is-out'}"><i class="bi ${available ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}" aria-hidden="true"></i> ${available ? 'Còn hàng' : 'Hết hàng'}</span>
        </div>
        <div class="detail-price">
          <strong class="detail-price__current">${formatVnd(currentPrice)}</strong>
          ${discount > 0 ? `<del class="detail-price__old">${formatVnd(originalPrice)}</del><span class="detail-price__discount">-${discount}%</span>` : ''}
        </div>
        ${expiry}
        <section class="detail-description" aria-labelledby="detail-description-title">
          <h2 id="detail-description-title">Thông tin sản phẩm</h2>
          <p>${description ? escapeHtml(description).replace(/\r?\n/g, '<br>') : 'Thông tin mô tả cho sản phẩm hiện chưa được cập nhật.'}</p>
        </section>
        <section class="detail-order" aria-label="Thêm sản phẩm vào giỏ hàng">
          <div class="detail-order__controls">
            <label for="detail-quantity">Số lượng</label>
            <div class="detail-quantity">
              <button type="button" data-quantity="-1" aria-label="Giảm số lượng" ${available ? '' : 'disabled'}>−</button>
              <input id="detail-quantity" type="number" min="1" max="99" value="1" inputmode="numeric" ${available ? '' : 'disabled'}>
              <button type="button" data-quantity="1" aria-label="Tăng số lượng" ${available ? '' : 'disabled'}>+</button>
            </div>
          </div>
          <div class="detail-order__actions">
            <button id="detail-add" class="ms-btn ms-btn--green" type="button" ${available ? '' : 'disabled'}><i class="bi bi-cart-plus" aria-hidden="true"></i> ${available ? 'Thêm vào giỏ hàng' : 'Sản phẩm hết hàng'}</button>
            <a class="detail-order__cart" href="gio-hang.html" aria-label="Xem giỏ hàng"><i class="bi bi-cart3" aria-hidden="true"></i></a>
          </div>
          <p class="detail-order__notice">Giá và tình trạng hàng có thể thay đổi theo thời điểm đặt hàng.</p>
        </section>
      </section>
    </article>`;

  const imageElement = qs('#detail-image');
  imageElement.addEventListener('error', () => {
    if (imageElement.src.endsWith('/assets/img/placeholder-product.svg')) return;
    imageElement.src = 'assets/img/placeholder-product.svg';
  }, { once: true });

  const quantityInput = qs('#detail-quantity');
  root.querySelectorAll('[data-quantity]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = Number(quantityInput.value) + Number(button.dataset.quantity);
      quantityInput.value = String(Math.max(1, Math.min(99, Number.isFinite(next) ? next : 1)));
    });
  });
  quantityInput.addEventListener('change', () => {
    const quantity = Number(quantityInput.value);
    quantityInput.value = String(Math.max(1, Math.min(99, Number.isInteger(quantity) ? quantity : 1)));
  });
  qs('#detail-add').addEventListener('click', addToCart);
}

async function addToCart(event) {
  const quantity = Number(qs('#detail-quantity').value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    toast('Số lượng phải từ 1 đến 99.', 'error');
    return;
  }
  const button = event.currentTarget;
  setBusy(button, true);
  try {
    const result = await api.post('/cart/items', { san_pham_id: Number(id), so_luong: quantity });
    document.dispatchEvent(new CustomEvent('ms:cart', { detail: { count: result.count } }));
    toast('Đã thêm vào giỏ hàng');
  } catch (error) {
    if (error instanceof ApiError && error.status === 501) return;
    toast(error instanceof ApiError ? error.message : 'Không thể thêm sản phẩm vào giỏ. Vui lòng thử lại.', 'error');
  } finally {
    setBusy(button, false);
  }
}

async function loadProduct() {
  if (!id || !/^[1-9]\d*$/.test(id)) {
    renderState('Không tìm thấy sản phẩm', 'Đường dẫn sản phẩm không hợp lệ.');
    return;
  }
  renderLoading();
  try {
    const data = await api.get(`/products/${encodeURIComponent(id)}`);
    if (!data?.product || typeof data.product !== 'object') {
      renderState('Không tìm thấy sản phẩm', 'Sản phẩm có thể đã bị ẩn hoặc không còn tồn tại.');
      return;
    }
    renderProduct(data.product);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      renderState('Không tìm thấy sản phẩm', 'Sản phẩm có thể đã bị ẩn hoặc không còn tồn tại.');
      return;
    }
    renderState('Chưa tải được sản phẩm', error instanceof ApiError ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.', true);
  }
}

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'), 'category');
await loadProduct();
