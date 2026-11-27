<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Services\CartService;
use App\Services\ProductImageService;
use App\Services\PromotionService;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Request;
use Response;
use Session;

final class CartController
{
    public function __construct(
        private CartService $cartService,
        private PromotionService $promotionService,
        private ProductImageService $imageService,
        private array $appConfig,
        private array $business
    ) {
    }

    public function index(Request $request, array $params = []): void
    {
        $userId = $this->userId();
        if ($userId === false) {
            return;
        }
        $now = $this->requestTime($request->query['now'] ?? null);
        if ($now === null) {
            return;
        }

        $items = [];
        $subtotal = 0;
        $discountTotal = 0;
        $total = 0;
        foreach ($this->cartService->rows($userId) as $row) {
            $productId = (int) $row['san_pham_id'];
            $quantity = (int) $row['so_luong'];
            $exists = $row['id'] !== null;
            $available = $exists
                && (int) $row['san_pham_trang_thai'] === 1
                && (int) $row['danh_muc_trang_thai'] === 1
                && (int) $row['so_luong_ton'] > 0;
            $enoughStock = $available && $quantity <= (int) $row['so_luong_ton'];
            $price = $exists
                ? $this->promotionService->getEffectivePrice($row, $now)
                : [
                    'gia_goc' => 0,
                    'phan_tram_giam' => 0,
                    'gia_ban_hieu_luc' => 0,
                    'nguon' => null,
                ];
            $lineSubtotal = $price['gia_goc'] * $quantity;
            $lineTotal = $price['gia_ban_hieu_luc'] * $quantity;
            $subtotal += $lineSubtotal;
            $discountTotal += $lineSubtotal - $lineTotal;
            $total += $lineTotal;

            $warning = null;
            if (!$available) {
                $warning = 'Sản phẩm hiện đã ngừng kinh doanh hoặc hết hàng.';
            } elseif (!$enoughStock) {
                $warning = 'Tồn kho hiện tại không đủ cho số lượng trong giỏ.';
            } elseif ($quantity > (int) ($this->business['cart']['max_qty_per_line'] ?? 99)) {
                $warning = 'Số lượng trong giỏ vượt giới hạn tối đa mỗi dòng.';
            }

            $items[] = [
                'san_pham_id' => $productId,
                'ten' => $row['ten_san_pham'],
                'anh_thumb' => $exists ? $this->imageService->cardImagePath($row['hinh_anh']) : null,
                'don_vi_tinh' => $row['don_vi_tinh'],
                'so_luong' => $quantity,
                'gia_goc' => (int) $price['gia_goc'],
                'phan_tram_giam' => (int) $price['phan_tram_giam'],
                'gia_ban_hieu_luc' => (int) $price['gia_ban_hieu_luc'],
                'nhan_khuyen_mai' => $price['nguon'],
                'thanh_tien' => (int) $lineTotal,
                'con_hang' => (bool) $available,
                'canh_bao' => $warning,
            ];
        }

        Response::success('Giỏ hàng', [
            'items' => $items,
            'summary' => [
                'tam_tinh' => (int) $subtotal,
                'so_tien_duoc_giam' => (int) $discountTotal,
                'tong_tien_hang' => (int) $total,
            ],
        ]);
    }

    public function addItem(Request $request, array $params = []): void
    {
        $input = $request->all();
        if (array_diff(array_keys($input), ['san_pham_id', 'so_luong']) !== []) {
            Response::error('Dữ liệu giỏ hàng không hợp lệ', 422, [
                'fields' => 'Chỉ nhận san_pham_id và so_luong',
            ]);
            return;
        }
        $productId = $input['san_pham_id'] ?? null;
        $quantity = $input['so_luong'] ?? null;
        if (!is_int($productId) || $productId < 1 || !is_int($quantity) || $quantity < 1) {
            Response::error('Dữ liệu giỏ hàng không hợp lệ', 422, [
                'san_pham_id' => 'san_pham_id và so_luong phải là số nguyên dương',
            ]);
            return;
        }
        $userId = $this->userId();
        if ($userId === false) {
            return;
        }
        $this->mutate(fn() => $this->cartService->add($productId, $quantity, $userId));
    }

    public function updateItem(Request $request, array $params = []): void
    {
        $productId = $this->routeProductId($params['san_pham_id'] ?? null);
        $input = $request->all();
        if (array_diff(array_keys($input), ['so_luong']) !== []) {
            Response::error('Dữ liệu giỏ hàng không hợp lệ', 422, [
                'fields' => 'Chỉ nhận so_luong',
            ]);
            return;
        }
        $quantity = $request->input('so_luong');
        if ($productId === null || !is_int($quantity) || $quantity < 1) {
            Response::error('Dữ liệu giỏ hàng không hợp lệ', 422, [
                'so_luong' => 'so_luong phải là số nguyên dương',
            ]);
            return;
        }
        $userId = $this->userId();
        if ($userId === false) {
            return;
        }
        $this->mutate(fn() => $this->cartService->update($productId, $quantity, $userId));
    }

    public function deleteItem(Request $request, array $params = []): void
    {
        $productId = $this->routeProductId($params['san_pham_id'] ?? null);
        if ($productId === null) {
            Response::error('ID sản phẩm không hợp lệ', 422);
            return;
        }
        $userId = $this->userId();
        if ($userId === false) {
            return;
        }
        $this->mutate(fn() => $this->cartService->delete($productId, $userId));
    }

    public function clear(Request $request, array $params = []): void
    {
        $userId = $this->userId();
        if ($userId === false) {
            return;
        }
        $this->mutate(fn() => $this->cartService->clear($userId));
    }

    private function mutate(callable $action): void
    {
        try {
            $action();
            Response::success('Đã cập nhật giỏ hàng');
        } catch (InvalidArgumentException $error) {
            Response::error($error->getMessage(), 422);
        }
    }

    private function userId(): int|false|null
    {
        $userId = Session::get('user_id');
        $role = Session::get('user_role');
        if ($role === 'Admin' && Session::get('admin_otp_verified') === true) {
            Response::error('Giỏ hàng chỉ dành cho khách hàng', 403);
            return false;
        }
        if ($role === 'Customer' && is_numeric($userId) && (int) $userId > 0) {
            return (int) $userId;
        }
        return null;
    }

    private function routeProductId(mixed $value): ?int
    {
        $id = filter_var($value, FILTER_VALIDATE_INT);
        return $id !== false && $id > 0 ? $id : null;
    }

    private function requestTime(mixed $date): ?DateTimeImmutable
    {
        $timezone = new DateTimeZone((string) ($this->appConfig['timezone'] ?? 'Asia/Ho_Chi_Minh'));
        if ($date === null || $date === '') {
            return new DateTimeImmutable('now', $timezone);
        }
        if (($this->appConfig['env'] ?? '') !== 'development') {
            Response::error('Tham số now chỉ được dùng trong môi trường development', 422);
            return null;
        }
        if (!is_string($date) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1) {
            Response::error('Tham số now phải theo định dạng YYYY-MM-DD', 422);
            return null;
        }
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if (
            $parsed === false
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $parsed->format('Y-m-d') !== $date
        ) {
            Response::error('Tham số now phải theo định dạng YYYY-MM-DD', 422);
            return null;
        }
        return $parsed;
    }
}
