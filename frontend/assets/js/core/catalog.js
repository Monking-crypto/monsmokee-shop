// catalog.js - adapters for the public catalog API response envelopes
import { api } from './api.js';
import { CONFIG } from './config.js';

const CATEGORY_ICONS = {
  'banh-keo': 'cookie',
  'mi-goi': 'cup-hot',
  bia: 'cup-straw',
  sua: 'cup-straw',
  'nuoc-giai-khat': 'droplet',
  've-sinh-gia-dinh': 'house',
  'do-cung': 'flower1',
  'cham-soc-ca-nhan': 'person-heart',
  'gia-vi': 'basket',
  'thuoc-la': 'dash-circle',
  'do-dung-gia-dinh': 'house-heart',
  trung: 'egg',
  kem: 'snow',
};

const PLACEHOLDER_IMAGE = new URL('../../img/placeholder-product.svg', import.meta.url).href;
let categoriesPromise;

export async function getCategories() {
  if (!categoriesPromise) {
    categoriesPromise = api.get('/categories').then((data) => {
      const categories = Array.isArray(data) ? data : data?.categories;
      if (!Array.isArray(categories)) throw new Error('Dữ liệu danh mục từ máy chủ không hợp lệ.');
      return categories.map((category) => ({
        ...category,
        icon: category.icon || CATEGORY_ICONS[category.slug] || 'box',
      }));
    }).catch((error) => {
      categoriesPromise = null;
      throw error;
    });
  }
  return categoriesPromise;
}

export async function getProducts(query = new URLSearchParams()) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  if (!params.has('page')) params.set('page', '1');
  if (!params.has('per_page')) params.set('per_page', '12');
  if (CONFIG.LIVE.catalog && !['newest', 'price_asc', 'price_desc'].includes(params.get('sort'))) {
    params.delete('sort');
  }
  const suffix = params.toString();
  const data = await api.get(`/products${suffix ? `?${suffix}` : ''}`);
  const products = data?.products;
  if (!Array.isArray(products)) throw new Error('Dữ liệu sản phẩm từ máy chủ không hợp lệ.');
  const source = data.pagination || data;
  const page = Number(source.page) || 1;
  const perPage = Number(source.per_page) || products.length;
  const total = Number.isFinite(Number(source.total)) ? Number(source.total) : products.length;
  const totalPages = Number(source.total_pages) || Math.ceil(total / (perPage || 1));
  return {
    products,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      has_more: typeof source.has_more === 'boolean' ? source.has_more : page < totalPages,
    },
  };
}

export function imageUrl(path) {
  const value = String(path || '').trim();
  if (!value || value === 'placeholder-product.svg' || value.endsWith('/placeholder-product.svg')) {
    return PLACEHOLDER_IMAGE;
  }
  if (/^(https?:)?\/\//i.test(value)) return value;
  if (/^uploads\//i.test(value)) {
    const backendRoot = CONFIG.API_BASE.replace(/\/public\/api\/?$/, '');
    return new URL(value, `${backendRoot}/`).href;
  }
  return value;
}

export function daysUntilExpiry(value, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 0;
  const expiry = value.split('-').map(Number);
  const expiryUtc = Date.UTC(expiry[0], expiry[1] - 1, expiry[2]);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now).filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
  const todayUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.ceil((expiryUtc - todayUtc) / 86400000);
}
