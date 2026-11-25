<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/Services/ShippingService.php';

use App\Services\ShippingService;

$pdo = new PDO('sqlite::memory:');
$pdo->exec(
    'CREATE TABLE khu_vuc_giao_hang (
        id INTEGER PRIMARY KEY,
        tinh TEXT NOT NULL,
        quan_huyen TEXT NOT NULL,
        phuong_xa TEXT NOT NULL,
        khoang_cach_km REAL NOT NULL,
        ho_tro INTEGER NOT NULL
    )'
);
$pdo->exec(
    "INSERT INTO khu_vuc_giao_hang VALUES
        (1, 'Quảng Bình', 'TP. Đồng Hới', 'Gần', 2.5, 1),
        (2, 'Quảng Bình', 'TP. Đồng Hới', 'Ngoài gần', 2.6, 1),
        (3, 'Quảng Bình', 'TP. Đồng Hới', 'Giới hạn', 6.0, 1),
        (4, 'Quảng Bình', 'TP. Đồng Hới', 'Ngoài vùng', 6.1, 1),
        (5, 'Quảng Bình', 'TP. Đồng Hới', 'Đã tắt', 2.0, 0),
        (6, 'Quảng Bình', 'Huyện khác', 'Ngoài vùng COD', 2.0, 1)"
);
$service = new ShippingService($pdo, [
    'shipping' => [
        'cod_min_order' => 50000,
        'delivery_min_order' => 50000,
        'free_ship_min_order' => 150000,
        'free_ship_max_km' => 2.5,
        'fee_default' => 15000,
        'max_service_km' => 6.0,
    ],
    'service_area' => [
        'province' => 'Quảng Bình',
        'district' => 'TP. Đồng Hới',
    ],
]);

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$quote = $service->quote(1, 49999);
$assert(
    $quote['giao_duoc'] && $quote['phi_ship_tam_tinh'] === 0
        && $quote['mien_phi'] && !$quote['cho_phep_cod'],
    '49,999 VND at 2.5 km must be free delivery without COD'
);

$quote = $service->quote(2, 49999);
$assert(
    !$quote['giao_duoc'] && !$quote['cho_phep_cod']
        && str_contains($quote['ly_do'], 'Click & Collect'),
    'Below-minimum order beyond the free radius must be Click & Collect only'
);

$quote = $service->quote(2, 50000);
$assert(
    $quote['giao_duoc'] && $quote['phi_ship_tam_tinh'] === 15000
        && !$quote['mien_phi'] && $quote['cho_phep_cod'],
    '50,000 VND at 2.6 km must have standard fee and allow COD'
);

$quote = $service->quote(2, 149999);
$assert(
    $quote['phi_ship_tam_tinh'] === 15000 && !$quote['mien_phi'],
    '149,999 VND beyond the free radius must have standard fee'
);

$quote = $service->quote(2, 150000);
$assert(
    $quote['phi_ship_tam_tinh'] === 0 && $quote['mien_phi'],
    '150,000 VND must be free beyond the free radius'
);

$quote = $service->quote(3, 50000);
$assert($quote['giao_duoc'], 'Delivery at the maximum service distance must be allowed');

$quote = $service->quote(4, 150000);
$assert(!$quote['giao_duoc'], 'Distance beyond the service radius must not be delivered');

$quote = $service->quote(5, 50000);
$assert(!$quote['giao_duoc'], 'An inactive area must not be delivered');

$quote = $service->quote(6, 50000);
$assert(
    $quote['giao_duoc'] && !$quote['cho_phep_cod']
        && str_contains((string) $quote['ly_do_khong_cod'], 'Click & Collect'),
    'COD must be disabled outside the configured service area'
);

echo "ShippingService tests passed\n";
