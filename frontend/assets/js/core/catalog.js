// catalog.js - adapters for the public catalog API response envelopes
import { api } from './api.js';

export async function getCategories() {
  const data = await api.get('/categories');
  const categories = Array.isArray(data) ? data : data?.categories;
  if (!Array.isArray(categories)) throw new Error('Dữ liệu danh mục từ máy chủ không hợp lệ.');
  return categories;
}

export async function getProducts(query = new URLSearchParams()) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const suffix = params.toString();
  const data = await api.get(`/products${suffix ? `?${suffix}` : ''}`);
  const products = Array.isArray(data?.products) ? data.products : data?.items;
  if (!Array.isArray(products)) throw new Error('Dữ liệu sản phẩm từ máy chủ không hợp lệ.');
  const source = data.pagination || data;
  const page = Number(source.page) || 1;
  const perPage = Number(source.per_page) || products.length;
  const total = Number(source.total) || products.length;
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
