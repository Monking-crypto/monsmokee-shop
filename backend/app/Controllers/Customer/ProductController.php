<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\PromotionService;
use App\Services\ProductImageService;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Request;
use Response;

final class ProductController
{
    private const DEFAULT_PER_PAGE = 12;
    private const MAX_PER_PAGE = 50;

    public function __construct(
        private PDO $pdo,
        private PromotionService $promotionService,
        private ProductImageService $imageService,
        private array $appConfig,
        private array $businessConfig
    ) {
    }

    public function index(Request $request, array $params = []): void
    {
        $query = $request->query;
        $now = $this->requestTime($query['now'] ?? null);
        if ($now === null) {
            return;
        }
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

        $conditions = ['s.trang_thai = 1', 'd.trang_thai = 1'];
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
        $nearExpiry = $query['near_expiry'] ?? '0';
        if (!in_array($nearExpiry, [0, 1, '0', '1'], true)) {
            Response::error('Tham số lọc sản phẩm không hợp lệ', 422, [
                'near_expiry' => 'near_expiry chỉ nhận 0 hoặc 1',
            ]);
            return;
        }
        if ((string) $nearExpiry === '1') {
            $cutoff = $now
                ->setTime(0, 0)
                ->modify('+' . max(0, (int) ($this->businessConfig['promotion']['near_expiry_days'] ?? 10)) . ' days')
                ->format('Y-m-d');
            $conditions[] = 'EXISTS (
                SELECT 1 FROM lo_hang b
                WHERE b.san_pham_id = s.id
                  AND b.so_luong_con > 0
                  AND b.han_su_dung <= ?
            )';
            $values[] = $cutoff;
        }
        $where = implode(' AND ', $conditions);

        $count = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM san_pham s
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE ' . $where
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
                fn(array $row): array => $this->formatProduct($row, $now),
                $productsQuery->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        Response::success('Danh sách sản phẩm', [
            'products' => $products,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'has_more' => $page * $perPage < $total,
            ],
        ]);
    }

    public function show(Request $request, array $params = []): void
    {
        $now = $this->requestTime($request->query['now'] ?? null);
        if ($now === null) {
            return;
        }
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
             WHERE s.id = ? AND s.trang_thai = 1 AND d.trang_thai = 1
             LIMIT 1'
        );
        $query->execute([$id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }

        Response::success('Chi tiết sản phẩm', ['product' => $this->formatProduct($row, $now, true)]);
    }

    private function formatProduct(array $row, DateTimeImmutable $now, bool $includeDescription = false): array
    {
        $price = $this->promotionService->getEffectivePrice($row, $now);
        $product = [
            'id' => (int) $row['id'],
            'ten_san_pham' => $row['ten_san_pham'],
            'gia_ban' => (int) $row['gia_ban'],
            'gia_goc' => $price['gia_goc'],
            'phan_tram_giam' => $price['phan_tram_giam'],
            'gia_ban_hieu_luc' => $price['gia_ban_hieu_luc'],
            'nhan_khuyen_mai' => $price['nguon'],
            'anh_thumb' => $this->imageService->cardImagePath($row['hinh_anh']),
            'danh_muc' => [
                'id' => (int) $row['danh_muc_id'],
                'ten_danh_muc' => $row['ten_danh_muc'],
                'slug' => $row['danh_muc_slug'],
            ],
            'con_hang' => (bool) $row['con_hang'],
        ];
        if ($includeDescription) {
            $product['anh'] = $row['hinh_anh'];
        }
        if ($price['nguon'] === 'CAN_HAN') {
            $cutoff = $now
                ->setTime(0, 0)
                ->modify(
                    '+'
                    . max(
                        0,
                        (int) ($this->businessConfig['promotion']['near_expiry_days'] ?? 10)
                    )
                    . ' days'
                )
                ->format('Y-m-d');
            $expiry = $this->pdo->prepare(
                'SELECT b.han_su_dung
                 FROM lo_hang b
                 WHERE b.san_pham_id = ?
                   AND b.so_luong_con > 0
                   AND b.han_su_dung <= ?
                   AND (
                       b.chi_tiet_phieu_nhap_id IS NULL
                       OR EXISTS (
                           SELECT 1
                           FROM chi_tiet_phieu_nhap d
                           JOIN phieu_nhap_kho p ON p.id = d.phieu_nhap_id
                           WHERE d.id = b.chi_tiet_phieu_nhap_id
                             AND p.trang_thai = \'HOAN_THANH\'
                       )
                   )
                 ORDER BY b.han_su_dung ASC, b.id ASC
                 LIMIT 1'
            );
            $expiry->execute([(int) $row['id'], $cutoff]);
            $product['han_su_dung'] = $expiry->fetchColumn() ?: null;
        }
        if ($includeDescription) {
            $product['mo_ta'] = $row['mo_ta'];
            $product['don_vi_tinh'] = $row['don_vi_tinh'];
        }
        return $product;
    }

    private function requestTime(mixed $date): ?DateTimeImmutable
    {
        $timezone = new DateTimeZone((string) ($this->appConfig['timezone'] ?? 'Asia/Ho_Chi_Minh'));
        if ($date === null) {
            return new DateTimeImmutable('now', $timezone);
        }
        if (($this->appConfig['env'] ?? '') !== 'development') {
            Response::error('Tham số now chỉ được dùng trong môi trường development', 422);
            return null;
        }
        if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            Response::error('Tham số now phải theo định dạng YYYY-MM-DD', 422, [
                'now' => 'Ngày không hợp lệ',
            ]);
            return null;
        }
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $timezone);
        $parseErrors = DateTimeImmutable::getLastErrors();
        if (
            $parsed === false
            || ($parseErrors !== false && ($parseErrors['warning_count'] > 0 || $parseErrors['error_count'] > 0))
            || $parsed->format('Y-m-d') !== $date
        ) {
            Response::error('Tham số now phải theo định dạng YYYY-MM-DD', 422, [
                'now' => 'Ngày không hợp lệ',
            ]);
            return null;
        }
        return $parsed->setTime(12, 0);
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
