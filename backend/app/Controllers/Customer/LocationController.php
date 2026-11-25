<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\ShippingService;
use PDO;
use Request;
use Response;

final class LocationController
{
    public function __construct(
        private PDO $pdo,
        private ShippingService $shippingService,
        private array $business
    ) {
    }

    public function areas(Request $request, array $params = []): void
    {
        $conditions = ['ho_tro = 1'];
        $values = [];
        foreach (['tinh', 'quan_huyen'] as $field) {
            $value = $request->query[$field] ?? null;
            if (is_string($value) && trim($value) !== '') {
                $conditions[] = $field . ' = ?';
                $values[] = trim($value);
            }
        }

        $query = $this->pdo->prepare(
            'SELECT id, tinh, quan_huyen, phuong_xa, khoang_cach_km
             FROM khu_vuc_giao_hang
             WHERE ' . implode(' AND ', $conditions) . '
             ORDER BY tinh, quan_huyen, phuong_xa, id'
        );
        $query->execute($values);
        $areas = array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'tinh' => $row['tinh'],
                'quan_huyen' => $row['quan_huyen'],
                'phuong_xa' => $row['phuong_xa'],
                'khoang_cach_km' => (float) $row['khoang_cach_km'],
            ],
            $query->fetchAll(PDO::FETCH_ASSOC)
        );

        Response::success('Danh sách khu vực giao hàng', ['areas' => $areas]);
    }

    public function quote(Request $request, array $params = []): void
    {
        $input = $request->all();
        $areaId = $this->positiveInteger($input['khu_vuc_id'] ?? null);
        $subtotal = $this->nonNegativeInteger($input['tien_hang_sau_giam'] ?? null);
        $errors = [];
        if ($areaId === null) {
            $errors['khu_vuc_id'] = 'khu_vuc_id phải là số nguyên dương';
        }
        if ($subtotal === null) {
            $errors['tien_hang_sau_giam'] = 'Tiền hàng phải là số nguyên không âm';
        }
        if ($errors !== []) {
            Response::error('Dữ liệu báo phí giao hàng không hợp lệ', 422, $errors);
            return;
        }

        Response::success(
            'Báo phí giao hàng tạm tính',
            $this->shippingService->quote($areaId, $subtotal)
        );
    }

    public function storeInfo(Request $request, array $params = []): void
    {
        $store = $this->business['store'];
        Response::success('Thông tin cửa hàng', [
            'ten_cua_hang' => $store['name'],
            'dia_chi' => $store['address'],
            'hotline' => $store['phone'],
            'gio_mo_cua' => $store['open_time'],
            'gio_dong_cua' => $store['close_time'],
        ]);
    }

    private function positiveInteger(mixed $value): ?int
    {
        $number = $this->integer($value);
        return $number !== null && $number > 0 ? $number : null;
    }

    private function nonNegativeInteger(mixed $value): ?int
    {
        $number = $this->integer($value);
        return $number !== null && $number >= 0 ? $number : null;
    }

    private function integer(mixed $value): ?int
    {
        if (!is_string($value) && !is_int($value)) {
            return null;
        }
        $text = (string) $value;
        if ($text === '' || !ctype_digit($text)) {
            return null;
        }
        $number = filter_var($text, FILTER_VALIDATE_INT);
        return is_int($number) ? $number : null;
    }
}
