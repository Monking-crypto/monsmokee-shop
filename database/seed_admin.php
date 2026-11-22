<?php
declare(strict_types=1);

$envPath = __DIR__ . '/../backend/.env';
if (!is_file($envPath)) {
    fwrite(STDERR, "Không tìm thấy backend/.env. Hãy sao chép backend/.env.example và điền cấu hình.\n");
    exit(1);
}

$env = parse_ini_file($envPath, false, INI_SCANNER_RAW);
if ($env === false) {
    fwrite(STDERR, "Không thể đọc backend/.env. Hãy kiểm tra cú pháp file.\n");
    exit(1);
}

$requiredKeys = ['ADMIN_PHONE', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME'];
foreach ($requiredKeys as $key) {
    if (!isset($env[$key]) || trim((string) $env[$key]) === '') {
        fwrite(STDERR, "Thiếu cấu hình {$key} trong backend/.env.\n");
        exit(1);
    }
}

$phone = trim((string) $env['ADMIN_PHONE']);
$email = trim((string) $env['ADMIN_EMAIL']);
$password = (string) $env['ADMIN_PASSWORD'];
$name = trim((string) $env['ADMIN_NAME']);

if (!preg_match('/^0\d{9}$/', $phone)) {
    fwrite(STDERR, "ADMIN_PHONE phải có 10 chữ số và bắt đầu bằng 0.\n");
    exit(1);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "ADMIN_EMAIL không hợp lệ.\n");
    exit(1);
}
if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/', $password)) {
    fwrite(STDERR, "ADMIN_PASSWORD phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.\n");
    exit(1);
}
if (mb_strlen($name) > 100) {
    fwrite(STDERR, "ADMIN_NAME không được vượt quá 100 ký tự.\n");
    exit(1);
}

$host = $env['DB_HOST'] ?? '127.0.0.1';
$port = $env['DB_PORT'] ?? '3306';
$dbname = $env['DB_NAME'] ?? 'monsmokee';
$dbUser = $env['DB_USER'] ?? 'root';
$dbPass = $env['DB_PASS'] ?? '';

try {
    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $pdo->beginTransaction();

    $roleQuery = $pdo->prepare('SELECT id FROM vai_tro WHERE ten_vai_tro = ?');
    $roleQuery->execute(['Admin']);
    $roleId = $roleQuery->fetchColumn();
    if ($roleId === false) {
        throw new RuntimeException("Chưa có vai trò Admin. Hãy import database/seed.sql trước.");
    }
    $roleId = (int) $roleId;

    $existingQuery = $pdo->prepare(
        'SELECT id, vai_tro_id, so_dien_thoai, email
         FROM nguoi_dung
         WHERE so_dien_thoai = ? OR email = ?
         FOR UPDATE'
    );
    $existingQuery->execute([$phone, $email]);
    $existingUsers = $existingQuery->fetchAll(PDO::FETCH_ASSOC);

    if ($existingUsers === []) {
        $insert = $pdo->prepare(
            'INSERT INTO nguoi_dung (vai_tro_id, ho_ten, so_dien_thoai, email, mat_khau)
             VALUES (?, ?, ?, ?, ?)'
        );
        $insert->execute([$roleId, $name, $phone, $email, $hash]);
        $action = 'created';
    } elseif (
        count($existingUsers) === 1
        && (int) $existingUsers[0]['vai_tro_id'] === $roleId
        && $existingUsers[0]['so_dien_thoai'] === $phone
        && $existingUsers[0]['email'] === $email
    ) {
        $update = $pdo->prepare(
            'UPDATE nguoi_dung
             SET ho_ten = ?, mat_khau = ?, trang_thai = 1
             WHERE id = ?'
        );
        $update->execute([$name, $hash, (int) $existingUsers[0]['id']]);
        $action = 'updated';
    } else {
        throw new RuntimeException(
            'Số điện thoại hoặc email đã thuộc tài khoản khác; không thay đổi tài khoản nào.'
        );
    }

    $pdo->commit();
    echo $action === 'created'
        ? "Đã tạo tài khoản Admin.\n"
        : "Đã cập nhật tài khoản Admin hiện có.\n";

    $otherAdmins = $pdo->prepare(
        'SELECT u.id, u.so_dien_thoai, u.email
         FROM nguoi_dung u
         JOIN vai_tro v ON v.id = u.vai_tro_id
         WHERE v.ten_vai_tro = ? AND NOT (u.so_dien_thoai = ? AND u.email = ?)
         ORDER BY u.id'
    );
    $otherAdmins->execute(['Admin', $phone, $email]);
    $extraAdmins = $otherAdmins->fetchAll(PDO::FETCH_ASSOC);

    if ($extraAdmins !== []) {
        fwrite(STDERR, "CẢNH BÁO: phát hiện tài khoản Admin khác tài khoản trong backend/.env:\n");
        foreach ($extraAdmins as $admin) {
            fwrite(
                STDERR,
                "  id={$admin['id']} | SĐT={$admin['so_dien_thoai']} | email={$admin['email']}\n"
            );
        }
        fwrite(STDERR, "Seeder KHÔNG tự xóa tài khoản. Hãy kiểm tra và xóa thủ công nếu thật sự thừa.\n");
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Không thể seed Admin: " . $e->getMessage() . "\n");
    exit(1);
}
