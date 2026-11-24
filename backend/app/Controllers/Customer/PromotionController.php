<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\PromotionService;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Request;
use Response;

final class PromotionController
{
    public function __construct(
        private PDO $pdo,
        private PromotionService $promotionService,
        private array $appConfig,
        private array $businessConfig
    ) {
    }

    public function active(Request $request, array $params = []): void
    {
        $now = $this->requestTime($request->query['now'] ?? null);
        if ($now === null) {
            return;
        }

        $sql = 'SELECT id, ma_khuyen_mai, ten_chuong_trinh, loai, phan_tram_giam,
                       ngay_bat_dau, ngay_ket_thuc
                FROM khuyen_mai
                WHERE trang_thai = 1
                  AND ngay_bat_dau <= ?
                  AND ngay_ket_thuc >= ?';
        $values = [$now->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s')];
        if ((int) $now->format('N') !== (int) ($this->businessConfig['promotion']['friday_iso_weekday'] ?? 5)) {
            $sql .= ' AND loai <> \'THU_SAU\'';
        }
        $sql .= ' ORDER BY ngay_bat_dau DESC, id DESC';
        $query = $this->pdo->prepare($sql);
        $query->execute($values);
        $promotions = [];

        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $promotion) {
            $productsQuery = $this->pdo->prepare(
                'SELECT s.id, s.ten_san_pham, s.gia_ban, s.hinh_anh, s.so_luong_ton > 0 AS con_hang,
                        d.id AS danh_muc_id, d.ten_danh_muc, d.slug AS danh_muc_slug
                 FROM khuyen_mai_san_pham ps
                 JOIN san_pham s ON s.id = ps.san_pham_id
                 JOIN danh_muc d ON d.id = s.danh_muc_id
                 WHERE ps.khuyen_mai_id = ?
                   AND s.trang_thai = 1
                   AND s.so_luong_ton > 0
                   AND d.trang_thai = 1
                 ORDER BY s.ten_san_pham, s.id'
            );
            $productsQuery->execute([(int) $promotion['id']]);
            $products = [];
            foreach ($productsQuery->fetchAll(PDO::FETCH_ASSOC) as $product) {
                $price = $this->promotionService->getEffectivePrice($product, $now);
                $products[] = [
                    'id' => (int) $product['id'],
                    'ten_san_pham' => $product['ten_san_pham'],
                    'gia_goc' => $price['gia_goc'],
                    'phan_tram_giam' => $price['phan_tram_giam'],
                    'gia_ban_hieu_luc' => $price['gia_ban_hieu_luc'],
                    'nhan_khuyen_mai' => $price['nguon'],
                    'hinh_anh' => $product['hinh_anh'],
                    'con_hang' => true,
                ];
            }
            $promotions[] = [
                'id' => (int) $promotion['id'],
                'ma_khuyen_mai' => $promotion['ma_khuyen_mai'],
                'ten_chuong_trinh' => $promotion['ten_chuong_trinh'],
                'loai' => $promotion['loai'],
                'phan_tram_giam' => (int) $promotion['phan_tram_giam'],
                'ngay_bat_dau' => $promotion['ngay_bat_dau'],
                'ngay_ket_thuc' => $promotion['ngay_ket_thuc'],
                'products' => $products,
            ];
        }

        Response::success('Các chương trình khuyến mãi đang chạy', ['promotions' => $promotions]);
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
}
