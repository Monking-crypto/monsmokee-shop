<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/Services/UnifiedLoginService.php';

use App\Services\UnifiedLoginService;

final class UnifiedLoginTestPdo extends PDO
{
    private PDO $sqlite;

    public function __construct()
    {
        $this->sqlite = new PDO('sqlite::memory:');
        $this->sqlite->sqliteCreateFunction('NOW', fn(): string => date('Y-m-d H:i:s'));
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

$pdo = new UnifiedLoginTestPdo();
$pdo->exec(
    'CREATE TABLE vai_tro (
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
    );'
);
$pdo->exec("INSERT INTO vai_tro (id, ten_vai_tro) VALUES (1, 'Customer'), (2, 'Admin')");

$customerPassword = password_hash('Test-Customer-123!', PASSWORD_BCRYPT);
$adminPassword = password_hash('Test-Admin-123!', PASSWORD_BCRYPT);
$lockedPassword = password_hash('Test-Locked-123!', PASSWORD_BCRYPT);
$pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$insert = $pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$insert->execute([1, 'Test Customer', '0900000001', 'customer@example.invalid', $customerPassword, 1]);
$insert->execute([2, 'Test Admin', '0900000002', 'admin@example.invalid', $adminPassword, 1]);
$insert->execute([1, 'Locked Customer', '0900000003', 'locked-customer@example.invalid', $lockedPassword, 0]);
$insert->execute([2, 'Locked Admin', '0900000004', 'locked-admin@example.invalid', $lockedPassword, 0]);

$business = [
    'login' => ['max_fail' => 5, 'lock_minutes' => 15],
];
$service = new UnifiedLoginService($pdo, $business);

$customer = $service->authenticate('0900000001', 'Test-Customer-123!', '198.51.100.10');
$assert($customer['type'] === 'customer_credentials_valid', 'Valid customer must use customer outcome');

$admin = $service->authenticate('0900000002', 'Test-Admin-123!', '198.51.100.11');
$assert($admin['type'] === 'admin_credentials_valid', 'Valid admin must use admin pending outcome');
$assert(!array_key_exists('vai_tro', $admin['user']) || $admin['user']['vai_tro'] === 'Admin', 'Admin outcome must not be a fully authenticated session');

$wrong = $service->authenticate('0900000001', 'wrong-password', '198.51.100.12');
$unknown = $service->authenticate('0999999999', 'wrong-password', '198.51.100.12');
$assert($wrong['type'] === 'invalid_credentials' && $unknown['type'] === 'invalid_credentials', 'Wrong password and unknown phone must share one outcome');

$lockedCustomer = $service->authenticate('0900000003', 'Test-Locked-123!', '198.51.100.13');
$lockedAdmin = $service->authenticate('0900000004', 'Test-Locked-123!', '198.51.100.14');
$assert($lockedCustomer['type'] === 'account_locked' && $lockedAdmin['type'] === 'account_locked', 'Locked customer and locked admin must share outcome');

$adminWrong = $service->authenticate('0900000002', 'wrong-password', '198.51.100.19');
$assert($adminWrong['type'] === 'invalid_credentials', 'Admin wrong password must be rejected');
$adminRateKeys = $pdo->prepare(
    "SELECT COUNT(*) FROM rate_limit WHERE khoa LIKE 'common_login_admin:2:%'"
);
$adminRateKeys->execute();
$assert((int) $adminRateKeys->fetchColumn() === 1, 'Admin login throttles must be scoped by Admin ID for recovery');

for ($attempt = 1; $attempt <= 5; $attempt++) {
    $limited = $service->authenticate('0999999998', 'wrong-password', '198.51.100.15');
}
$assert($limited['type'] === 'rate_limited', 'Fifth wrong attempt must return rate_limited');

echo "UnifiedLoginService tests passed\n";
