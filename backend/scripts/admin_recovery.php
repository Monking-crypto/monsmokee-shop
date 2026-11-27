<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    if (PHP_SAPI !== 'cli') {
        http_response_code(404);
    }
    exit(1);
}

date_default_timezone_set('Asia/Ho_Chi_Minh');

require_once dirname(__DIR__) . '/core/Env.php';
require_once dirname(__DIR__) . '/core/Database.php';

const PASSWORD_PATTERN = '/^(?=.*[a-z])(?=.*\d).{8,}$/';

function recoveryActor(): string
{
    $actor = (string) (getenv('USERNAME') ?: getenv('USER') ?: 'cli-user');
    $actor = preg_replace('/[^A-Za-z0-9_.-]/', '_', $actor) ?: 'cli-user';
    return substr($actor, 0, 64);
}

function recoveryLog(?int $adminId, string $action): void
{
    $logPath = defined('ADMIN_RECOVERY_LOG_FILE')
        ? (string) constant('ADMIN_RECOVERY_LOG_FILE')
        : dirname(__DIR__) . '/storage/logs/admin_recovery.log';
    $directory = dirname($logPath);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Không thể tạo thư mục log.');
    }

    $target = $adminId === null ? '' : ' target_admin_id=' . $adminId;
    $line = sprintf(
        "[%s] actor=%s%s action=%s\n",
        date('Y-m-d H:i:s'),
        recoveryActor(),
        $target,
        preg_replace('/[^a-z_]/', '', $action) ?: 'unknown'
    );
    if (file_put_contents($logPath, $line, FILE_APPEND | LOCK_EX) === false) {
        throw new RuntimeException('Không thể ghi log khôi phục.');
    }
}

function readLineValue(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    $value = fgets(STDIN);
    if ($value === false) {
        throw new RuntimeException('Không đọc được dữ liệu đầu vào.');
    }
    return trim($value);
}

function readSecret(string $prompt): string
{
    if (PHP_OS_FAMILY === 'Windows') {
        $script = '$secure = Read-Host -AsSecureString -Prompt "'
            . str_replace('"', '`"', $prompt)
            . '"; $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); '
            . 'try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) } '
            . 'finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }';
        $encoded = base64_encode(mb_convert_encoding($script, 'UTF-16LE', 'UTF-8'));
        $process = proc_open(
            'powershell.exe -NoLogo -NoProfile -EncodedCommand ' . $encoded,
            [0 => STDIN, 1 => ['pipe', 'w'], 2 => STDERR],
            $pipes
        );
        if (!is_resource($process)) {
            throw new RuntimeException('Không thể mở prompt mật khẩu an toàn.');
        }
        $value = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $exitCode = proc_close($process);
        fwrite(STDOUT, PHP_EOL);
        if ($exitCode !== 0 || $value === false) {
            throw new RuntimeException('Không đọc được mật khẩu an toàn.');
        }
        return rtrim($value, "\r\n");
    }

    fwrite(STDOUT, $prompt);
    exec('stty -echo < /dev/tty', $output, $status);
    if ($status !== 0) {
        throw new RuntimeException('Cần terminal tương tác để nhập mật khẩu an toàn.');
    }
    try {
        $value = fgets(STDIN);
    } finally {
        exec('stty echo < /dev/tty');
        fwrite(STDOUT, PHP_EOL);
    }
    if ($value === false) {
        throw new RuntimeException('Không đọc được mật khẩu an toàn.');
    }
    return rtrim($value, "\r\n");
}

function listAdmins(PDO $pdo): void
{
    $query = $pdo->prepare(
        "SELECT u.id, u.ho_ten, u.email, u.so_dien_thoai, u.trang_thai
         FROM nguoi_dung u
         JOIN vai_tro v ON v.id = u.vai_tro_id
         WHERE v.ten_vai_tro = ?
         ORDER BY u.id"
    );
    $query->execute(['Admin']);
    $admins = $query->fetchAll(PDO::FETCH_ASSOC);
    if ($admins === []) {
        fwrite(STDOUT, "Không có tài khoản Admin.\n");
        return;
    }
    foreach ($admins as $admin) {
        fwrite(STDOUT, sprintf(
            "ID: %d | Họ tên: %s | Email: %s | SĐT: %s | Trạng thái: %s\n",
            (int) $admin['id'],
            (string) $admin['ho_ten'],
            (string) $admin['email'],
            (string) $admin['so_dien_thoai'],
            (int) $admin['trang_thai'] === 1 ? 'hoạt động' : 'đang khóa'
        ));
    }
    recoveryLog(null, 'list_admins');
}

function findAdmin(PDO $pdo, int $adminId, bool $forUpdate = false): array
{
    $query = $pdo->prepare(
        "SELECT u.id, u.ho_ten, u.email, u.so_dien_thoai, u.trang_thai
         FROM nguoi_dung u
         JOIN vai_tro v ON v.id = u.vai_tro_id
         WHERE u.id = ? AND v.ten_vai_tro = ?
         LIMIT 1" . ($forUpdate ? ' FOR UPDATE' : '')
    );
    $query->execute([$adminId, 'Admin']);
    $admin = $query->fetch(PDO::FETCH_ASSOC);
    if ($admin === false) {
        throw new RuntimeException('Không tìm thấy tài khoản Admin.');
    }
    return $admin;
}

function assertUnique(PDO $pdo, string $field, string $value, int $adminId): void
{
    if (!in_array($field, ['email', 'so_dien_thoai'], true)) {
        throw new RuntimeException('Trường cập nhật không hợp lệ.');
    }
    $query = $pdo->prepare(
        'SELECT id FROM nguoi_dung WHERE ' . $field . ' = ? AND id <> ? LIMIT 1'
    );
    $query->execute([$value, $adminId]);
    if ($query->fetchColumn() !== false) {
        throw new RuntimeException('Giá trị đã được tài khoản khác sử dụng.');
    }
}

function updateAdmin(PDO $pdo, int $adminId, string $field, string $value, string $action): void
{
    if (!in_array($field, ['email', 'so_dien_thoai', 'mat_khau'], true)) {
        throw new RuntimeException('Trường cập nhật không hợp lệ.');
    }

    $pdo->beginTransaction();
    try {
        $admin = findAdmin($pdo, $adminId, true);
        if ($field !== 'mat_khau') {
            assertUnique($pdo, $field, $value, $adminId);
        }
        $update = $pdo->prepare('UPDATE nguoi_dung SET ' . $field . ' = ? WHERE id = ?');
        $update->execute([$value, $adminId]);

        if ($field === 'email') {
            $pdo->prepare(
                'UPDATE dat_lai_mat_khau_ticket SET da_dung = 1
                 WHERE user_id = ? AND da_dung = 0'
            )->execute([$adminId]);
            $pdo->prepare(
                'UPDATE otp_xac_thuc SET da_su_dung = 1
                 WHERE email = ? AND da_su_dung = 0'
            )->execute([(string) $admin['email']]);
        } elseif ($field === 'mat_khau') {
            $pdo->prepare(
                'UPDATE dat_lai_mat_khau_ticket SET da_dung = 1
                 WHERE user_id = ? AND da_dung = 0'
            )->execute([$adminId]);
            $pdo->prepare(
                'UPDATE otp_xac_thuc SET da_su_dung = 1
                 WHERE email = ? AND da_su_dung = 0'
            )->execute([(string) $admin['email']]);
        } elseif ($field === 'so_dien_thoai') {
            $pdo->prepare(
                'DELETE FROM rate_limit WHERE khoa LIKE ?'
            )->execute(['common_login_admin:' . $adminId . ':%']);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    recoveryLog($adminId, $action);
}

function unlockAdmin(PDO $pdo, int $adminId): void
{
    $pdo->beginTransaction();
    try {
        $admin = findAdmin($pdo, $adminId, true);
        $pdo->prepare(
            'UPDATE nguoi_dung SET trang_thai = 1 WHERE id = ?'
        )->execute([$adminId]);
        $pdo->prepare(
            'DELETE FROM rate_limit WHERE khoa LIKE ?'
        )->execute(['common_login_admin:' . $adminId . ':%']);
        $pdo->prepare(
            'UPDATE otp_xac_thuc
             SET da_su_dung = 1
             WHERE email = ? AND da_su_dung = 0 AND het_han_luc > NOW()'
        )->execute([(string) $admin['email']]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    recoveryLog($adminId, 'unlock_admin');
}

function runRecoveryMenu(PDO $pdo): void
{
    while (true) {
        fwrite(STDOUT, "\nKhôi phục tài khoản Admin\n");
        fwrite(STDOUT, "1. Đặt lại mật khẩu\n");
        fwrite(STDOUT, "2. Đổi email\n");
        fwrite(STDOUT, "3. Đổi số điện thoại\n");
        fwrite(STDOUT, "4. Mở khóa tài khoản\n");
        fwrite(STDOUT, "5. Liệt kê Admin\n");
        fwrite(STDOUT, "0. Thoát\n");
        $choice = readLineValue('Chọn thao tác: ');
        if ($choice === '0') {
            return;
        }
        if ($choice === '5') {
            listAdmins($pdo);
            continue;
        }
        if (!in_array($choice, ['1', '2', '3', '4'], true)) {
            fwrite(STDERR, "Lựa chọn không hợp lệ.\n");
            continue;
        }

        $adminIdRaw = readLineValue('ID Admin: ');
        if (!ctype_digit($adminIdRaw) || (int) $adminIdRaw < 1) {
            fwrite(STDERR, "ID Admin không hợp lệ.\n");
            continue;
        }
        $adminId = (int) $adminIdRaw;
        findAdmin($pdo, $adminId);

        if ($choice === '1') {
            $password = readSecret('Mật khẩu mới: ');
            $confirmation = readSecret('Nhập lại mật khẩu mới: ');
            if (!preg_match(PASSWORD_PATTERN, $password)) {
                $password = '';
                $confirmation = '';
                fwrite(STDERR, "Mật khẩu cần ít nhất 8 ký tự, có chữ thường và chữ số.\n");
                continue;
            }
            if (!hash_equals($password, $confirmation)) {
                $password = '';
                $confirmation = '';
                fwrite(STDERR, "Hai mật khẩu không khớp.\n");
                continue;
            }
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $password = '';
            $confirmation = '';
            if (!is_string($hash)) {
                throw new RuntimeException('Không thể băm mật khẩu.');
            }
            updateAdmin($pdo, $adminId, 'mat_khau', $hash, 'reset_password');
            $hash = '';
            fwrite(STDOUT, "Đã đặt lại mật khẩu Admin.\n");
            continue;
        }

        if ($choice === '2') {
            $email = strtolower(readLineValue('Email mới: '));
            if (strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                fwrite(STDERR, "Email không hợp lệ.\n");
                continue;
            }
            updateAdmin($pdo, $adminId, 'email', $email, 'change_email');
            fwrite(STDOUT, "Đã cập nhật email Admin.\n");
            continue;
        }

        if ($choice === '3') {
            $phone = readLineValue('Số điện thoại mới: ');
            if (!preg_match('/^0\d{9}$/', $phone)) {
                fwrite(STDERR, "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.\n");
                continue;
            }
            updateAdmin($pdo, $adminId, 'so_dien_thoai', $phone, 'change_phone');
            fwrite(STDOUT, "Đã cập nhật số điện thoại Admin.\n");
            continue;
        }

        unlockAdmin($pdo, $adminId);
        fwrite(STDOUT, "Đã mở khóa tài khoản Admin và vô hiệu OTP còn hiệu lực.\n");
    }
}

if (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    try {
        $databaseConfig = require dirname(__DIR__) . '/config/database.php';
        $pdo = Database::connection($databaseConfig);
        runRecoveryMenu($pdo);
    } catch (Throwable $error) {
        fwrite(STDERR, "Không thể hoàn tất thao tác khôi phục. Kiểm tra cấu hình và log hệ thống.\n");
        exit(1);
    }
}
