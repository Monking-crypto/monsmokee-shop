<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Ho_Chi_Minh');
$testLogPath = sys_get_temp_dir() . '/monsmokee-admin-recovery-' . bin2hex(random_bytes(8)) . '.log';
define('ADMIN_RECOVERY_LOG_FILE', $testLogPath);
require dirname(__DIR__) . '/scripts/admin_recovery.php';

final class AdminRecoveryTestPdo extends PDO
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
        return preg_replace('/\s+FOR UPDATE\b/i', '', $query) ?? $query;
    }
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$pdo = new AdminRecoveryTestPdo();
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
     CREATE TABLE otp_xac_thuc (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       muc_dich TEXT NOT NULL,
       email TEXT NOT NULL,
       ma_otp_hash TEXT NOT NULL,
       het_han_luc TEXT NOT NULL,
       da_su_dung INTEGER NOT NULL DEFAULT 0
     );
     CREATE TABLE dat_lai_mat_khau_ticket (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       email TEXT NOT NULL,
       ticket_hash TEXT NOT NULL,
       het_han_luc TEXT NOT NULL,
       da_dung INTEGER NOT NULL DEFAULT 0
     );'
);
$pdo->exec("INSERT INTO vai_tro (id, ten_vai_tro) VALUES (1, 'Admin'), (2, 'Customer')");

$adminPhone = '09' . (string) random_int(10000000, 99999999);
$adminEmail = 'admin-recovery-' . bin2hex(random_bytes(6)) . '@example.invalid';
$newPhone = '09' . (string) random_int(10000000, 99999999);
$newEmail = 'admin-recovery-new-' . bin2hex(random_bytes(6)) . '@example.invalid';
$duplicateEmail = 'admin-recovery-other-' . bin2hex(random_bytes(6)) . '@example.invalid';
$duplicatePhone = '09' . (string) random_int(10000000, 99999999);
$oldPassword = bin2hex(random_bytes(12)) . 'a1';
$newPassword = bin2hex(random_bytes(12)) . 'b2';
$adminInsert = $pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (1, ?, ?, ?, ?, 0)'
);
$adminInsert->execute(['Recovery Test Admin', $adminPhone, $adminEmail, password_hash($oldPassword, PASSWORD_BCRYPT)]);
$adminId = (int) $pdo->lastInsertId();
$pdo->prepare(
    'INSERT INTO nguoi_dung
     (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau, trang_thai)
     VALUES (2, ?, ?, ?, ?, 1)'
)->execute(['Other Test User', $duplicatePhone, $duplicateEmail, password_hash(bin2hex(random_bytes(10)), PASSWORD_BCRYPT)]);

$expiresSoon = date('Y-m-d H:i:s', time() + 300);
$expiresPast = date('Y-m-d H:i:s', time() - 300);
$insertOtp = $pdo->prepare(
    'INSERT INTO otp_xac_thuc
     (muc_dich, email, ma_otp_hash, het_han_luc, da_su_dung)
     VALUES (?, ?, ?, ?, 0)'
);
$insertOtp->execute(['DANG_NHAP_ADMIN', $adminEmail, password_hash(bin2hex(random_bytes(4)), PASSWORD_BCRYPT), $expiresSoon]);
$insertOtp->execute(['QUEN_MAT_KHAU', $adminEmail, password_hash(bin2hex(random_bytes(4)), PASSWORD_BCRYPT), $expiresSoon]);
$insertOtp->execute(['DANG_NHAP_ADMIN', $adminEmail, password_hash(bin2hex(random_bytes(4)), PASSWORD_BCRYPT), $expiresPast]);
$pdo->prepare(
    'INSERT INTO dat_lai_mat_khau_ticket
     (user_id, email, ticket_hash, het_han_luc, da_dung)
     VALUES (?, ?, ?, ?, 0)'
)->execute([$adminId, $adminEmail, hash('sha256', random_bytes(32)), $expiresSoon]);

$pdo->prepare(
    'INSERT INTO rate_limit (khoa, so_lan, bat_dau) VALUES (?, 4, NOW()), (?, 3, NOW())'
)->execute([
    'common_login_admin:' . $adminId . ':ip-one',
    'common_login_admin:' . ($adminId + 100) . ':unrelated',
]);

try {
    $validPassword = preg_match(PASSWORD_PATTERN, $newPassword) === 1;
    $assert($validPassword, 'Generated password fixture must pass password rules');
    updateAdmin($pdo, $adminId, 'mat_khau', password_hash($newPassword, PASSWORD_BCRYPT), 'reset_password');
    $passwordQuery = $pdo->prepare('SELECT mat_khau FROM nguoi_dung WHERE id = ?');
    $passwordQuery->execute([$adminId]);
    $newHash = (string) $passwordQuery->fetchColumn();
    $assert(password_verify($newPassword, $newHash), 'Recovery must store a valid password hash');
    $assert(!password_verify($oldPassword, $newHash), 'Previous password must no longer verify');

    $resetState = $pdo->prepare(
        'SELECT
           (SELECT COUNT(*) FROM dat_lai_mat_khau_ticket WHERE user_id = ? AND da_dung = 0) AS active_tickets,
           (SELECT COUNT(*) FROM otp_xac_thuc WHERE email = ? AND da_su_dung = 0) AS active_otps'
    );
    $resetState->execute([$adminId, $adminEmail]);
    $invalidated = $resetState->fetch(PDO::FETCH_ASSOC);
    $assert((int) $invalidated['active_tickets'] === 0, 'Password reset must invalidate reset tickets');
    $assert((int) $invalidated['active_otps'] === 0, 'Password reset must invalidate active OTPs');

    updateAdmin($pdo, $adminId, 'email', $newEmail, 'change_email');
    $admin = findAdmin($pdo, $adminId);
    $assert($admin['email'] === $newEmail, 'Recovery must update Admin email');

    $duplicateRejected = false;
    try {
        updateAdmin($pdo, $adminId, 'email', $duplicateEmail, 'change_email');
    } catch (RuntimeException) {
        $duplicateRejected = true;
    }
    $assert($duplicateRejected, 'Recovery must reject an email already in use');
    $assert(findAdmin($pdo, $adminId)['email'] === $newEmail, 'Failed email update must roll back');

    updateAdmin($pdo, $adminId, 'so_dien_thoai', $newPhone, 'change_phone');
    $assert(findAdmin($pdo, $adminId)['so_dien_thoai'] === $newPhone, 'Recovery must update Admin phone');

    $pdo->prepare('UPDATE nguoi_dung SET trang_thai = 0 WHERE id = ?')->execute([$adminId]);
    $insertOtp->execute(['DANG_NHAP_ADMIN', $newEmail, password_hash(bin2hex(random_bytes(4)), PASSWORD_BCRYPT), $expiresSoon]);
    $pdo->prepare(
        'INSERT INTO rate_limit (khoa, so_lan, bat_dau) VALUES (?, 5, NOW())'
    )->execute(['common_login_admin:' . $adminId . ':ip-two']);
    unlockAdmin($pdo, $adminId);

    $admin = findAdmin($pdo, $adminId);
    $assert((int) $admin['trang_thai'] === 1, 'Unlock must activate Admin account');
    $adminRate = $pdo->prepare('SELECT COUNT(*) FROM rate_limit WHERE khoa LIKE ?');
    $adminRate->execute(['common_login_admin:' . $adminId . ':%']);
    $assert((int) $adminRate->fetchColumn() === 0, 'Unlock must clear only this Admin login limits');
    $unrelatedRate = $pdo->prepare('SELECT COUNT(*) FROM rate_limit WHERE khoa LIKE ?');
    $unrelatedRate->execute(['common_login_admin:' . ($adminId + 100) . ':%']);
    $assert((int) $unrelatedRate->fetchColumn() === 1, 'Unlock must preserve other Admin login limits');

    $otpState = $pdo->prepare(
        'SELECT SUM(CASE WHEN da_su_dung = 0 AND het_han_luc > NOW() THEN 1 ELSE 0 END)
         FROM otp_xac_thuc WHERE email = ?'
    );
    $otpState->execute([$newEmail]);
    $assert((int) $otpState->fetchColumn() === 0, 'Unlock must invalidate unexpired OTPs');

    $log = file_get_contents($testLogPath);
    $assert(is_string($log) && str_contains($log, 'action=reset_password'), 'Recovery actions must be logged');
    $assert(
        !str_contains($log, $oldPassword)
        && !str_contains($log, $newPassword)
        && !str_contains($log, $newHash),
        'Recovery logs must not contain passwords or hashes'
    );

    fwrite(STDOUT, "Admin recovery service tests passed: password-reset/email-unique/unlock/rate-limit-scope/otp-invalidation/log-redaction\n");
} finally {
    if (is_file($testLogPath)) {
        unlink($testLogPath);
    }
}
