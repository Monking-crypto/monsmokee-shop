<?php
declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class PromotionService
{
    private DateTimeZone $timezone;

    public function __construct(
        private PDO $pdo,
        private array $business,
        ?DateTimeZone $timezone = null
    ) {
        $this->timezone = $timezone ?? new DateTimeZone('Asia/Ho_Chi_Minh');
    }

    /**
     * @return array{gia_goc:int, phan_tram_giam:int, gia_ban_hieu_luc:int, nguon:'THU_SAU'|'CAN_HAN'|null, khuyen_mai_id:?int}
     */
    public function getEffectivePrice(array $product, DateTimeImmutable $now): array
    {
        $originalPrice = max(0, (int) round((float) ($product['gia_ban'] ?? 0)));
        $productId = filter_var($product['id'] ?? null, FILTER_VALIDATE_INT);
        $now = $now->setTimezone($this->timezone);
        $cutoff = $now
            ->setTime(0, 0)
            ->modify('+' . max(0, (int) ($this->business['promotion']['near_expiry_days'] ?? 10)) . ' days')
            ->format('Y-m-d');

        $fridayPercent = 0;
        $promotionId = null;
        $weekday = (int) ($this->business['promotion']['friday_iso_weekday'] ?? 5);
        if (is_int($productId) && $productId > 0 && (int) $now->format('N') === $weekday) {
            $promotion = $this->pdo->prepare(
                'SELECT p.id, p.phan_tram_giam
                 FROM khuyen_mai p
                 JOIN khuyen_mai_san_pham ps ON ps.khuyen_mai_id = p.id
                 WHERE ps.san_pham_id = ?
                   AND p.loai = \'THU_SAU\'
                   AND p.trang_thai = 1
                   AND p.so_san_pham = ?
                   AND p.ngay_bat_dau <= ?
                   AND p.ngay_ket_thuc >= ?
                   AND (
                       SELECT COUNT(*)
                       FROM khuyen_mai_san_pham kps_count
                       WHERE kps_count.khuyen_mai_id = p.id
                   ) = ?
                 ORDER BY p.phan_tram_giam DESC, p.id ASC
                 LIMIT 1'
            );
            $nowValue = $now->format('Y-m-d H:i:s');
            $expectedCount = max(1, (int) ($this->business['promotion']['friday_product_count'] ?? 10));
            $promotion->bindValue(1, $productId, PDO::PARAM_INT);
            $promotion->bindValue(2, $expectedCount, PDO::PARAM_INT);
            $promotion->bindValue(3, $nowValue, PDO::PARAM_STR);
            $promotion->bindValue(4, $nowValue, PDO::PARAM_STR);
            $promotion->bindValue(5, $expectedCount, PDO::PARAM_INT);
            $promotion->execute();
            $row = $promotion->fetch(PDO::FETCH_ASSOC);
            if ($row !== false) {
                $fridayPercent = (int) $row['phan_tram_giam'];
                $promotionId = (int) $row['id'];
            }
        }

        $nearExpiryPercent = 0;
        if (is_int($productId) && $productId > 0) {
            $nearExpiry = $this->pdo->prepare(
                'SELECT EXISTS (
                    SELECT 1
                    FROM lo_hang
                    WHERE san_pham_id = ?
                      AND so_luong_con > 0
                      AND han_su_dung <= ?
                )'
            );
            $nearExpiry->execute([$productId, $cutoff]);
            if ((int) $nearExpiry->fetchColumn() === 1) {
                $nearExpiryPercent = max(
                    0,
                    min(100, (int) ($this->business['promotion']['near_expiry_percent'] ?? 50))
                );
            }
        }

        $discount = $fridayPercent;
        $source = $fridayPercent > 0 ? 'THU_SAU' : null;
        if ($nearExpiryPercent > $discount) {
            $discount = $nearExpiryPercent;
            $source = 'CAN_HAN';
            $promotionId = null;
        }

        $effectivePrice = max(
            0,
            (int) round(
                $originalPrice * (100 - $discount) / 100,
                0,
                PHP_ROUND_HALF_UP
            )
        );

        return [
            'gia_goc' => $originalPrice,
            'phan_tram_giam' => $discount,
            'gia_ban_hieu_luc' => $effectivePrice,
            'nguon' => $source,
            'khuyen_mai_id' => $promotionId,
        ];
    }

}
