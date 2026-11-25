<?php
declare(strict_types=1);

require dirname(__DIR__) . '/core/Request.php';
require dirname(__DIR__) . '/core/Response.php';
require dirname(__DIR__) . '/app/Services/PromotionService.php';
require dirname(__DIR__) . '/app/Services/ProductImageService.php';
require dirname(__DIR__) . '/app/Controllers/Customer/ProductController.php';

use App\Controllers\Customer\ProductController;
use App\Services\PromotionService;

$pdo = new PDO('sqlite::memory:');
$pdo->exec(
    'CREATE TABLE danh_muc (
        id INTEGER PRIMARY KEY,
        ten_danh_muc TEXT NOT NULL,
        slug TEXT NOT NULL,
        trang_thai INTEGER NOT NULL
    );
    CREATE TABLE san_pham (
        id INTEGER PRIMARY KEY,
        danh_muc_id INTEGER NOT NULL,
        ten_san_pham TEXT NOT NULL,
        ten_khong_dau TEXT NOT NULL,
        mo_ta TEXT,
        hinh_anh TEXT,
        don_vi_tinh TEXT,
        gia_ban INTEGER NOT NULL,
        so_luong_ton INTEGER NOT NULL,
        trang_thai INTEGER NOT NULL,
        ngay_tao TEXT
    );
    CREATE TABLE lo_hang (
        id INTEGER PRIMARY KEY,
        san_pham_id INTEGER NOT NULL,
        chi_tiet_phieu_nhap_id INTEGER,
        han_su_dung TEXT NOT NULL,
        so_luong_con INTEGER NOT NULL
    );
    CREATE TABLE chi_tiet_phieu_nhap (id INTEGER PRIMARY KEY, phieu_nhap_id INTEGER);
    CREATE TABLE phieu_nhap_kho (id INTEGER PRIMARY KEY, trang_thai TEXT NOT NULL);'
);
$pdo->exec(
    "INSERT INTO danh_muc VALUES (1, 'Danh mục mẫu', 'danh-muc-mau', 1);
     INSERT INTO san_pham VALUES
       (1, 1, 'Sản phẩm cận hạn', 'san pham can han', 'Mô tả', NULL, 'chai', 100000, 3, 1, '2026-03-05'),
       (2, 1, 'Sản phẩm thường', 'san pham thuong', 'Mô tả', NULL, 'chai', 100000, 3, 1, '2026-03-04');
     INSERT INTO lo_hang VALUES
       (1, 1, NULL, '2026-03-10', 3),
       (2, 2, NULL, '2027-03-10', 3);"
);
$business = [
    'promotion' => [
        'near_expiry_days' => 10,
        'near_expiry_percent' => 50,
        'friday_iso_weekday' => 5,
    ],
];
$timezone = new DateTimeZone('Asia/Ho_Chi_Minh');
$controller = new ProductController(
    $pdo,
    new PromotionService($pdo, $business, $timezone),
    new App\Services\ProductImageService(),
    ['env' => 'development', 'timezone' => 'Asia/Ho_Chi_Minh'],
    $business
);

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$show = static function (int $id) use ($controller): array {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI'] = '/api/products/' . $id . '?now=2026-03-05';
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_GET = ['now' => '2026-03-05'];
    http_response_code(200);
    ob_start();
    $controller->show(new Request(), ['id' => (string) $id]);
    $response = json_decode((string) ob_get_clean(), true);
    return $response['data']['product'] ?? [];
};

$list = static function (?int $perPage = null) use ($controller): array {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI'] = '/api/products?now=2026-03-05'
        . ($perPage === null ? '' : '&per_page=' . $perPage);
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_GET = ['now' => '2026-03-05'];
    if ($perPage !== null) {
        $_GET['per_page'] = (string) $perPage;
    }
    http_response_code(200);
    ob_start();
    $controller->index(new Request());
    $response = json_decode((string) ob_get_clean(), true);
    return $response['data'] ?? [];
};

$nearExpiry = $show(1);
$regular = $show(2);
$listed = $list();
$listedProducts = $listed['products'] ?? [];
$listedNearExpiry = array_values(array_filter(
    $listedProducts,
    static fn(array $product): bool => $product['id'] === 1
))[0] ?? [];
$listedRegular = array_values(array_filter(
    $listedProducts,
    static fn(array $product): bool => $product['id'] === 2
))[0] ?? [];
$assert(
    ($nearExpiry['nhan_khuyen_mai'] ?? null) === 'CAN_HAN'
        && ($nearExpiry['han_su_dung'] ?? null) === '2026-03-10',
    'Near-expiry product detail must expose the nearest in-stock expiry date'
);
$assert(
    !array_key_exists('han_su_dung', $regular),
    'Regular product detail must not expose expiry or batch information'
);
$assert(
    ($listedNearExpiry['han_su_dung'] ?? null) === '2026-03-10'
        && !array_key_exists('han_su_dung', $listedRegular),
    'Product listing must expose expiry only for near-expiry discounts'
);
$assert(
    ($listed['pagination'] ?? null) === [
        'page' => 1,
        'per_page' => 12,
        'total' => 2,
        'has_more' => false,
    ],
    'Product listing must use the 12-item default and the documented pagination shape'
);
$assert(
    array_key_exists('anh_thumb', $listedNearExpiry)
        && !array_key_exists('anh', $listedNearExpiry)
        && array_key_exists('anh', $nearExpiry)
        && array_key_exists('anh_thumb', $nearExpiry),
    'Product cards must use thumbnails while detail responses include both image sizes'
);
$singlePage = $list(1);
$assert(
    ($singlePage['pagination']['per_page'] ?? null) === 1
        && ($singlePage['pagination']['has_more'] ?? null) === true,
    'Pagination must report when another page is available'
);

echo "Public near-expiry product tests passed\n";
