<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use PDO;
use Request;
use Response;

final class ProductController
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 50;

    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request, array $params = []): void
    {
        $query = $request->query;
        $page = $this->positiveInteger($query['page'] ?? 1);
        $perPage = $this->positiveInteger($query['per_page'] ?? self::DEFAULT_PER_PAGE);
        $errors = [];
        if ($page === null) {
            $errors['page'] = 'page phải là số nguyên dương';
        }
        if ($perPage === null || $perPage > self::MAX_PER_PAGE) {
            $errors['per_page'] = 'per_page phải từ 1 đến 50';
        }

        $categoryId = null;
        if (array_key_exists('category_id', $query)) {
            $categoryId = $this->positiveInteger($query['category_id']);
            if ($categoryId === null) {
                $errors['category_id'] = 'category_id phải là số nguyên dương';
            }
        }

        $search = $query['q'] ?? '';
        if (!is_string($search)) {
            $errors['q'] = 'q phải là chuỗi';
            $search = '';
        } else {
            $search = trim($search);
            if (mb_strlen($search) > 100) {
                $errors['q'] = 'q không được vượt quá 100 ký tự';
            }
        }

        $sort = $query['sort'] ?? 'newest';
        $sortOrders = [
            'price_asc' => 's.gia_ban ASC, s.id ASC',
            'price_desc' => 's.gia_ban DESC, s.id DESC',
            'newest' => 's.ngay_tao DESC, s.id DESC',
        ];
        if (!is_string($sort) || !isset($sortOrders[$sort])) {
            $errors['sort'] = 'sort phải là price_asc, price_desc hoặc newest';
        }
        if ($errors !== []) {
            Response::error('Tham số lọc sản phẩm không hợp lệ', 422, $errors);
            return;
        }

        $conditions = ['s.trang_thai = 1'];
        $values = [];
        if ($categoryId !== null) {
            $conditions[] = 's.danh_muc_id = ?';
            $values[] = $categoryId;
        }
        if ($search !== '') {
            $conditions[] = '(s.ten_san_pham LIKE ? OR s.ten_khong_dau LIKE ?)';
            $searchTerm = '%' . $search . '%';
            $values[] = $searchTerm;
            $values[] = $searchTerm;
        }
        $where = implode(' AND ', $conditions);

        $count = $this->pdo->prepare(
            'SELECT COUNT(*) FROM san_pham s WHERE ' . $where
        );
        $count->execute($values);
        $total = (int) $count->fetchColumn();

        $totalPages = (int) ceil($total / $perPage);
        $products = [];
        if ($page <= $totalPages) {
            $offset = ($page - 1) * $perPage;
            $productsQuery = $this->pdo->prepare(
                'SELECT s.id, s.ten_san_pham, s.gia_ban, s.hinh_anh,
                        s.so_luong_ton > 0 AS con_hang,
                        d.id AS danh_muc_id, d.ten_danh_muc, d.slug AS danh_muc_slug
                 FROM san_pham s
                 JOIN danh_muc d ON d.id = s.danh_muc_id
                 WHERE ' . $where . '
                 ORDER BY ' . $sortOrders[$sort] . '
                 LIMIT ? OFFSET ?'
            );
            foreach ($values as $index => $value) {
                $productsQuery->bindValue($index + 1, $value);
            }
            $productsQuery->bindValue(count($values) + 1, $perPage, PDO::PARAM_INT);
            $productsQuery->bindValue(count($values) + 2, $offset, PDO::PARAM_INT);
            $productsQuery->execute();

            $products = array_map(
                static fn(array $row): array => [
                    'id' => (int) $row['id'],
                    'ten_san_pham' => $row['ten_san_pham'],
                    'gia_ban' => (int) $row['gia_ban'],
                    'hinh_anh' => $row['hinh_anh'],
                    'danh_muc' => [
                        'id' => (int) $row['danh_muc_id'],
                        'ten_danh_muc' => $row['ten_danh_muc'],
                        'slug' => $row['danh_muc_slug'],
                    ],
                    'con_hang' => (bool) $row['con_hang'],
                ],
                $productsQuery->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        Response::success('Danh sách sản phẩm', [
            'products' => $products,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ]);
    }

    public function show(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }

        $query = $this->pdo->prepare(
            'SELECT s.id, s.ten_san_pham, s.mo_ta, s.hinh_anh, s.don_vi_tinh,
                    s.gia_ban, s.so_luong_ton > 0 AS con_hang,
                    d.id AS danh_muc_id, d.ten_danh_muc, d.slug AS danh_muc_slug
             FROM san_pham s
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE s.id = ? AND s.trang_thai = 1
             LIMIT 1'
        );
        $query->execute([$id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }

        Response::success('Chi tiết sản phẩm', [
            'product' => [
                'id' => (int) $row['id'],
                'ten_san_pham' => $row['ten_san_pham'],
                'mo_ta' => $row['mo_ta'],
                'hinh_anh' => $row['hinh_anh'],
                'don_vi_tinh' => $row['don_vi_tinh'],
                'gia_ban' => (int) $row['gia_ban'],
                'danh_muc' => [
                    'id' => (int) $row['danh_muc_id'],
                    'ten_danh_muc' => $row['ten_danh_muc'],
                    'slug' => $row['danh_muc_slug'],
                ],
                'con_hang' => (bool) $row['con_hang'],
            ],
        ]);
    }

    private function positiveInteger(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value > 0 ? $value : null;
        }
        if (!is_string($value) || $value === '' || !ctype_digit($value)) {
            return null;
        }

        $integer = filter_var($value, FILTER_VALIDATE_INT);
        return is_int($integer) && $integer > 0 ? $integer : null;
    }
}
