<?php
declare(strict_types=1);

if ($argc !== 4) {
    fwrite(STDERR, "Cách dùng: php database/seed_admin.php <số-điện-thoại> <email> <mật-khẩu-mạnh>\n");
    exit(1);
}

$phone = $argv[1];
$email = $argv[2];
$password = $argv[3];

if (!preg_match('/^0\d{9}$/', $phone)) {
    fwrite(STDERR, "Số điện thoại không hợp lệ.\n");
    exit(1);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Email không hợp lệ.\n");
    exit(1);
}
if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/', $password)) {
    fwrite(STDERR, "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.\n");
    exit(1);
}

$env = file_exists(__DIR__ . '/../backend/.env')
    ? parse_ini_file(__DIR__ . '/../backend/.env', false, INI_SCANNER_RAW)
    : [];
$host = $env['DB_HOST'] ?? '127.0.0.1';
$port = $env['DB_PORT'] ?? '3306';
$dbname = $env['DB_NAME'] ?? 'monsmokee';
$dbUser = $env['DB_USER'] ?? 'root';
$dbPass = $env['DB_PASS'] ?? '';

$dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
$pdo = new PDO($dsn, $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

$hash = password_hash($password, PASSWORD_BCRYPT);
$pdo->beginTransaction();
try {
    $roleId = (int) $pdo->query("SELECT id FROM vai_tro WHERE ten_vai_tro='Admin'")->fetchColumn();
    $stmt = $pdo->prepare(
        'INSERT INTO nguoi_dung (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE vai_tro_id=VALUES(vai_tro_id), ho_ten=VALUES(ho_ten), mat_khau=VALUES(mat_khau), trang_thai=1'
    );
    $stmt->execute([$roleId, 'Quản trị MON SMOKEE', $phone, $email, $hash]);
    $pdo->commit();
    echo "Đã tạo/cập nhật tài khoản Admin.\n";
    echo "Hãy giữ an toàn thông tin đăng nhập và không tái sử dụng mật khẩu này.\n";
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, "Không thể seed Admin: " . $e->getMessage() . "\n");
    exit(1);
}
