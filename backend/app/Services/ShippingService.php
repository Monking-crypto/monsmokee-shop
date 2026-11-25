<?php
declare(strict_types=1);

namespace App\Services;

use PDO;

final class ShippingService
{
    public function __construct(
        private PDO $pdo,
        private array $business
    ) {
    }

    public function distanceKm(array $area): float
    {
        return is_numeric($area['khoang_cach_km'] ?? null)
            ? (float) $area['khoang_cach_km']
            : INF;
    }

    public function quote(int $areaId, int $subtotalAfterDiscount): array
    {
        $query = $this->pdo->prepare(
            'SELECT id, tinh, quan_huyen, phuong_xa, khoang_cach_km, ho_tro
             FROM khu_vuc_giao_hang
             WHERE id = ?
             LIMIT 1'
        );
        $query->execute([$areaId]);
        $area = $query->fetch(PDO::FETCH_ASSOC);
        $shipping = $this->business['shipping'];
        $minCod = (int) $shipping['cod_min_order'];
        $minDelivery = (int) $shipping['delivery_min_order'];
        $freeShipMin = (int) $shipping['free_ship_min_order'];
        $freeShipMaxKm = (float) $shipping['free_ship_max_km'];
        $serviceMaxKm = (float) $shipping['max_service_km'];
        $serviceArea = $this->business['service_area'] ?? [];

        if ($area === false) {
            return $this->unavailableQuote(null, 'Không tìm thấy khu vực giao hàng');
        }

        $distance = $this->distanceKm($area);
        if ((int) $area['ho_tro'] !== 1) {
            return $this->unavailableQuote($distance, 'Khu vực hiện chưa hỗ trợ giao hàng');
        }
        if ($distance > $serviceMaxKm) {
            return $this->unavailableQuote($distance, 'Khu vực nằm ngoài bán kính phục vụ');
        }
        if ($subtotalAfterDiscount < $minDelivery && $distance > $freeShipMaxKm) {
            return $this->unavailableQuote(
                $distance,
                'Đơn hàng dưới mức tối thiểu giao hàng; vui lòng chọn Click & Collect'
            );
        }

        $freeShipping = $subtotalAfterDiscount >= $freeShipMin
            || $distance <= $freeShipMaxKm;
        $fee = $freeShipping ? 0 : (int) $shipping['fee_default'];
        $insideCodArea = $area['tinh'] === ($serviceArea['province'] ?? null)
            && $area['quan_huyen'] === ($serviceArea['district'] ?? null);
        $codAllowed = $subtotalAfterDiscount >= $minCod && $insideCodArea;

        return [
            'phi_ship_tam_tinh' => $fee,
            'mien_phi' => $freeShipping,
            'ly_do' => $freeShipping
                ? ($subtotalAfterDiscount >= $freeShipMin
                    ? 'Miễn phí vận chuyển theo giá trị đơn hàng'
                    : 'Miễn phí vận chuyển trong khu vực gần')
                : 'Phí vận chuyển tạm tính theo khu vực',
            'cho_phep_cod' => $codAllowed,
            'ly_do_khong_cod' => $codAllowed
                ? null
                : ($subtotalAfterDiscount < $minCod
                    ? 'Đơn hàng chưa đạt mức tối thiểu hỗ trợ COD; vui lòng chọn Click & Collect'
                    : 'Địa chỉ ngoài khu vực nội thành hỗ trợ COD; vui lòng chọn Click & Collect'),
            'khoang_cach_km' => $distance,
            'giao_duoc' => true,
        ];
    }

    private function unavailableQuote(?float $distance, string $reason): array
    {
        return [
            'phi_ship_tam_tinh' => 0,
            'mien_phi' => false,
            'ly_do' => $reason,
            'cho_phep_cod' => false,
            'ly_do_khong_cod' => $reason . '; vui lòng chọn Click & Collect',
            'khoang_cach_km' => $distance,
            'giao_duoc' => false,
        ];
    }
}
