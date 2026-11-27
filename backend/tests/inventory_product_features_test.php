<?php
declare(strict_types=1);

require dirname(__DIR__) . '/core/Request.php';
require dirname(__DIR__) . '/core/Response.php';
require dirname(__DIR__) . '/core/Session.php';
require dirname(__DIR__) . '/app/Services/PromotionService.php';
require dirname(__DIR__) . '/app/Services/ProductImageService.php';
require dirname(__DIR__) . '/app/Controllers/Customer/ProductController.php';
require dirname(__DIR__) . '/app/Controllers/Admin/StockAdminController.php';
require dirname(__DIR__) . '/app/Controllers/Admin/ProductAdminController.php';

use App\Controllers\Admin\ProductAdminController;
use App\Controllers\Admin\StockAdminController;
use App\Controllers\Customer\ProductController;
use App\Services\ProductImageService;
use App\Services\PromotionService;

if (!class_exists('Logger')) {
    final class Logger
    {
        public static function write(string $file, string $message): void
        {
        }

        public static function error(string $message): void
        {
        }
    }
}

final class InventoryFeatureTestPdo extends PDO
{
    private PDO $sqlite;

    public function __construct()
    {
        $this->sqlite = new PDO('sqlite::memory:');
        $this->sqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    public function exec(string $statement): int|false
    {
        return $this->sqlite->exec($this->translate($statement));
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return $this->sqlite->prepare($this->translate($query), $options);
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        $query = $this->translate($query);
        return $fetchMode === null
            ? $this->sqlite->query($query)
            : $this->sqlite->query($query, $fetchMode, ...$fetchModeArgs);
    }

    public function beginTransaction(): bool
    {
        return $this->sqlite->beginTransaction();
    }

    public function commit(): bool
    {
        return $this->sqlite->commit();
    }

    public function rollBack(): bool
    {
        return $this->sqlite->rollBack();
    }

    public function inTransaction(): bool
    {
        return $this->sqlite->inTransaction();
    }

    public function lastInsertId(?string $name = null): string|false
    {
        return $this->sqlite->lastInsertId($name);
    }

    private function translate(string $query): string
    {
        return preg_replace('/\s+FOR UPDATE\b/i', '', $query) ?? $query;
    }
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$pdo = new InventoryFeatureTestPdo();
$pdo->exec(
    'CREATE TABLE danh_muc (
        id INTEGER PRIMARY KEY,
        ten_danh_muc TEXT NOT NULL,
        slug TEXT NOT NULL,
        trang_thai INTEGER NOT NULL
    );
    CREATE TABLE san_pham (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        danh_muc_id INTEGER NOT NULL,
        ten_san_pham TEXT NOT NULL,
        ten_khong_dau TEXT NOT NULL,
        mo_ta TEXT,
        hinh_anh TEXT,
        don_vi_tinh TEXT,
        gia_ban INTEGER NOT NULL,
        so_luong_ton INTEGER NOT NULL,
        muc_ton_toi_thieu INTEGER NOT NULL DEFAULT 10,
        trang_thai INTEGER NOT NULL,
        giam_can_han INTEGER NOT NULL DEFAULT 0,
        phan_tram_giam_can_han INTEGER NOT NULL DEFAULT 0,
        luot_ban INTEGER NOT NULL DEFAULT 0,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE san_pham_mua_kem (
        san_pham_id INTEGER NOT NULL,
        san_pham_goi_y_id INTEGER NOT NULL,
        PRIMARY KEY (san_pham_id, san_pham_goi_y_id)
    );
    CREATE TABLE khuyen_mai (
        id INTEGER PRIMARY KEY,
        loai TEXT NOT NULL,
        phan_tram_giam INTEGER NOT NULL,
        so_san_pham INTEGER NOT NULL,
        trang_thai INTEGER NOT NULL,
        ngay_bat_dau TEXT NOT NULL,
        ngay_ket_thuc TEXT NOT NULL
    );
    CREATE TABLE khuyen_mai_san_pham (
        khuyen_mai_id INTEGER NOT NULL,
        san_pham_id INTEGER NOT NULL
    );
    CREATE TABLE phieu_nhap_kho (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ma_phieu TEXT NOT NULL,
        admin_id INTEGER NOT NULL,
        ngay_nhap TEXT NOT NULL,
        nha_cung_cap TEXT,
        trang_thai TEXT NOT NULL,
        tong_tien_nhap INTEGER NOT NULL,
        ghi_chu TEXT
    );
    CREATE TABLE chi_tiet_phieu_nhap (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phieu_nhap_id INTEGER NOT NULL,
        san_pham_id INTEGER NOT NULL,
        so_luong_nhap INTEGER NOT NULL,
        gia_nhap INTEGER NOT NULL,
        ngay_san_xuat TEXT,
        han_su_dung TEXT,
        so_lo TEXT
    );
    CREATE TABLE lo_hang (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        san_pham_id INTEGER NOT NULL,
        chi_tiet_phieu_nhap_id INTEGER,
        ngay_san_xuat TEXT,
        han_su_dung TEXT,
        so_luong_nhap INTEGER NOT NULL,
        so_luong_con INTEGER NOT NULL
    );
    CREATE TABLE lich_su_kho (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        san_pham_id INTEGER NOT NULL,
        loai_giao_dich TEXT NOT NULL,
        so_luong_thay_doi INTEGER NOT NULL,
        ton_sau_giao_dich INTEGER NOT NULL,
        tham_chieu_loai TEXT,
        tham_chieu_id INTEGER,
        nguoi_thuc_hien_id INTEGER,
        ghi_chu TEXT,
        ngay_tao TEXT DEFAULT CURRENT_TIMESTAMP
    );'
);
$pdo->exec(
    "INSERT INTO danh_muc VALUES
        (1, 'Thực phẩm', 'thuc-pham', 1),
        (2, 'Đồ uống', 'do-uong', 1)"
);
$insertProduct = $pdo->prepare(
    'INSERT INTO san_pham
        (id, danh_muc_id, ten_san_pham, ten_khong_dau, mo_ta, hinh_anh,
         don_vi_tinh, gia_ban, so_luong_ton, muc_ton_toi_thieu, trang_thai, luot_ban)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 10, ?, ?)'
);
for ($id = 1; $id <= 12; $id++) {
    $price = $id <= 10 ? 1000 : 2000;
    $insertProduct->execute([
        $id,
        1,
        'Sản phẩm ' . $id,
        'san pham ' . $id,
        'Mô tả thử',
        'cái',
        $price,
        5,
        1,
        20 - $id,
    ]);
}
$insertProduct->execute([13, 1, 'Sản phẩm ẩn', 'san pham an', 'Mô tả', 'cái', 1000, 5, 1, 0]);
$insertProduct->execute([14, 1, 'Sản phẩm hết hàng', 'san pham het hang', 'Mô tả', 'cái', 1000, 0, 1, 0]);
$insertProduct->execute([20, 2, 'Sản phẩm tồn kho', 'san pham ton kho', 'Mô tả', 'cái', 3000, 10, 1, 0]);
$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Ho_Chi_Minh'));
$todayValue = $today->format('Y-m-d');
$pastDate = $today->modify('-2 days')->format('Y-m-d');
$soonDate = $today->modify('+5 days')->format('Y-m-d');
$laterDate = $today->modify('+200 days')->format('Y-m-d');
$pdo->exec(
    "INSERT INTO khuyen_mai VALUES
        (1, 'THU_SAU', 10, 10, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59')"
);
for ($id = 1; $id <= 10; $id++) {
    $pdo->prepare(
        'INSERT INTO khuyen_mai_san_pham (khuyen_mai_id, san_pham_id) VALUES (1, ?)'
    )->execute([$id]);
}
$pdo->prepare(
    'INSERT INTO lo_hang (san_pham_id, ngay_san_xuat, han_su_dung, so_luong_nhap, so_luong_con)
     VALUES (?, ?, ?, ?, ?)'
)->execute([1, $pastDate, '2026-03-10', 1, 1]);
$pdo->prepare(
    'INSERT INTO lo_hang (san_pham_id, ngay_san_xuat, han_su_dung, so_luong_nhap, so_luong_con)
     VALUES (?, ?, ?, ?, ?)'
)->execute([20, $pastDate, $soonDate, 4, 4]);
$pdo->prepare(
    'INSERT INTO lo_hang (san_pham_id, ngay_san_xuat, han_su_dung, so_luong_nhap, so_luong_con)
     VALUES (?, ?, ?, ?, ?)'
)->execute([20, $pastDate, $laterDate, 6, 6]);
$pdo->exec(
    'INSERT INTO san_pham_mua_kem (san_pham_id, san_pham_goi_y_id) VALUES (1, 2), (1, 20)'
);

$business = [
    'stock' => ['low_stock_threshold_default' => 7],
    'promotion' => [
        'friday_product_count' => 10,
        'friday_iso_weekday' => 5,
        'near_expiry_days' => 10,
        'near_expiry_percent' => 50,
    ],
];
$timezone = new DateTimeZone('Asia/Ho_Chi_Minh');
$promotionService = new PromotionService($pdo, $business, $timezone);
$productController = new ProductController(
    $pdo,
    $promotionService,
    new ProductImageService(),
    ['env' => 'development', 'timezone' => 'Asia/Ho_Chi_Minh'],
    $business
);
$stockController = new StockAdminController($pdo, $business);
$productAdminController = new ProductAdminController(
    $pdo,
    new ProductImageService(),
    $business
);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_id('inventory-feature-test-' . getmypid());
    session_start();
}
$_SESSION = ['user_id' => 999];

$invoke = static function (
    callable $action,
    string $method,
    string $path,
    array $body = [],
    array $query = [],
    array $routeParams = []
): array {
    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI'] = '/monsmokee/backend/public' . $path;
    $_SERVER['SCRIPT_NAME'] = '/monsmokee/backend/public/index.php';
    $_GET = $query;
    $_POST = $body;
    http_response_code(200);
    ob_start();
    $action(new Request(), $routeParams);
    $json = ob_get_clean();
    return ['status' => http_response_code(), 'body' => json_decode((string) $json, true)];
};

$result = $invoke(
    [$productController, 'index'],
    'GET',
    '/api/products',
    [],
    ['category_id' => '1', 'min_price' => '850', 'max_price' => '950', 'now' => '2026-03-06']
);
$filteredIds = array_column($result['body']['data']['products'] ?? [], 'id');
$assert(
    $result['status'] === 200 && count($filteredIds) === 9 && !in_array(1, $filteredIds, true),
    'Price range must use effective price, including the near-expiry discount'
);
$priceFilterStatus = $result['status'];
$result = $invoke(
    [$productController, 'index'],
    'GET',
    '/api/products',
    [],
    ['min_price' => '951', 'max_price' => '950']
);
$assert($result['status'] === 422, 'min_price greater than max_price must return 422');
$invalidPriceRangeStatus = $result['status'];
$result = $invoke(
    [$productController, 'index'],
    'GET',
    '/api/products',
    [],
    ['min_price' => '1.5']
);
$assert($result['status'] === 422, 'Fractional min_price must return 422');
$fractionalPriceStatus = $result['status'];

$result = $invoke(
    [$productController, 'suggestions'],
    'GET',
    '/api/products/1/suggestions',
    [],
    ['now' => '2026-03-06'],
    ['id' => '1']
);
$suggestions = $result['body']['data']['suggestions'] ?? [];
$suggestionIds = array_column($suggestions, 'id');
$assert(
    $result['status'] === 200
        && count($suggestions) === 8
        && !in_array(1, $suggestionIds, true)
        && in_array(20, $suggestionIds, true)
        && !in_array(13, $suggestionIds, true)
        && !in_array(14, $suggestionIds, true),
    'Suggestions must prefer curated items, fill from same category, filter unavailable products, and cap at eight: '
        . json_encode($result, JSON_UNESCAPED_UNICODE)
);
$suggestionStatus = $result['status'];
$assert(
    !array_key_exists('han_su_dung', $suggestions[0]),
    'Customer suggestions must not expose expiry dates for products without near-expiry discounts'
);
$assert(
    (int) $suggestions[0]['gia_ban_hieu_luc'] === 900,
    'Suggested product price must use the active server-calculated promotion'
);
$result = $invoke(
    [$productController, 'show'],
    'GET',
    '/api/products/2',
    [],
    [],
    ['id' => '2']
);
$assert(
    $result['status'] === 200
        && !array_key_exists('han_su_dung', $result['body']['data']['product']),
    'Customer product detail must not expose expiry for a regular product'
);
$result = $invoke(
    [$productController, 'suggestions'],
    'GET',
    '/api/products/999/suggestions',
    [],
    [],
    ['id' => '999']
);
$assert($result['status'] === 404, 'Suggestions for missing product must return 404');
$missingSuggestionsStatus = $result['status'];

$result = $invoke(
    [$productAdminController, 'updateCrossSell'],
    'PUT',
    '/api/admin/products/1/cross-sell',
    ['san_pham_ids' => [20, 2]],
    [],
    ['id' => '1']
);
$assert(
    $result['status'] === 200
        && (int) $pdo->query('SELECT COUNT(*) FROM san_pham_mua_kem WHERE san_pham_id = 1')->fetchColumn() === 2,
    'Admin cross-sell update must replace the curated recommendations'
);
$crossSellStatus = $result['status'];
$result = $invoke(
    [$productAdminController, 'updateCrossSell'],
    'PUT',
    '/api/admin/products/1/cross-sell',
    ['san_pham_ids' => [2, 3, 4, 5, 6, 7, 8, 9, 10]],
    [],
    ['id' => '1']
);
$assert($result['status'] === 422, 'More than eight cross-sell IDs must return 422');
$crossSellLimitStatus = $result['status'];
$result = $invoke(
    [$productAdminController, 'updateCrossSell'],
    'PUT',
    '/api/admin/products/1/cross-sell',
    ['san_pham_ids' => [1, 2]],
    [],
    ['id' => '1']
);
$assert($result['status'] === 422, 'Cross-sell list containing its own product must return 422');
$crossSellSelfStatus = $result['status'];
$result = $invoke(
    [$productAdminController, 'updateCrossSell'],
    'PUT',
    '/api/admin/products/1/cross-sell',
    ['san_pham_ids' => [2, 2]],
    [],
    ['id' => '1']
);
$assert($result['status'] === 422, 'Duplicate cross-sell IDs must return 422');
$crossSellDuplicateStatus = $result['status'];
$result = $invoke(
    [$productAdminController, 'updateCrossSell'],
    'PUT',
    '/api/admin/products/1/cross-sell',
    ['san_pham_ids' => [999]],
    [],
    ['id' => '1']
);
$assert($result['status'] === 422, 'Unknown cross-sell ID must return 422');
$crossSellMissingStatus = $result['status'];

$createProductBody = [
    'ten' => 'Sản phẩm mới thử',
    'danh_muc_id' => 1,
    'gia' => 5000,
    'don_vi_tinh' => 'chai',
    'mo_ta' => 'Dữ liệu giả',
];
$result = $invoke(
    [$productAdminController, 'create'],
    'POST',
    '/api/admin/products',
    $createProductBody
);
$newProductId = (int) ($result['body']['data']['id'] ?? 0);
$assert(
    $result['status'] === 201
        && (int) $pdo->query('SELECT muc_ton_toi_thieu FROM san_pham WHERE id = ' . $newProductId)->fetchColumn() === 7,
    'New product must use the configured default minimum stock'
);
$defaultThresholdStatus = $result['status'];
$createProductBody['ten'] = 'Sản phẩm ngưỡng riêng';
$createProductBody['muc_ton_toi_thieu'] = 3;
$result = $invoke(
    [$productAdminController, 'create'],
    'POST',
    '/api/admin/products',
    $createProductBody
);
$customThresholdId = (int) ($result['body']['data']['id'] ?? 0);
$assert(
    $result['status'] === 201
        && (int) $pdo->query('SELECT muc_ton_toi_thieu FROM san_pham WHERE id = ' . $customThresholdId)->fetchColumn() === 3,
    'Admin must be able to set minimum stock when creating a product'
);
$customThresholdCreateStatus = $result['status'];
$updateBody = [
    'ten' => 'Sản phẩm mới thử',
    'danh_muc_id' => 1,
    'gia' => 5000,
    'don_vi_tinh' => 'chai',
    'mo_ta' => 'Dữ liệu giả',
    'muc_ton_toi_thieu' => 2,
];
$result = $invoke(
    [$productAdminController, 'update'],
    'PUT',
    '/api/admin/products/' . $newProductId,
    $updateBody,
    [],
    ['id' => (string) $newProductId]
);
$assert(
    $result['status'] === 200
        && (int) $pdo->query('SELECT muc_ton_toi_thieu FROM san_pham WHERE id = ' . $newProductId)->fetchColumn() === 2,
    'Admin must be able to change minimum stock when editing a product'
);
$thresholdUpdateStatus = $result['status'];

$result = $invoke([$stockController, 'lowStock'], 'GET', '/api/admin/inventory/low-stock');
$lowStockProducts = $result['body']['data']['products'] ?? [];
$assert(
    $result['status'] === 200
        && count(array_filter(
            $lowStockProducts,
            static fn(array $item): bool => $item['san_pham_id'] === 14 && $item['so_luong_ton'] === 0
        )) === 1,
    'Low-stock endpoint must include zero stock products under their threshold'
);
$lowStockStatus = $result['status'];

$result = $invoke(
    [$stockController, 'expiring'],
    'GET',
    '/api/admin/inventory/expiring',
    [],
    ['days' => '30']
);
$expiringBatches = $result['body']['data']['batches'] ?? [];
$assert(
    $result['status'] === 200
        && count(array_filter(
            $expiringBatches,
            static fn(array $batch): bool =>
                $batch['san_pham_id'] === 20
                && $batch['han_su_dung'] === $soonDate
                && $batch['ngay_san_xuat'] === $pastDate
        )) === 1,
    'Admin expiring endpoint must return valid in-range lots with production and expiry dates'
);
$expiringStatus = $result['status'];
$result = $invoke(
    [$stockController, 'expiring'],
    'GET',
    '/api/admin/inventory/expiring',
    [],
    ['days' => '0']
);
$assert($result['status'] === 422, 'Invalid expiring window must return 422');
$invalidExpiringStatus = $result['status'];

$receiptBody = [
    'ngay_nhap' => $todayValue,
    'chi_tiet' => [[
        'san_pham_id' => 20,
        'so_luong' => 2,
        'gia_nhap' => 100,
        'ngay_san_xuat' => $pastDate,
        'han_su_dung' => $today->modify('+90 days')->format('Y-m-d'),
        'so_lo' => 'TEST-RECEIPT-01',
    ]],
];
$missingManufacture = $receiptBody;
unset($missingManufacture['chi_tiet'][0]['ngay_san_xuat']);
$result = $invoke(
    [$stockController, 'createReceipt'],
    'POST',
    '/api/admin/stock-receipts',
    $missingManufacture
);
$assert($result['status'] === 422, 'Receipt line without production date must return 422');
$missingManufactureStatus = $result['status'];
$futureManufacture = $receiptBody;
$futureManufacture['chi_tiet'][0]['ngay_san_xuat'] = $today->modify('+1 day')->format('Y-m-d');
$result = $invoke(
    [$stockController, 'createReceipt'],
    'POST',
    '/api/admin/stock-receipts',
    $futureManufacture
);
$assert($result['status'] === 422, 'Future production date must return 422');
$futureManufactureStatus = $result['status'];
$invalidExpiry = $receiptBody;
$invalidExpiry['chi_tiet'][0]['han_su_dung'] = $pastDate;
$result = $invoke(
    [$stockController, 'createReceipt'],
    'POST',
    '/api/admin/stock-receipts',
    $invalidExpiry
);
$assert($result['status'] === 422, 'Expiry on or before production date must return 422');
$invalidExpiryStatus = $result['status'];
$result = $invoke(
    [$stockController, 'createReceipt'],
    'POST',
    '/api/admin/stock-receipts',
    $receiptBody
);
$receiptId = (int) ($result['body']['data']['id'] ?? 0);
$assert($result['status'] === 201, 'Valid stock receipt with production date must return 201');
$validReceiptStatus = $result['status'];
$receiptDates = $pdo->prepare(
    'SELECT d.ngay_san_xuat, d.han_su_dung, b.ngay_san_xuat AS batch_production
     FROM chi_tiet_phieu_nhap d
     JOIN lo_hang b ON b.chi_tiet_phieu_nhap_id = d.id
     WHERE d.phieu_nhap_id = ?'
);
$receiptDates->execute([$receiptId]);
$storedDates = $receiptDates->fetch(PDO::FETCH_ASSOC);
$assert(
    $storedDates !== false
        && $storedDates['ngay_san_xuat'] === $pastDate
        && $storedDates['batch_production'] === $pastDate,
    'Production date must be stored consistently in receipt detail and batch'
);

$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    [
        'san_pham_id' => 20,
        'so_luong_moi' => 8,
        'ly_do' => 'Kiểm kê giảm theo FEFO',
    ]
);
$firstExpiryRemaining = $pdo->prepare(
    'SELECT so_luong_con FROM lo_hang WHERE san_pham_id = 20 AND han_su_dung = ?'
);
$firstExpiryRemaining->execute([$soonDate]);
$assert(
    $result['status'] === 200 && (int) $firstExpiryRemaining->fetchColumn() === 0,
    'Stock reduction must consume the earliest-expiring lot first'
);
$fefoReductionStatus = $result['status'];
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    [
        'san_pham_id' => 20,
        'so_luong_moi' => 0,
        'ly_do' => 'Kiểm kê giảm tồn',
    ]
);
$assert(
    $result['status'] === 200
        && (int) $pdo->query('SELECT so_luong_ton FROM san_pham WHERE id = 20')->fetchColumn() === 0
        && (int) $pdo->query('SELECT COALESCE(SUM(so_luong_con), 0) FROM lo_hang WHERE san_pham_id = 20')->fetchColumn() === 0,
    'Stock reduction to zero must consume all lots and never create negative inventory'
);
$reduceToZeroStatus = $result['status'];
$historyRow = $pdo->query(
    'SELECT loai_giao_dich, so_luong_thay_doi, ton_sau_giao_dich, nguoi_thuc_hien_id, ghi_chu
     FROM lich_su_kho ORDER BY id DESC LIMIT 1'
)->fetch(PDO::FETCH_ASSOC);
$assert(
    $historyRow !== false
        && $historyRow['loai_giao_dich'] === 'DIEU_CHINH'
        && (int) $historyRow['so_luong_thay_doi'] < 0
        && (int) $historyRow['ton_sau_giao_dich'] === 0
        && (int) $historyRow['nguoi_thuc_hien_id'] === 999
        && $historyRow['ghi_chu'] === 'Kiểm kê giảm tồn',
    'Stock adjustment history must record its type, reason, and Admin actor'
);
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    [
        'san_pham_id' => 20,
        'so_luong_moi' => 4,
        'ly_do' => 'Kiểm kê tăng tồn',
        'ngay_san_xuat' => $pastDate,
        'han_su_dung' => $today->modify('+365 days')->format('Y-m-d'),
    ]
);
$assert(
    $result['status'] === 200
        && (int) $pdo->query('SELECT so_luong_ton FROM san_pham WHERE id = 20')->fetchColumn() === 4,
    'Stock increase must create an adjustment batch and update total inventory'
);
$increaseStatus = $result['status'];
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    ['san_pham_id' => 20, 'so_luong_moi' => 5, 'ly_do' => 'Thiếu ngày lô']
);
$assert(
    $result['status'] === 422
        && (int) $pdo->query('SELECT so_luong_ton FROM san_pham WHERE id = 20')->fetchColumn() === 4,
    'Stock increase without lot dates must fail and roll back'
);
$missingAdjustmentDatesStatus = $result['status'];
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    [
        'san_pham_id' => 20,
        'so_luong_moi' => 5,
        'ly_do' => 'Hạn trước ngày sản xuất',
        'ngay_san_xuat' => $pastDate,
        'han_su_dung' => $pastDate,
    ]
);
$assert($result['status'] === 422, 'Adjustment expiry on or before production must return 422');
$invalidAdjustmentDatesStatus = $result['status'];
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    ['san_pham_id' => 20, 'so_luong_moi' => -1, 'ly_do' => 'Tồn âm']
);
$assert($result['status'] === 422, 'Negative stock target must return 422');
$negativeStockStatus = $result['status'];
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    ['san_pham_id' => 20, 'so_luong_moi' => 5]
);
$assert($result['status'] === 422, 'Adjustment without a reason must return 422');
$missingReasonStatus = $result['status'];

$pdo->exec('UPDATE san_pham SET so_luong_ton = 5 WHERE id = 20');
$result = $invoke(
    [$stockController, 'adjust'],
    'POST',
    '/api/admin/inventory/adjust',
    ['san_pham_id' => 20, 'so_luong_moi' => 1, 'ly_do' => 'Kiểm tra lệch lô']
);
$assert(
    $result['status'] === 409
        && (int) $pdo->query('SELECT so_luong_ton FROM san_pham WHERE id = 20')->fetchColumn() === 5,
    'A product/batch mismatch must reject adjustment without changing inventory'
);
$batchMismatchStatus = $result['status'];

$adminRoutes = file_get_contents(dirname(__DIR__) . '/routes/admin.php');
$assert(
    is_string($adminRoutes)
        && preg_match(
            '/\$router->post\(\s*\'\/api\/admin\/inventory\/adjust\'.*?\[\$requireVerifiedAdmin,\s*\$requireAdminCsrf\]\s*\)/s',
            $adminRoutes
        ) === 1,
    'Stock adjustment route must require AdminMiddleware and CSRF middleware'
);
$assert(
    is_string($adminRoutes)
        && preg_match(
            '/\$router->put\(\s*\'\/api\/admin\/products\/\{id\}\/cross-sell\'.*?\[\$requireVerifiedAdmin,\s*\$requireAdminCsrf\]\s*\)/s',
            $adminRoutes
        ) === 1,
    'Cross-sell write route must require AdminMiddleware and CSRF middleware'
);

$_SESSION = [];
session_destroy();

echo 'Inventory/product feature tests passed: '
    . 'effective-price-filter=' . $priceFilterStatus
    . ', invalid-ranges=' . $invalidPriceRangeStatus . '/' . $fractionalPriceStatus
    . ', suggestions=' . $suggestionStatus . ', missing-suggestions=' . $missingSuggestionsStatus
    . ', cross-sell=' . $crossSellStatus . ', cross-sell-invalid=' . $crossSellLimitStatus
    . '/' . $crossSellSelfStatus . '/' . $crossSellDuplicateStatus . '/' . $crossSellMissingStatus
    . ', threshold-default/create/update=' . $defaultThresholdStatus . '/'
    . $customThresholdCreateStatus . '/' . $thresholdUpdateStatus
    . ', low-stock=' . $lowStockStatus . ', expiring=' . $expiringStatus
    . ', invalid-expiring=' . $invalidExpiringStatus
    . ', receipt-manufacture-missing/future/expiry-order=' . $missingManufactureStatus . '/'
    . $futureManufactureStatus . '/' . $invalidExpiryStatus
    . ', receipt-valid=' . $validReceiptStatus
    . ', adjust-fefo/zero/increase=' . $fefoReductionStatus . '/' . $reduceToZeroStatus . '/' . $increaseStatus
    . ', adjust-no-dates/date-order/negative/missing-reason/mismatch='
    . $missingAdjustmentDatesStatus . '/' . $invalidAdjustmentDatesStatus . '/'
    . $negativeStockStatus . '/' . $missingReasonStatus . '/' . $batchMismatchStatus
    . PHP_EOL;
