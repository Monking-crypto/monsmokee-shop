<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Ho_Chi_Minh');

require dirname(__DIR__) . '/core/Request.php';
require dirname(__DIR__) . '/core/Response.php';
require dirname(__DIR__) . '/core/Session.php';
require dirname(__DIR__) . '/core/Validator.php';
require dirname(__DIR__) . '/core/Csrf.php';
require dirname(__DIR__) . '/app/Middleware/AuthMiddleware.php';
require dirname(__DIR__) . '/app/Middleware/RoleMiddleware.php';
require dirname(__DIR__) . '/app/Middleware/AdminMiddleware.php';
require dirname(__DIR__) . '/app/Middleware/CsrfMiddleware.php';
require dirname(__DIR__) . '/app/Services/ProfileService.php';
require dirname(__DIR__) . '/app/Services/PasswordChangeService.php';
require dirname(__DIR__) . '/app/Services/UnifiedLoginService.php';
require dirname(__DIR__) . '/app/Controllers/Customer/ProfileController.php';
require dirname(__DIR__) . '/app/Controllers/Admin/AdminProfileController.php';

use App\Controllers\Admin\AdminProfileController;
use App\Controllers\Customer\ProfileController;
use App\Middleware\AdminMiddleware;
use App\Middleware\RoleMiddleware;
use App\Services\PasswordChangeService;
use App\Services\ProfileService;
use App\Services\UnifiedLoginService;

final class ProfilePasswordTestPdo extends PDO
{
    private PDO $sqlite;

    public function __construct()
    {
        $this->sqlite = new PDO('sqlite::memory:');
        $this->sqlite->sqliteCreateFunction('NOW', static fn(): string => date('Y-m-d H:i:s'));
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
        return preg_replace('/\s+FOR UPDATE\b/i', '', $query) ?? $query;
    }
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$capture = static function (callable $callback): array {
    ob_start();
    $callback();
    $body = (string) ob_get_clean();
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Expected JSON response from tested handler');
    }
    return [http_response_code(), $decoded];
};

$requestWith = static function (array $body = [], string $method = 'PATCH', ?string $csrf = null): Request {
    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI'] = '/api/profile';
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    if ($csrf === null) {
        unset($_SERVER['HTTP_X_CSRF_TOKEN']);
    } else {
        $_SERVER['HTTP_X_CSRF_TOKEN'] = $csrf;
    }
    $_POST = $body;
    return new Request();
};

$pdo = new ProfilePasswordTestPdo();
$pdo->exec(
    'CREATE TABLE vai_tro (id INTEGER PRIMARY KEY, ten_vai_tro TEXT NOT NULL);
     CREATE TABLE nguoi_dung (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       vai_tro_id INTEGER NOT NULL,
       ho_ten TEXT NOT NULL,
       so_dien_thoai TEXT NOT NULL UNIQUE,
       email TEXT NOT NULL UNIQUE,
       mat_khau TEXT NOT NULL,
       trang_thai INTEGER NOT NULL DEFAULT 1
     );
     CREATE TABLE rate_limit (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       khoa TEXT NOT NULL UNIQUE,
       so_lan INTEGER NOT NULL DEFAULT 0,
       bat_dau TEXT NOT NULL,
       khoa_den TEXT NULL
     );
     CREATE TABLE dat_lai_mat_khau_ticket (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       email TEXT NOT NULL,
       ticket_hash TEXT NOT NULL,
       het_han_luc TEXT NOT NULL,
       da_dung INTEGER NOT NULL DEFAULT 0
     );
     CREATE TABLE otp_xac_thuc (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       muc_dich TEXT NOT NULL,
       email TEXT NOT NULL,
       ma_otp_hash TEXT NOT NULL,
       het_han_luc TEXT NOT NULL,
       da_su_dung INTEGER NOT NULL DEFAULT 0
     );'
);
$pdo->exec("INSERT INTO vai_tro (id, ten_vai_tro) VALUES (1, 'Customer'), (2, 'Admin')");
$oldHash = password_hash('Oldpass123', PASSWORD_BCRYPT);
$insert = $pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (?, ?, ?, ?, ?, 1)'
);
$insert->execute([1, 'Customer Sample', '0900000001', 'customer@example.invalid', $oldHash]);
$customerId = (int) $pdo->lastInsertId();
$insert->execute([2, 'Admin Sample', '0900000002', 'admin@example.invalid', $oldHash]);
$adminId = (int) $pdo->lastInsertId();
$business = ['password_change' => ['max_fail' => 5, 'lock_minutes' => 15]];
$profileService = new ProfileService($pdo);
$passwordService = new PasswordChangeService($pdo, $business);
$customerController = new ProfileController($profileService, $passwordService);
$adminController = new AdminProfileController($profileService, $passwordService);

session_id('profile-password-test-' . getmypid());
session_start();
$_SESSION = ['user_id' => $customerId, 'user_role' => 'Customer'];

[$nameStatus, $nameResponse] = $capture(static function () use ($customerController, $requestWith): void {
    $customerController->update($requestWith([
        'ho_ten' => '  <b>Customer New</b>  ',
        'vai_tro' => 'Admin',
        'so_dien_thoai' => '0999999999',
    ], 'PUT'));
});
$assert($nameStatus === 200, 'Customer name update should return 200');
$assert($nameResponse['data']['user']['ho_ten'] === 'Customer New', 'Name must be trimmed and stripped of HTML');
$storedCustomer = $pdo->prepare('SELECT ho_ten, vai_tro_id, so_dien_thoai FROM nguoi_dung WHERE id = ?');
$storedCustomer->execute([$customerId]);
$customerRow = $storedCustomer->fetch(PDO::FETCH_ASSOC);
$assert($customerRow['vai_tro_id'] === 1 && $customerRow['so_dien_thoai'] === '0900000001', 'Extra role/phone fields must not change account data');

foreach (['', str_repeat('x', 101)] as $invalidName) {
    [$status, $response] = $capture(static function () use ($customerController, $requestWith, $invalidName): void {
        $customerController->update($requestWith(['ho_ten' => $invalidName], 'PUT'));
    });
    $assert($status === 422, 'Empty or overlong name must return 422');
    $assert(isset($response['errors']['ho_ten']), 'Invalid name must return a field-specific error');
}

$pdo->prepare(
    'INSERT INTO dat_lai_mat_khau_ticket
     (user_id, email, ticket_hash, het_han_luc, da_dung) VALUES (?, ?, ?, ?, 0)'
)->execute([$customerId, 'customer@example.invalid', str_repeat('a', 64), date('Y-m-d H:i:s', time() + 300)]);
$pdo->prepare(
    'INSERT INTO otp_xac_thuc
     (muc_dich, email, ma_otp_hash, het_han_luc, da_su_dung) VALUES (?, ?, ?, ?, 0)'
)->execute(['QUEN_MAT_KHAU', 'customer@example.invalid', password_hash('000000', PASSWORD_BCRYPT), date('Y-m-d H:i:s', time() + 300)]);
$sessionIdBeforePasswordChange = session_id();
[$customerPasswordStatus, $customerPasswordResponse] = $capture(static function () use ($customerController, $requestWith): void {
    $customerController->changePassword($requestWith([
        'mat_khau_hien_tai' => 'Oldpass123',
        'mat_khau_moi' => 'Newpass456',
        'xac_nhan_mat_khau_moi' => 'Newpass456',
    ]));
});
$assert($customerPasswordStatus === 200, 'Customer password change should return 200');
$assert(!str_contains(json_encode($customerPasswordResponse), 'mat_khau'), 'Password response must not expose password fields');
$assert(session_id() !== $sessionIdBeforePasswordChange, 'Password change should regenerate the session ID');
$hashQuery = $pdo->prepare('SELECT mat_khau FROM nguoi_dung WHERE id = ?');
$hashQuery->execute([$customerId]);
$newHash = (string) $hashQuery->fetchColumn();
$assert(password_verify('Newpass456', $newHash), 'New password must be stored as a password hash');
$ticketStatus = $pdo->prepare('SELECT da_dung FROM dat_lai_mat_khau_ticket WHERE user_id = ?');
$ticketStatus->execute([$customerId]);
$assert((int) $ticketStatus->fetchColumn() === 1, 'Active reset ticket must be invalidated');
$otpStatus = $pdo->prepare('SELECT da_su_dung FROM otp_xac_thuc LIMIT 1');
$otpStatus->execute();
$assert((int) $otpStatus->fetchColumn() === 1, 'Active password-reset OTP must be invalidated');

$login = new UnifiedLoginService($pdo, ['login' => ['max_fail' => 5, 'lock_minutes' => 15]]);
$assert(
    $login->authenticate('0900000001', 'Newpass456', '198.51.100.10')['type'] === 'customer_credentials_valid',
    'Customer must be able to log in with the new password'
);
$assert(
    $login->authenticate('0900000001', 'Oldpass123', '198.51.100.11')['type'] === 'invalid_credentials',
    'Old password must no longer authenticate'
);

foreach ([
    ['mat_khau_hien_tai' => 'incorrect', 'mat_khau_moi' => 'Nextpass789', 'xac_nhan_mat_khau_moi' => 'Nextpass789'],
    ['mat_khau_hien_tai' => 'Newpass456', 'mat_khau_moi' => 'weak', 'xac_nhan_mat_khau_moi' => 'weak'],
    ['mat_khau_hien_tai' => 'Newpass456', 'mat_khau_moi' => 'Newpass456', 'xac_nhan_mat_khau_moi' => 'Newpass456'],
    ['mat_khau_hien_tai' => 'Newpass456', 'mat_khau_moi' => 'Nextpass789', 'xac_nhan_mat_khau_moi' => 'Different123'],
] as $invalidPassword) {
    [$status, $response] = $capture(static function () use ($customerController, $requestWith, $invalidPassword): void {
        $customerController->changePassword($requestWith($invalidPassword));
    });
    $assert($status === 422, 'Invalid password change must return 422');
    if ($invalidPassword['mat_khau_hien_tai'] === 'incorrect') {
        $assert(isset($response['errors']['mat_khau_hien_tai']), 'Incorrect current password must be field-specific');
    } elseif ($invalidPassword['mat_khau_moi'] === 'weak' || $invalidPassword['mat_khau_moi'] === 'Newpass456') {
        $assert(isset($response['errors']['mat_khau_moi']), 'Weak or repeated password must be field-specific');
    } else {
        $assert(isset($response['errors']['xac_nhan_mat_khau_moi']), 'Password confirmation must be field-specific');
    }
}

$missingPasswordInput = [];
[$missingPasswordStatus, $missingPasswordResponse] = $capture(static function () use ($customerController, $requestWith, $missingPasswordInput): void {
    $customerController->changePassword($requestWith($missingPasswordInput));
});
$assert($missingPasswordStatus === 422, 'Missing password fields must return 422');
foreach (['mat_khau_hien_tai', 'mat_khau_moi', 'xac_nhan_mat_khau_moi'] as $field) {
    $assert(isset($missingPasswordResponse['errors'][$field]), 'Missing password field must have a field-specific error');
}

$_SESSION = ['user_id' => $adminId, 'user_role' => 'Admin', 'admin_otp_verified' => true];
[$adminNameStatus] = $capture(static function () use ($adminController, $requestWith): void {
    $adminController->update($requestWith([
        'ho_ten' => 'Admin Updated',
        'email' => 'attempted-change@example.invalid',
        'vai_tro' => 'Customer',
        'so_dien_thoai' => '0999999998',
    ], 'PUT'));
});
$assert($adminNameStatus === 200, 'Admin name update should return 200');
$adminQuery = $pdo->prepare('SELECT ho_ten, vai_tro_id, so_dien_thoai, email FROM nguoi_dung WHERE id = ?');
$adminQuery->execute([$adminId]);
$adminRow = $adminQuery->fetch(PDO::FETCH_ASSOC);
$assert($adminRow['ho_ten'] === 'Admin Updated' && $adminRow['vai_tro_id'] === 2, 'Admin profile update must only change name');
$assert($adminRow['so_dien_thoai'] === '0900000002', 'Admin phone must remain unchanged');
$assert($adminRow['email'] === 'admin@example.invalid', 'Admin email must remain unchanged');

[$adminPasswordStatus] = $capture(static function () use ($adminController, $requestWith): void {
    $adminController->changePassword($requestWith([
        'mat_khau_hien_tai' => 'Oldpass123',
        'mat_khau_moi' => 'Adminpass456',
        'xac_nhan_mat_khau_moi' => 'Adminpass456',
    ]));
});
$assert($adminPasswordStatus === 200, 'Admin password change should return 200');
$adminHashQuery = $pdo->prepare('SELECT mat_khau FROM nguoi_dung WHERE id = ?');
$adminHashQuery->execute([$adminId]);
$assert(password_verify('Adminpass456', (string) $adminHashQuery->fetchColumn()), 'Admin password should be updated');
$assert(
    $login->authenticate('0900000002', 'Adminpass456', '198.51.100.12')['type'] === 'admin_credentials_valid',
    'Admin must be able to authenticate with the new password'
);
$assert(
    $login->authenticate('0900000002', 'Oldpass123', '198.51.100.13')['type'] === 'invalid_credentials',
    'Admin old password must no longer authenticate'
);

$pdo->prepare('DELETE FROM rate_limit')->execute();
for ($attempt = 1; $attempt <= 5; $attempt++) {
    [$status] = $capture(static function () use ($adminController, $requestWith): void {
        $adminController->changePassword($requestWith([
            'mat_khau_hien_tai' => 'wrong-current',
            'mat_khau_moi' => 'Otherpass789',
            'xac_nhan_mat_khau_moi' => 'Otherpass789',
        ]));
    });
    $assert($status === 422, 'First five wrong-current attempts must return 422');
}
[$rateLimitStatus] = $capture(static function () use ($adminController, $requestWith): void {
    $adminController->changePassword($requestWith([
        'mat_khau_hien_tai' => 'wrong-current',
        'mat_khau_moi' => 'Otherpass789',
        'xac_nhan_mat_khau_moi' => 'Otherpass789',
    ]));
});
$assert($rateLimitStatus === 429, 'Sixth wrong-current attempt in window must return 429');

$_SESSION = [];
$request = $requestWith([], 'GET');
[$unauthenticatedCustomerStatus] = $capture(static fn() => RoleMiddleware::handle($request, 'Customer'));
$assert($unauthenticatedCustomerStatus === 401, 'Unauthenticated Customer profile route must return 401');

$_SESSION = ['admin_pending_user_id' => $adminId, 'admin_pending_expires_at' => time() + 300];
$request = $requestWith([], 'GET');
[$pendingAdminStatus] = $capture(static fn() => AdminMiddleware::handle($request));
$assert($pendingAdminStatus === 401, 'Admin pending OTP must not authenticate protected routes');
[$pendingCustomerStatus] = $capture(static fn() => RoleMiddleware::handle($request, 'Customer'));
$assert($pendingCustomerStatus === 401, 'Admin pending OTP must not authenticate Customer profile routes');

$_SESSION = ['user_id' => $customerId, 'user_role' => 'Customer'];
$request = $requestWith([], 'GET');
[$customerToAdminStatus] = $capture(static fn() => AdminMiddleware::handle($request));
$assert($customerToAdminStatus === 403, 'Customer calling Admin profile must return 403');

$request = $requestWith([], 'PATCH', null);
[$missingCsrfStatus] = $capture(static fn() => \CsrfMiddleware::handle($request));
$assert($missingCsrfStatus === 403, 'Missing CSRF must return 403');

$customerRoutes = file_get_contents(dirname(__DIR__) . '/routes/customer.php');
$adminRoutes = file_get_contents(dirname(__DIR__) . '/routes/admin.php');
$assert(
    is_string($customerRoutes)
    && str_contains($customerRoutes, "'/api/profile'")
    && str_contains($customerRoutes, "'/api/profile/password'")
    && str_contains($customerRoutes, "RoleMiddleware::handle(\$request, 'Customer')")
    && str_contains($customerRoutes, 'CsrfMiddleware::handle($request)'),
    'Customer profile routes must require Customer role and CSRF'
);
$assert(
    is_string($adminRoutes)
    && str_contains($adminRoutes, "'/api/admin/me'")
    && str_contains($adminRoutes, "'/api/admin/me/password'")
    && str_contains($adminRoutes, '$requireVerifiedAdmin, $requireAdminCsrf'),
    'Admin profile routes must require verified Admin and CSRF'
);

$_SESSION = [];
session_destroy();

echo 'Profile/password tests passed: customer/admin-name=200, empty/long-name=422/422, '
    . 'profile-extras-preserved=200, customer-password=200, login-new/old=customer_credentials_valid/invalid_credentials, '
    . 'wrong-current/weak/same/mismatch=422/422/422/422, admin-password=200, admin-login-new/old=admin_credentials_valid/invalid_credentials, '
    . 'rate-limit-fifth/sixth=422/429, missing-csrf=403, unauthenticated/pending=401/401, customer-to-admin=403' . PHP_EOL;
