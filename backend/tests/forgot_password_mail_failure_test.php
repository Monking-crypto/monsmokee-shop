<?php
declare(strict_types=1);

require dirname(__DIR__) . '/core/Request.php';
require dirname(__DIR__) . '/core/Response.php';
require dirname(__DIR__) . '/core/Logger.php';
require dirname(__DIR__) . '/core/Validator.php';
require dirname(__DIR__) . '/app/Services/Mail/OtpSenderInterface.php';
require dirname(__DIR__) . '/app/Services/OtpService.php';
require dirname(__DIR__) . '/app/Controllers/Customer/AuthController.php';

use App\Services\Mail\OtpSenderInterface;
use App\Services\OtpService;
use App\Controllers\Customer\AuthController;

final class MailFailureTestPdo extends PDO
{
    private PDO $sqlite;
    private string $clock;

    public function __construct()
    {
        $this->sqlite = new PDO('sqlite::memory:');
        $this->clock = date('Y-m-d H:i:s');
        $this->sqlite->sqliteCreateFunction('NOW', fn(): string => $this->clock);
        $this->sqlite->sqliteCreateFunction(
            'TIMESTAMPDIFF',
            static function (string $unit, ?string $start, ?string $end): int {
                if ($unit !== 'SECOND') {
                    throw new RuntimeException('Unexpected TIMESTAMPDIFF unit');
                }
                if ($start === null || $end === null) {
                    return 0;
                }
                return (int) strtotime($end) - (int) strtotime($start);
            },
            3
        );
        $this->sqlite->sqliteCreateFunction(
            'GREATEST',
            static fn(int|float ...$values): int|float => max($values),
            -1
        );
    }

    public function advanceClock(int $seconds): void
    {
        $this->clock = date('Y-m-d H:i:s', strtotime($this->clock) + $seconds);
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
            '/NOW\(\)\s*-\s*INTERVAL\s+1\s+HOUR/i',
            "datetime(NOW(), '-1 hour')",
            $query
        ) ?? $query;
        $query = preg_replace(
            '/TIMESTAMPDIFF\(\s*SECOND\s*,/i',
            "TIMESTAMPDIFF('SECOND',",
            $query
        ) ?? $query;
        return preg_replace('/\s+FOR UPDATE\b/i', '', $query) ?? $query;
    }
}

final class FailingOtpSender implements OtpSenderInterface
{
    public function send(string $email, string $otp, string $purpose): void
    {
        throw new RuntimeException('simulated mail transport failure');
    }
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$pdo = new MailFailureTestPdo();
$pdo->exec(
    'CREATE TABLE vai_tro (id INTEGER PRIMARY KEY, ten_vai_tro TEXT NOT NULL);
     CREATE TABLE nguoi_dung (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         vai_tro_id INTEGER NOT NULL,
         email TEXT NOT NULL,
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
         so_lan_nhap_sai INTEGER NOT NULL,
         da_su_dung INTEGER NOT NULL,
         ip TEXT NULL,
         ngay_tao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );'
);
$pdo->exec(
    'CREATE TRIGGER set_otp_creation_time
     AFTER INSERT ON otp_xac_thuc
     BEGIN
         UPDATE otp_xac_thuc SET ngay_tao = NOW() WHERE id = NEW.id;
     END;'
);
$pdo->exec("INSERT INTO vai_tro (id, ten_vai_tro) VALUES (1, 'Customer')");
$email = 'mail-failure-test@example.invalid';
$insertCustomer = $pdo->prepare(
    'INSERT INTO nguoi_dung (vai_tro_id, email, trang_thai) VALUES (1, ?, 1)'
);
$insertCustomer->execute([$email]);

$business = [
    'otp' => [
        'ttl_seconds' => 300,
        'resend_cooldown_seconds' => 60,
        'max_sends_per_hour' => 5,
        'length' => 6,
        'max_wrong_attempts' => 5,
    ],
];
$controller = new AuthController(
    $pdo,
    new Validator(),
    new OtpService($pdo, new FailingOtpSender(), $business),
    $business
);
$logPath = dirname(__DIR__) . '/storage/logs/app.log';
$logExisted = is_file($logPath);
$previousLog = $logExisted ? file_get_contents($logPath) : null;

$invoke = static function (string $method, string $email) use ($controller): array {
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['REQUEST_URI'] = '/api/auth/forgot-password/' . $method;
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    $_POST = ['email' => $email];
    http_response_code(200);
    ob_start();
    if ($method === 'start') {
        $controller->forgotPasswordStart(new Request());
    } else {
        $controller->forgotPasswordResend(new Request());
    }
    $body = (string) ob_get_clean();
    return [http_response_code(), json_decode($body, true)];
};

try {
    [$startStatus, $startResponse] = $invoke('start', $email);
    $assert($startStatus === 200, 'Mail failure from start must return HTTP 200');
    $assert(
        ($startResponse['message'] ?? null) === 'Nếu email tồn tại, mã xác thực đã được gửi'
            && ($startResponse['data'] ?? null) === null,
        'Start must return the generic response after mail failure'
    );
    $assert(
        !str_contains((string) json_encode($startResponse), 'OTP_SEND_FAILED')
            && !str_contains((string) json_encode($startResponse), 'simulated mail transport failure'),
        'Start response must not expose the mail failure'
    );

    $pdo->advanceClock(61);
    [$resendStatus, $resendResponse] = $invoke('resend', $email);
    $assert(
        $resendStatus === 200,
        'Mail failure from resend must return HTTP 200; got '
            . $resendStatus . ' with ' . json_encode($resendResponse)
    );
    $assert(
        ($resendResponse['message'] ?? null) === 'Nếu email tồn tại, mã xác thực đã được gửi'
            && ($resendResponse['data'] ?? null) === null,
        'Resend must return the generic response after mail failure'
    );
    $assert(
        !str_contains((string) json_encode($resendResponse), 'OTP_SEND_FAILED')
            && !str_contains((string) json_encode($resendResponse), 'simulated mail transport failure'),
        'Resend response must not expose the mail failure'
    );

    $log = is_file($logPath) ? (string) file_get_contents($logPath) : '';
    $newLog = substr($log, strlen((string) $previousLog));
    $assert(
        str_contains($newLog, 'Forgot-password OTP dispatch failed: OTP_SEND_FAILED')
            && str_contains($newLog, 'Forgot-password OTP resend failed: OTP_SEND_FAILED'),
        'Both mail failures must be recorded in the application log'
    );

    echo "Forgot-password mail failure tests passed\n";
} finally {
    if ($logExisted) {
        file_put_contents($logPath, (string) $previousLog, LOCK_EX);
    } elseif (is_file($logPath)) {
        unlink($logPath);
        $logDirectory = dirname($logPath);
        if (is_dir($logDirectory) && count(scandir($logDirectory) ?: []) <= 2) {
            rmdir($logDirectory);
        }
    }
}
