// cart.js - giỏ hàng khách hàng, phí giao hàng và xác nhận thao tác xóa
import { api, ApiError } from '../core/api.js';
import { CONFIG } from '../core/config.js';
import { escapeHtml, qs, toast } from '../core/ui.js';
import { formatVnd } from '../core/format.js';
import { mountHeader } from '../components/header.js';
import { mountFooter } from '../components/footer.js';
import { mountBottomNav } from '../components/bottom-nav.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { imageUrl } from '../core/catalog.js';

const root = qs('#cart-app');
let cart = null;
let fulfillment = localStorage.getItem('ms_fulfillment') || 'delivery';
let busy = false;
let shippingQuote = null;
let shippingQuoteError = '';
let shippingQuoteLoading = false;

function deliveryAddress() {
  try { return JSON.parse(localStorage.getItem('ms_delivery') || 'null'); }
  catch { return null; }
}

function syncBadge() {
  document.dispatchEvent(new CustomEvent('ms:cart', { detail: { count: Number(cart?.count) || 0 } }));
}

function renderSkeleton() {
  root.innerHTML = `<div class="cart-layout" aria-hidden="true">
    <div class="cart-skeleton-list"><div class="cart-skeleton"></div><div class="cart-skeleton"></div></div>
    <div class="cart-skeleton cart-skeleton--summary"></div></div>`;
}

function emptyCart() {
  root.innerHTML = `<section class="cart-empty"><i class="bi bi-cart-x" aria-hidden="true"></i>
    <h2>Giỏ hàng đang trống</h2><p>Chọn vài món ngon và tiện lợi từ cửa hàng nhé.</p>
    <a class="ms-btn ms-btn--green" href="san-pham.html">Quay lại mua sắm</a></section>`;
}

function productRow(item) {
  const product = item.san_pham;
  const stock = Math.max(0, Number(product.so_luong_ton) || 0);
  const quantity = Number(item.so_luong) || 1;
  const insufficient = stock < quantity;
  const out = stock === 0;
  const discounted = Number(product.phan_tram_giam) > 0;
  const href = `chi-tiet-san-pham.html?id=${encodeURIComponent(product.id)}`;
  return `<article class="cart-row${insufficient ? ' is-unavailable' : ''}" data-cart-row="${escapeHtml(product.id)}">
    <a class="cart-row__image" href="${href}"><img src="${escapeHtml(imageUrl(product.anh_thumb || product.hinh_anh || product.anh))}" alt="" loading="lazy" decoding="async"></a>
    <div class="cart-row__details">
      <a class="cart-row__name" href="${href}">${escapeHtml(product.ten_san_pham)}</a>
      <span class="cart-row__unit">Đơn vị: ${escapeHtml(product.don_vi_tinh || '')}</span>
      <div class="shelf-tag${discounted ? ' is-sale' : ''}"><span class="shelf-tag__price">${formatVnd(item.don_gia)}</span>
        ${discounted ? `<s class="shelf-tag__old">${formatVnd(product.gia_ban)}</s>` : ''}</div>
      <span class="cart-row__warning" ${insufficient ? '' : 'hidden'}>${out ? 'Sản phẩm hiện đã hết hàng.' : `Chỉ còn ${stock} sản phẩm trong kho. Vui lòng giảm số lượng.`}</span>
    </div>
    <div class="cart-row__controls">
      <div class="qty" role="group" aria-label="Số lượng ${escapeHtml(product.ten_san_pham)}">
        <button type="button" data-action="decrease" data-id="${escapeHtml(product.id)}" aria-label="Giảm số lượng" ${quantity <= 1 || out || busy ? 'disabled' : ''}>−</button>
        <input type="number" min="1" max="${Math.max(stock, 1)}" value="${quantity}" data-action="quantity" data-id="${escapeHtml(product.id)}"
          aria-label="Số lượng ${escapeHtml(product.ten_san_pham)}" ${out || busy ? 'disabled' : ''}>
        <button type="button" data-action="increase" data-id="${escapeHtml(product.id)}" aria-label="Tăng số lượng" ${quantity >= stock || out || busy ? 'disabled' : ''}>+</button>
      </div>
      <strong class="cart-row__line-total">${formatVnd(item.thanh_tien)}</strong>
      <button type="button" class="cart-row__remove" data-action="remove" data-id="${escapeHtml(product.id)}" ${busy ? 'disabled' : ''}>Xóa</button>
    </div>
  </article>`;
}

function summary() {
  const address = deliveryAddress();
  const subtotal = Math.max(0, Number(cart.tam_tinh) || 0);
  const discount = Math.max(0, Number(cart.giam_gia) || 0);
  const payableGoods = Math.max(0, subtotal - discount);
  const fee = fulfillment === 'pickup' ? 0 : shippingQuote?.phi_ship_tam_tinh;
  const feeKnown = fulfillment === 'pickup'
    || (Number.isFinite(Number(fee)) && fee !== null && shippingQuote?.giao_duoc === true);
  const total = payableGoods + (feeKnown ? Number(fee) : 0);
  const addressMissing = fulfillment === 'delivery' && !Number(address?.khu_vuc_id);
  const deliveryUnavailable = fulfillment === 'delivery' && shippingQuote?.giao_duoc === false;
  const quoteMissing = fulfillment === 'delivery' && !addressMissing && !shippingQuote;
  const inventoryMissing = cart.items.some((item) => Number(item.san_pham.so_luong_ton) < Number(item.so_luong));
  const orderDisabled = busy || addressMissing || quoteMissing || shippingQuoteLoading || deliveryUnavailable || inventoryMissing;
  const orderWarning = addressMissing
    ? 'Hãy chọn khu vực giao hàng để kiểm tra khả năng phục vụ.'
    : deliveryUnavailable
      ? shippingQuote?.ly_do || 'Khu vực này hiện chưa hỗ trợ giao hàng.'
      : shippingQuoteError
        ? shippingQuoteError
        : inventoryMissing ? 'Có sản phẩm hết hàng hoặc vượt tồn kho. Hãy cập nhật giỏ hàng trước khi đặt.' : '';
  const shippingLine = fulfillment === 'pickup'
    ? '0đ · Nhận tại cửa hàng'
    : shippingQuoteLoading
      ? 'Đang tính phí…'
      : shippingQuoteError
        ? 'Không tính được phí giao hàng'
        : shippingQuote
          ? `${formatVnd(shippingQuote.phi_ship_tam_tinh)}${shippingQuote.ly_do ? `<small>${escapeHtml(shippingQuote.ly_do)}</small>` : ''}`
          : 'Chọn khu vực giao hàng để tính phí';
  return `<aside class="cart-summary">
    <h2>Tóm tắt đơn hàng</h2>
    <fieldset class="cart-fulfillment"><legend>Hình thức nhận hàng</legend>
      <label><input type="radio" name="fulfillment" value="delivery" ${fulfillment === 'delivery' ? 'checked' : ''}> Giao hàng</label>
      <label><input type="radio" name="fulfillment" value="pickup" ${fulfillment === 'pickup' ? 'checked' : ''}> Nhận tại cửa hàng</label>
    </fieldset>
    ${fulfillment === 'delivery' ? `<div class="cart-address">
      ${address?.short ? `<span>Địa chỉ: ${escapeHtml(address.short)}</span>` : '<span>Chọn khu vực giao hàng để tính phí</span>'}
      ${addressMissing ? '<button type="button" class="link-btn" data-action="choose-address">Chọn khu vực giao hàng</button>' : ''}
    </div>` : '<p class="cart-address">Nhận tại cửa hàng, không tính phí giao hàng.</p>'}
    <div class="cart-summary__lines">
      <div><span>Tạm tính</span><strong>${formatVnd(subtotal)}</strong></div>
      <div><span>Giảm giá</span><strong>−${formatVnd(discount)}</strong></div>
      <div><span>Phí giao hàng tạm tính</span><strong>${shippingLine}</strong></div>
      <div class="cart-summary__total"><span>Tổng cộng</span><strong>${formatVnd(total)}</strong></div>
    </div>
    ${fulfillment === 'delivery' && shippingQuote ? `<div class="cart-freeship"><p>${shippingQuote.mien_phi ? 'Đơn hàng được miễn phí giao hàng.' : 'Đơn hàng có tính phí giao hàng.'}</p>
      ${shippingQuote.cho_phep_cod ? '<p>Địa chỉ hỗ trợ thanh toán COD.</p>' : shippingQuote.ly_do_khong_cod ? `<p>${escapeHtml(shippingQuote.ly_do_khong_cod)}</p>` : ''}</div>` : ''}
    ${shippingQuoteError ? '<button type="button" class="link-btn" data-action="retry-quote">Thử tính phí lại</button>' : ''}
    ${orderWarning ? `<p class="cart-order-warning" role="alert">${orderWarning}</p>` : ''}
    <button type="button" class="ms-btn ms-btn--green ms-btn--block" data-action="checkout" ${orderDisabled ? 'disabled' : ''}>Tiến hành đặt hàng</button>
    <button type="button" class="cart-clear" data-action="clear" ${busy ? 'disabled' : ''}>Xóa giỏ hàng</button>
  </aside>`;
}

function render() {
  if (!cart?.items?.length) return emptyCart();
  root.innerHTML = `<div class="cart-layout">
    <section class="cart-items" aria-label="Sản phẩm trong giỏ">
      <div class="cart-items__heading"><h2>${cart.items.length} mặt hàng</h2></div>
      ${cart.items.map(productRow).join('')}
    </section>
    ${summary()}
  </div>`;
}

async function loadCart() {
  renderSkeleton();
  try {
    cart = await api.get('/cart');
    await refreshShippingQuote();
    syncBadge();
    render();
  } catch (error) {
    root.innerHTML = `<div class="ms-state"><strong>Không tải được giỏ hàng</strong>${escapeHtml(error.message)}<div class="mt-3"><button class="ms-btn ms-btn--green" id="cart-retry" type="button">Thử lại</button></div></div>`;
    qs('#cart-retry').addEventListener('click', loadCart);
  }
}

async function refreshShippingQuote() {
  shippingQuote = null;
  shippingQuoteError = '';
  const address = deliveryAddress();
  if (fulfillment !== 'delivery' || !cart || !address?.khu_vuc_id) {
    shippingQuoteLoading = false;
    return;
  }
  shippingQuoteLoading = true;
  try {
    shippingQuote = await api.post('/shipping/quote', {
      khu_vuc_id: Number(address.khu_vuc_id),
      tien_hang_sau_giam: Math.max(0, Math.trunc(Number(cart.tam_tinh) - Number(cart.giam_gia))),
    });
  } catch (error) {
    shippingQuoteError = error instanceof ApiError
      ? error.message
      : 'Không thể tính phí giao hàng. Vui lòng thử lại.';
  } finally {
    shippingQuoteLoading = false;
  }
}

async function updateQuantity(id, quantity) {
  const item = cart.items.find((entry) => Number(entry.san_pham.id) === Number(id));
  if (!item) return;
  const stock = Math.max(0, Number(item.san_pham.so_luong_ton) || 0);
  if (!Number.isInteger(quantity) || quantity < 1) {
    toast('Số lượng tối thiểu là 1.', 'error');
    render();
    return;
  }
  if (quantity > stock) {
    toast(`Chỉ còn ${stock} sản phẩm trong kho.`, 'error');
    render();
    return;
  }
  busy = true;
  render();
  try {
    cart = await api.put(`/cart/items/${id}`, { so_luong: quantity });
    await refreshShippingQuote();
    syncBadge();
  } catch (error) {
    if (error instanceof ApiError && error.status) toast(error.message, 'error');
  } finally {
    busy = false;
    render();
  }
}

root.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action]');
  if (!control || busy) return;
  const { action, id } = control.dataset;
  if (action === 'increase' || action === 'decrease') {
    const item = cart.items.find((entry) => Number(entry.san_pham.id) === Number(id));
    if (item) await updateQuantity(id, Number(item.so_luong) + (action === 'increase' ? 1 : -1));
  } else if (action === 'remove') {
    const item = cart.items.find((entry) => Number(entry.san_pham.id) === Number(id));
    if (!item) return;
    const { confirmed } = await confirmDialog({
      title: 'Xóa sản phẩm?',
      message: `Xóa ${item.san_pham.ten_san_pham} khỏi giỏ hàng?`,
      confirmText: 'Xóa sản phẩm',
    });
    if (!confirmed) return;
    busy = true;
    try { cart = await api.del(`/cart/items/${id}`); await refreshShippingQuote(); syncBadge(); toast('Đã xóa sản phẩm khỏi giỏ hàng'); }
    catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
    finally { busy = false; render(); }
  } else if (action === 'clear') {
    const { confirmed } = await confirmDialog({
      title: 'Xóa giỏ hàng?',
      message: 'Bạn có chắc chắn muốn xóa tất cả sản phẩm trong giỏ hàng?',
      confirmText: 'Xóa giỏ hàng',
    });
    if (!confirmed) return;
    busy = true;
    try { cart = await api.del('/cart'); await refreshShippingQuote(); syncBadge(); toast('Đã xóa giỏ hàng'); }
    catch (error) { if (error instanceof ApiError && error.status) toast(error.message, 'error'); }
    finally { busy = false; render(); }
  } else if (action === 'choose-address') {
    document.getElementById('delivery-open')?.click();
  } else if (action === 'retry-quote') {
    await refreshShippingQuote();
    render();
  } else if (action === 'checkout') {
    try {
      const { user } = await api.get('/auth/me');
      if (!user) location.assign('dang-nhap.html?redirect=thanh-toan.html');
      else location.assign('thanh-toan.html');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) location.assign('dang-nhap.html?redirect=thanh-toan.html');
      else if (error instanceof ApiError && error.status) toast(error.message, 'error');
    }
  }
});

root.addEventListener('change', async (event) => {
  if (event.target.matches('[data-action="quantity"]')) {
    await updateQuantity(event.target.dataset.id, Number(event.target.value));
  } else if (event.target.matches('input[name="fulfillment"]')) {
    fulfillment = event.target.value;
    localStorage.setItem('ms_fulfillment', fulfillment);
    await loadCart();
  }
});

document.addEventListener('ms:delivery', loadCart);

await mountHeader(qs('#site-header'));
mountFooter(qs('#site-footer'));
mountBottomNav(qs('#bottom-nav'), 'cart');
await loadCart();
