<?php
declare(strict_types=1);

require dirname(__DIR__) . '/core/Request.php';
require dirname(__DIR__) . '/core/Response.php';
require dirname(__DIR__) . '/core/Session.php';
require dirname(__DIR__) . '/core/Validator.php';
require dirname(__DIR__) . '/app/Middleware/AuthMiddleware.php';
require dirname(__DIR__) . '/app/Services/OtpService.php';
require dirname(__DIR__) . '/app/Services/Mail/OtpSenderInterface.php';
require dirname(__DIR__) . '/app/Services/CartService.php';
require dirname(__DIR__) . '/app/Services/PromotionService.php';
require dirname(__DIR__) . '/app/Services/ProductImageService.php';
require dirname(__DIR__) . '/app/Controllers/Customer/CartController.php';
require dirname(__DIR__) . '/app/Controllers/Customer/AuthController.php';

use App\Controllers\Customer\AuthController;
use App\Controllers\Customer\CartController;
use App\Middleware\AuthMiddleware;
use App\Services\CartService;
use App\Services\Mail\OtpSenderInterface;
use App\Services\OtpService;
use App\Services\ProductImageService;
use App\Services\PromotionService;
final class CartTestPdo extends PDO
{
    private PDO $sqlite;

    public function __construct()
    {
        $this->sqlite = new PDO('sqlite::memory:');
        $this->sqlite->sqliteCreateFunction('NOW', static fn(): string => date('Y-m-d H:i:s'));
        $this->sqlite->sqliteCreateFunction(
            'TIMESTAMPDIFF',
            static fn(string $unit, string $start, string $end): int => (int) strtotime($end) - (int) strtotime($start),
            3
        );
    }

    public function exec(string $statement): int|false
    {
        return $this->sqlite->exec($this->translate($statement));
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return $this->sqlite->prepare($this->translate($query), $options);
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
        $query = str_ireplace('INSERT IGNORE INTO', 'INSERT OR IGNORE INTO', $query);
        $query = preg_replace(
            '/TIMESTAMPDIFF\(\s*SECOND\s*,/i',
            "TIMESTAMPDIFF('SECOND',",
            $query
        ) ?? $query;
        $query = preg_replace(
            '/NOW\(\)\s*-\s*INTERVAL\s+1\s+HOUR/i',
            "datetime(NOW(), '-1 hour')",
            $query
        ) ?? $query;
        $query = preg_replace(
            '/ON DUPLICATE KEY UPDATE\s+so_luong\s*=\s*VALUES\(so_luong\)/i',
            'ON CONFLICT(user_id, san_pham_id) DO UPDATE SET so_luong = excluded.so_luong',
            $query
        ) ?? $query;
        return preg_replace('/\s+FOR UPDATE\b/i', '', $query) ?? $query;
    }
}

final class CartTestOtpSender implements OtpSenderInterface
{
    public function send(string $email, string $otp, string $purpose): void
    {
    }
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$pdo = new CartTestPdo();
$pdo->exec(
    'CREATE TABLE danh_muc (
        id INTEGER PRIMARY KEY,
        trang_thai INTEGER NOT NULL
    );
    CREATE TABLE san_pham (
        id INTEGER PRIMARY KEY,
        danh_muc_id INTEGER NOT NULL,
        ten_san_pham TEXT NOT NULL,
        hinh_anh TEXT NULL,
        don_vi_tinh TEXT NULL,
        gia_ban INTEGER NOT NULL,
        so_luong_ton INTEGER NOT NULL,
        trang_thai INTEGER NOT NULL
    );
    CREATE TABLE gio_hang (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        san_pham_id INTEGER NOT NULL,
        so_luong INTEGER NOT NULL,
        ngay_cap_nhat TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, san_pham_id)
    );
    CREATE TABLE khuyen_mai (
        id INTEGER PRIMARY KEY,
        loai TEXT NOT NULL,
        phan_tram_giam INTEGER NOT NULL,
        trang_thai INTEGER NOT NULL,
        so_san_pham INTEGER NOT NULL,
        ngay_bat_dau TEXT NOT NULL,
        ngay_ket_thuc TEXT NOT NULL
    );
    CREATE TABLE khuyen_mai_san_pham (
        khuyen_mai_id INTEGER NOT NULL,
        san_pham_id INTEGER NOT NULL
    );
    CREATE TABLE lo_hang (
        id INTEGER PRIMARY KEY,
        san_pham_id INTEGER NOT NULL,
        han_su_dung TEXT NOT NULL,
        so_luong_con INTEGER NOT NULL
    );
    CREATE TABLE vai_tro (
        id INTEGER PRIMARY KEY,
        ten_vai_tro TEXT NOT NULL
    );
    CREATE TABLE nguoi_dung (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vai_tro_id INTEGER NOT NULL,
        ho_ten TEXT NOT NULL,
        so_dien_thoai TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        mat_khau TEXT NOT NULL,
        trang_thai INTEGER NOT NULL
    );
    CREATE TABLE rate_limit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        khoa TEXT NOT NULL UNIQUE,
        so_lan INTEGER NOT NULL,
        bat_dau TEXT NOT NULL,
        khoa_den TEXT NULL
    );
    CREATE TABLE otp_xac_thuc (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        muc_dich TEXT NOT NULL,
        email TEXT NOT NULL,
        ma_otp_hash TEXT NOT NULL,
        du_lieu_tam TEXT NULL,
        het_han_luc TEXT NOT NULL,
        so_lan_nhap_sai INTEGER NOT NULL DEFAULT 0,
        da_su_dung INTEGER NOT NULL DEFAULT 0,
        ip TEXT NULL,
        ngay_tao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );'
);
$pdo->exec("INSERT INTO danh_muc (id, trang_thai) VALUES (1, 1)");
$insertProduct = $pdo->prepare(
    'INSERT INTO san_pham
     (id, danh_muc_id, ten_san_pham, hinh_anh, don_vi_tinh, gia_ban, so_luong_ton, trang_thai)
     VALUES (?, 1, ?, NULL, ?, 1000, ?, ?)'
);
for ($id = 1; $id <= 11; $id++) {
    $insertProduct->execute([$id, 'Sản phẩm ' . $id, 'cái', 10, 1]);
}
$insertProduct->execute([12, 'Sản phẩm ẩn', 'cái', 10, 0]);
$insertProduct->execute([13, 'Sản phẩm hết hàng', 'cái', 0, 1]);
$insertProduct->execute([14, 'Sản phẩm tồn thấp', 'cái', 2, 1]);
$pdo->exec(
    "INSERT INTO khuyen_mai
     (id, loai, phan_tram_giam, trang_thai, so_san_pham, ngay_bat_dau, ngay_ket_thuc)
     VALUES (1, 'THU_SAU', 10, 1, 10, '2026-01-01 00:00:00', '2026-12-31 23:59:59')"
);
for ($id = 1; $id <= 10; $id++) {
    $pdo->prepare(
        'INSERT INTO khuyen_mai_san_pham (khuyen_mai_id, san_pham_id) VALUES (1, ?)'
    )->execute([$id]);
}
$pdo->exec("INSERT INTO lo_hang (id, san_pham_id, han_su_dung, so_luong_con) VALUES (1, 1, '2026-03-10', 5), (2, 11, '2026-03-10', 5)");
$pdo->exec("INSERT INTO vai_tro (id, ten_vai_tro) VALUES (1, 'Customer')");
$pdo->exec("INSERT INTO vai_tro (id, ten_vai_tro) VALUES (2, 'Admin')");
$userInsert = $pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (1, ?, ?, ?, ?, 1)'
);
$userInsert->execute(['Test Customer', '0900000001', 'customer1@example.invalid', password_hash('Test-Customer-123!', PASSWORD_BCRYPT)]);
$userInsert->execute(['Other Customer', '0900000002', 'customer2@example.invalid', password_hash('Test-Customer-456!', PASSWORD_BCRYPT)]);
$pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (2, ?, ?, ?, ?, 1)'
)->execute(['Test Admin', '0900000003', 'admin@example.invalid', password_hash('Test-Admin-123!', PASSWORD_BCRYPT)]);

$business = [
    'cart' => ['max_qty_per_line' => 3],
    'login' => ['max_fail' => 5, 'lock_minutes' => 15],
    'otp' => [
        'ttl_seconds' => 300,
        'resend_cooldown_seconds' => 60,
        'max_sends_per_hour' => 5,
        'length' => 6,
        'max_wrong_attempts' => 5,
    ],
    'promotion' => [
        'friday_product_count' => 10,
        'friday_iso_weekday' => 5,
        'near_expiry_days' => 10,
        'near_expiry_percent' => 50,
    ],
];
$cartService = new CartService($pdo, $business);
$promotionService = new PromotionService($pdo, $business, new DateTimeZone('Asia/Ho_Chi_Minh'));
$controller = new CartController(
    $cartService,
    $promotionService,
    new ProductImageService(),
    ['env' => 'development', 'timezone' => 'Asia/Ho_Chi_Minh'],
    $business
);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
$_SESSION = [];
$invokeCart = static function (
    string $method,
    string $path,
    array $body = [],
    array $query = [],
    array $routeParams = []
) use ($controller): array {
    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI'] = '/monsmokee/backend/public' . $path;
    $_SERVER['SCRIPT_NAME'] = '/monsmokee/backend/public/index.php';
    $_SERVER['REMOTE_ADDR'] = '198.51.100.20';
    $_POST = $body;
    $_GET = $query;
    $request = new Request();
    ob_start();
    if ($method === 'GET') {
        $controller->index($request, $routeParams);
    } elseif ($path === '/api/cart/items') {
        $controller->addItem($request, $routeParams);
    } elseif ($method === 'PATCH') {
        $controller->updateItem($request, $routeParams);
    } elseif ($method === 'DELETE' && isset($routeParams['san_pham_id'])) {
        $controller->deleteItem($request, $routeParams);
    } else {
        $controller->clear($request, $routeParams);
    }
    $json = ob_get_clean();
    return ['status' => http_response_code(), 'body' => json_decode($json, true)];
};

$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 2, 'so_luong' => 1]);
$assert($result['status'] === 200, 'Add item must return HTTP 200');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 2, 'so_luong' => 2]);
$assert($result['status'] === 200, 'Adding a duplicate item must return HTTP 200');
$result = $invokeCart('GET', '/api/cart');
$assert($result['status'] === 200 && $result['body']['data']['items'][0]['so_luong'] === 3, 'Duplicate add must accumulate quantity');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 2, 'so_luong' => 1]);
$assert($result['status'] === 422, 'Quantity above max_qty_per_line must return HTTP 422');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 13, 'so_luong' => 1]);
$assert($result['status'] === 422, 'Out-of-stock product must return HTTP 422');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 12, 'so_luong' => 1]);
$assert($result['status'] === 422, 'Hidden product must return HTTP 422');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 2, 'so_luong' => 0]);
$assert($result['status'] === 422, 'Quantity below one must return HTTP 422');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 14, 'so_luong' => 3]);
$assert($result['status'] === 422, 'Quantity above current stock must return HTTP 422');
$result = $invokeCart('POST', '/api/cart/items', [
    'san_pham_id' => 2,
    'so_luong' => 1,
    'gia_ban' => 1,
]);
$assert($result['status'] === 422, 'Client-supplied price must be rejected');
$result = $invokeCart('PATCH', '/api/cart/items/2', ['so_luong' => 2], [], ['san_pham_id' => '2']);
$assert($result['status'] === 200, 'Updating quantity must return HTTP 200');
$result = $invokeCart('DELETE', '/api/cart/items/2', [], [], ['san_pham_id' => '2']);
$assert($result['status'] === 200, 'Deleting item must return HTTP 200');
$invokeCart('POST', '/api/cart/items', ['san_pham_id' => 2, 'so_luong' => 1]);
$result = $invokeCart('DELETE', '/api/cart');
$assert($result['status'] === 200, 'Clearing the cart must return HTTP 200');
$result = $invokeCart('GET', '/api/cart');
$assert($result['status'] === 200 && $result['body']['data']['items'] === [], 'Clearing the cart must remove all guest items');
$result = $invokeCart('POST', '/api/cart/items', ['san_pham_id' => 1, 'so_luong' => 1]);
$assert($result['status'] === 200, 'Add item eligible for both promotions must return HTTP 200');
$invokeCart('POST', '/api/cart/items', ['san_pham_id' => 2, 'so_luong' => 1]);
$invokeCart('POST', '/api/cart/items', ['san_pham_id' => 11, 'so_luong' => 1]);
$result = $invokeCart('GET', '/api/cart', [], ['now' => '2026-03-06']);
$byId = [];
foreach ($result['body']['data']['items'] as $item) {
    $byId[$item['san_pham_id']] = $item;
}
$assert($result['status'] === 200, 'Cart repricing with a development date must return HTTP 200');
$assert($byId[2]['gia_ban_hieu_luc'] === 900 && $byId[2]['nhan_khuyen_mai'] === 'THU_SAU', 'Friday promotion must price at 900 VND');
$assert($byId[11]['gia_ban_hieu_luc'] === 500 && $byId[11]['nhan_khuyen_mai'] === 'CAN_HAN', 'Near-expiry promotion must price at 500 VND');
$assert($byId[1]['gia_ban_hieu_luc'] === 500 && $byId[1]['nhan_khuyen_mai'] === 'CAN_HAN', 'Higher near-expiry discount must beat Friday promotion');
$assert(
    $result['body']['data']['summary']['tam_tinh'] === 3000
        && $result['body']['data']['summary']['so_tien_duoc_giam'] === 1100
        && $result['body']['data']['summary']['tong_tien_hang'] === 1900,
    'Cart totals must be recalculated from effective prices'
);

$pdo->prepare('INSERT INTO gio_hang (user_id, san_pham_id, so_luong) VALUES (1, 2, 2)')->execute();
$pdo->prepare('INSERT INTO gio_hang (user_id, san_pham_id, so_luong) VALUES (2, 1, 1)')->execute();
$_SESSION['cart'] = [2 => 2];
$otpService = new OtpService($pdo, new CartTestOtpSender(), $business);
$authController = new AuthController(
    $pdo,
    new Validator(),
    $otpService,
    $business,
    [],
    $cartService
);
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/monsmokee/backend/public/api/auth/login';
$_SERVER['SCRIPT_NAME'] = '/monsmokee/backend/public/index.php';
$_POST = ['so_dien_thoai' => '0900000001', 'mat_khau' => 'Test-Customer-123!'];
$loginRequest = new Request();
ob_start();
$authController->login($loginRequest);
$loginJson = ob_get_clean();
$loginResponse = json_decode($loginJson, true);
$assert(http_response_code() === 200, 'Customer login must return HTTP 200');
$assert(!isset($_SESSION['cart']), 'Guest cart must be removed after login merge');
$mergedQty = $pdo->prepare('SELECT so_luong FROM gio_hang WHERE user_id = 1 AND san_pham_id = 2');
$mergedQty->execute();
$assert((int) $mergedQty->fetchColumn() === 3, 'Login must merge and clamp duplicate quantity');
$assert(
    count($loginResponse['data']['cart_merge']['adjusted_items']) === 1,
    'Login merge must report adjusted cart item'
);
$_SESSION = ['cart' => [11 => 1]];
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/monsmokee/backend/public/api/auth/login';
$_POST = ['so_dien_thoai' => '0900000001', 'mat_khau' => 'wrong-password'];
$failedLoginRequest = new Request();
ob_start();
$authController->login($failedLoginRequest);
$failedLoginResponse = json_decode(ob_get_clean(), true);
$assert(
    http_response_code() === 401
        && $_SESSION['cart'] === [11 => 1]
        && !isset($failedLoginResponse['data']['cart_merge']),
    'Failed login must return HTTP 401 and preserve guest cart without merging'
);
$pdo->prepare('INSERT INTO gio_hang (user_id, san_pham_id, so_luong) VALUES (1, 14, 1)')->execute();
$_SESSION['cart'] = [14 => 2];
$merge = $cartService->mergeGuestCart(1);
$mergedStockQty = $pdo->prepare('SELECT so_luong FROM gio_hang WHERE user_id = 1 AND san_pham_id = 14');
$mergedStockQty->execute();
$assert(
    (int) $mergedStockQty->fetchColumn() === 2
        && $merge['adjusted_items'][0]['ly_do'] === 'vuot_ton_kho',
    'Login merge must clamp to stock and report adjustment'
);

$_SESSION['user_id'] = 1;
$_SESSION['user_role'] = 'Customer';
$result = $invokeCart('GET', '/api/cart');
$visibleIds = array_column($result['body']['data']['items'], 'san_pham_id');
$assert($result['status'] === 200 && $visibleIds === [2, 14], 'Customer 1 must only see their own cart');
$result = $invokeCart('DELETE', '/api/cart/items/1', [], [], ['san_pham_id' => '1']);
$otherCartQty = $pdo->prepare('SELECT so_luong FROM gio_hang WHERE user_id = 2 AND san_pham_id = 1');
$otherCartQty->execute();
$assert(
    $result['status'] === 200 && (int) $otherCartQty->fetchColumn() === 1,
    'Customer 1 must not mutate Customer 2 cart'
);
$_SESSION['user_id'] = 2;
$_SESSION['user_role'] = 'Customer';
$result = $invokeCart('GET', '/api/cart');
$visibleIds = array_column($result['body']['data']['items'], 'san_pham_id');
$assert($result['status'] === 200 && $visibleIds === [1], 'Customer 2 must only see their own cart');

$_SESSION['user_id'] = null;
$_SESSION['user_role'] = null;
$_SESSION['cart'] = [11 => 1];
$adminAuthController = new AuthController(
    $pdo,
    new Validator(),
    new OtpService($pdo, new CartTestOtpSender(), $business),
    $business,
    [],
    $cartService
);
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/monsmokee/backend/public/api/auth/login';
$_POST = ['so_dien_thoai' => '0900000003', 'mat_khau' => 'Test-Admin-123!'];
$adminLoginRequest = new Request();
ob_start();
$adminAuthController->login($adminLoginRequest);
$adminLoginJson = ob_get_clean();
$adminLoginResponse = json_decode($adminLoginJson, true);
$assert(
    http_response_code() === 200
        && ($adminLoginResponse['data']['otp_required'] ?? false) === true
        && !isset($_SESSION['user_id'])
        && isset($_SESSION['admin_pending_user_id'])
        && !AuthMiddleware::isAuthenticated()
        && isset($_SESSION['cart'][11]),
    'Admin OTP pending must not merge guest cart or create an authenticated user session'
);

printf(
    "Cart tests passed: add=200, duplicate=200, max=422, stock=422, hidden=422, quantity-min=422, client-price=422, update=200, delete=200, clear=200, friday=200 (900 VND), near-expiry=200 (500 VND), higher-discount=200 (500 VND), totals=200 (3,000/1,100/1,900 VND), customer-login-merge=200 (clamped to 3), failed-login=401 (guest cart preserved), stock-merge-clamp=2, customer isolation=200/200, cross-customer delete=200 (other cart unchanged), admin-pending=200 (not merged)\n"
);
$_SESSION = [];
session_destroy();
