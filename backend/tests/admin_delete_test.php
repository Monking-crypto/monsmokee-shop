<?php
declare(strict_types=1);

require dirname(__DIR__) . '/core/Request.php';
require dirname(__DIR__) . '/core/Response.php';
require dirname(__DIR__) . '/core/Session.php';
require dirname(__DIR__) . '/core/Csrf.php';
require dirname(__DIR__) . '/core/Router.php';
require dirname(__DIR__) . '/app/Middleware/AuthMiddleware.php';
require dirname(__DIR__) . '/app/Middleware/AdminMiddleware.php';
require dirname(__DIR__) . '/app/Middleware/CsrfMiddleware.php';
require dirname(__DIR__) . '/app/Services/ProductImageService.php';
require dirname(__DIR__) . '/app/Controllers/Admin/CategoryAdminController.php';
require dirname(__DIR__) . '/app/Controllers/Admin/ProductAdminController.php';

use App\Controllers\Admin\CategoryAdminController;
use App\Controllers\Admin\ProductAdminController;
use App\Middleware\AdminMiddleware;
use App\Services\ProductImageService;

if (!class_exists('Logger')) {
    final class Logger
    {
        public static function write(string $fileName, string $message): void
        {
        }

        public static function error(string $message): void
        {
        }
    }
}

final class AdminDeleteTestPdo extends PDO
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

$pdo = new AdminDeleteTestPdo();
$pdo->exec(
    'CREATE TABLE danh_muc (
        id INTEGER PRIMARY KEY,
        ten_danh_muc TEXT NOT NULL,
        slug TEXT NOT NULL,
        icon TEXT,
        thu_tu INTEGER NOT NULL,
        trang_thai INTEGER NOT NULL
    );
    CREATE TABLE san_pham (
        id INTEGER PRIMARY KEY,
        danh_muc_id INTEGER NOT NULL,
        hinh_anh TEXT,
        trang_thai INTEGER NOT NULL,
        so_luong_ton INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE gio_hang (san_pham_id INTEGER NOT NULL);
    CREATE TABLE san_pham_mua_kem (
        san_pham_id INTEGER NOT NULL,
        san_pham_goi_y_id INTEGER NOT NULL
    );
    CREATE TABLE khuyen_mai_san_pham (san_pham_id INTEGER NOT NULL);
    CREATE TABLE danh_gia (san_pham_id INTEGER NOT NULL);
    CREATE TABLE chi_tiet_don_hang (san_pham_id INTEGER NOT NULL);
    CREATE TABLE chi_tiet_phieu_nhap (san_pham_id INTEGER NOT NULL);
    CREATE TABLE lo_hang (san_pham_id INTEGER NOT NULL);
    CREATE TABLE lich_su_kho (san_pham_id INTEGER NOT NULL);'
);
$pdo->exec(
    "INSERT INTO danh_muc VALUES
        (1, 'Danh mục rỗng', 'danh-muc-rong', 'box', 7, 1),
        (2, 'Danh mục có hàng bán', 'co-hang-ban', 'box', 12, 1),
        (3, 'Danh mục có hàng ẩn', 'co-hang-an', 'box', 18, 0),
        (4, 'Danh mục route', 'danh-muc-route', 'box', 23, 1);
     INSERT INTO san_pham VALUES (100, 2, NULL, 1, 3), (101, 3, NULL, 0, 0)"
);
$categoryController = new CategoryAdminController($pdo);
$productController = new ProductAdminController($pdo, new ProductImageService());

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_id('admin-delete-test-' . getmypid());
    session_start();
}

$invoke = static function (
    callable $action,
    string $method,
    string $path,
    array $body = [],
    array $routeParams = []
): array {
    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI'] = $path;
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_POST = $body;
    http_response_code(200);
    ob_start();
    $action(new Request(), $routeParams);
    $json = ob_get_clean();
    return ['status' => http_response_code(), 'body' => json_decode((string) $json, true)];
};

$statuses = [];
$result = $invoke([$categoryController, 'delete'], 'DELETE', '/api/admin/categories/1', [], ['id' => '1']);
$statuses['empty_category'] = $result['status'];
$assert($result['status'] === 200 && ($result['body']['data']['deleted'] ?? false), 'Empty category should be deleted');

$result = $invoke([$categoryController, 'delete'], 'DELETE', '/api/admin/categories/1', [], ['id' => '1']);
$statuses['category_repeat'] = $result['status'];
$assert($result['status'] === 404, 'Deleting a category twice should return 404');

foreach ([2 => 'active_category', 3 => 'hidden_product_category'] as $categoryId => $name) {
    $result = $invoke(
        [$categoryController, 'delete'],
        'DELETE',
        '/api/admin/categories/' . $categoryId,
        [],
        ['id' => (string) $categoryId]
    );
    $statuses[$name] = $result['status'];
    $assert(
        $result['status'] === 409
            && ($result['body']['errors']['code'] ?? null) === 'CATEGORY_HAS_PRODUCTS'
            && ($result['body']['errors']['so_san_pham'] ?? null) === 1,
        'Categories with visible or hidden products must return the conflict contract'
    );
}

$result = $invoke(
    [$categoryController, 'delete'],
    'DELETE',
    '/api/admin/categories/999',
    [],
    ['id' => '999']
);
$statuses['category_missing'] = $result['status'];
$assert($result['status'] === 404, 'Unknown category should return 404');
$orders = $pdo->query('SELECT id, thu_tu FROM danh_muc ORDER BY id')->fetchAll(PDO::FETCH_KEY_PAIR);
$assert($orders === [2 => 12, 3 => 18, 4 => 23], 'Deleting a category must not reorder the remaining categories');

$router = new Router();
$router->delete(
    '/api/admin/categories/{id}',
    [$categoryController, 'delete'],
    [[AdminMiddleware::class, 'handle'], [\CsrfMiddleware::class, 'handle']]
);
$dispatchRoute = static function (array $session, ?string $csrfHeader = null) use ($router): array {
    $_SESSION = $session;
    $_SERVER['REQUEST_METHOD'] = 'DELETE';
    $_SERVER['REQUEST_URI'] = '/api/admin/categories/4';
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    if ($csrfHeader === null) {
        unset($_SERVER['HTTP_X_CSRF_TOKEN']);
    } else {
        $_SERVER['HTTP_X_CSRF_TOKEN'] = $csrfHeader;
    }
    http_response_code(200);
    ob_start();
    $router->dispatch(new Request());
    $json = ob_get_clean();
    return ['status' => http_response_code(), 'body' => json_decode((string) $json, true)];
};

$result = $dispatchRoute([]);
$statuses['unauthenticated'] = $result['status'];
$assert($result['status'] === 401, 'Unauthenticated Admin route must return 401');

$result = $dispatchRoute(['user_id' => 5, 'user_role' => 'Customer']);
$statuses['customer_forbidden'] = $result['status'];
$assert($result['status'] === 403, 'Customer must be forbidden from Admin route');

$adminSession = [
    'user_id' => 9,
    'user_role' => 'Admin',
    'admin_otp_verified' => true,
    'csrf_token' => 'delete-test-csrf-token',
];
$result = $dispatchRoute($adminSession);
$statuses['missing_csrf'] = $result['status'];
$assert(
    $result['status'] === 403,
    'Admin mutation without CSRF must return 403; got '
        . $result['status'] . ': ' . json_encode($result['body'], JSON_UNESCAPED_UNICODE)
);

$adminRoutes = file_get_contents(dirname(__DIR__) . '/routes/admin.php');
$categoryRouteOffset = is_string($adminRoutes)
    ? strrpos($adminRoutes, "'/api/admin/categories/{id}'")
    : false;
$categoryRouteExcerpt = $categoryRouteOffset === false
    ? ''
    : substr($adminRoutes, $categoryRouteOffset, 200);
$assert(
    is_string($adminRoutes)
        && strpos($categoryRouteExcerpt, '[$categoryAdminController, \'delete\']') !== false
        && strpos($categoryRouteExcerpt, '[$requireVerifiedAdmin, $requireAdminCsrf]') !== false,
    'Category deletion route must require verified Admin and CSRF middleware'
);

$result = $dispatchRoute($adminSession, 'delete-test-csrf-token');
$statuses['valid_admin_route'] = $result['status'];
$assert($result['status'] === 200, 'Verified Admin with CSRF should be able to delete an empty category');

$pdo->exec(
    'INSERT INTO san_pham (id, danh_muc_id, hinh_anh, trang_thai, so_luong_ton) VALUES
        (200, 2, NULL, 1, 1),
        (201, 2, NULL, 1, 0),
        (202, 2, NULL, 1, 0),
        (203, 2, NULL, 1, 0)'
);
$pdo->prepare('INSERT INTO lich_su_kho (san_pham_id) VALUES (?)')->execute([200]);
$pdo->prepare('INSERT INTO lo_hang (san_pham_id) VALUES (?)')->execute([201]);
$pdo->prepare('INSERT INTO gio_hang (san_pham_id) VALUES (?)')->execute([202]);

foreach ([200 => 'stock_history', 201 => 'batch_history', 202 => 'cart_reference'] as $productId => $name) {
    $result = $invoke(
        [$productController, 'delete'],
        'DELETE',
        '/api/admin/products/' . $productId,
        [],
        ['id' => (string) $productId]
    );
    $statuses[$name] = $result['status'];
    $assert(
        $result['status'] === 409
            && ($result['body']['errors']['code'] ?? null) === 'PRODUCT_HAS_HISTORY'
            && (int) $pdo->query('SELECT COUNT(*) FROM san_pham WHERE id = ' . $productId)->fetchColumn() === 1,
        'Historical or cart-referenced products must not be hard-deleted'
    );
}

$result = $invoke(
    [$productController, 'updateVisibility'],
    'PATCH',
    '/api/admin/products/200/visibility',
    ['trang_thai' => 0],
    ['id' => '200']
);
$assert(
    $result['status'] === 200
        && (int) $pdo->query('SELECT trang_thai FROM san_pham WHERE id = 200')->fetchColumn() === 0,
    'Admin must retain a separate way to hide a historical product'
);

$uploadsDirectory = dirname(__DIR__) . '/uploads/products';
$createdUploadsDirectory = !is_dir($uploadsDirectory);
if ($createdUploadsDirectory && !mkdir($uploadsDirectory, 0755, true) && !is_dir($uploadsDirectory)) {
    throw new RuntimeException('Could not create temporary product upload directory');
}
$fileToken = bin2hex(random_bytes(16));
$mainImage = $uploadsDirectory . '/' . $fileToken . '.jpg';
$thumbnail = $uploadsDirectory . '/' . $fileToken . '_thumb.jpg';
$relativeImage = 'uploads/products/' . $fileToken . '.jpg';
try {
    file_put_contents($mainImage, 'fake test image');
    file_put_contents($thumbnail, 'fake test thumbnail');
    $pdo->prepare('UPDATE san_pham SET hinh_anh = ? WHERE id = 203')->execute([$relativeImage]);
    $result = $invoke(
        [$productController, 'delete'],
        'DELETE',
        '/api/admin/products/203',
        [],
        ['id' => '203']
    );
    $statuses['product_without_history'] = $result['status'];
    $assert(
        $result['status'] === 200
            && ($result['body']['data']['deleted'] ?? false)
            && (int) $pdo->query('SELECT COUNT(*) FROM san_pham WHERE id = 203')->fetchColumn() === 0
            && !is_file($mainImage)
            && !is_file($thumbnail),
        'A product without history should be deleted with its image variants'
    );
} finally {
    foreach ([$mainImage, $thumbnail] as $path) {
        if (is_file($path)) {
            unlink($path);
        }
    }
    if ($createdUploadsDirectory && is_dir($uploadsDirectory)) {
        rmdir($uploadsDirectory);
    }
}

$statusText = [];
foreach ($statuses as $name => $status) {
    $statusText[] = $name . '=' . $status;
}
$statusText[] = 'product_image_deleted=yes';
echo 'Admin delete tests passed: ' . implode(', ', $statusText) . PHP_EOL;
