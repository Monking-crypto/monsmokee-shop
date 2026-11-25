<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/Services/Mail/OtpSenderInterface.php';
require dirname(__DIR__) . '/app/Services/Mail/LogOtpSender.php';
require dirname(__DIR__) . '/app/Services/Mail/MultiRecipientOtpSender.php';

use App\Services\Mail\LogOtpSender;
use App\Services\Mail\MultiRecipientOtpSender;
use App\Services\Mail\OtpSenderInterface;

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$sender = new class implements OtpSenderInterface {
    public array $sent = [];
    public function send(string $email, string $otp, string $purpose): void
    {
        $this->sent[] = [$email, $otp, $purpose];
    }
};
(new MultiRecipientOtpSender($sender, [' Extra@example.invalid ', 'primary@example.invalid']))
    ->send('Primary@example.invalid', '123456', 'DANG_NHAP_ADMIN');

$assert(
    $sender->sent === [
        ['primary@example.invalid', '123456', 'DANG_NHAP_ADMIN'],
        ['extra@example.invalid', '123456', 'DANG_NHAP_ADMIN'],
    ],
    'Primary and distinct additional recipients must receive the same OTP'
);

$partialFailureSender = new class implements OtpSenderInterface {
    public array $sent = [];
    public function send(string $email, string $otp, string $purpose): void
    {
        if ($email === 'primary@example.invalid') {
            throw new RuntimeException('delivery failed');
        }
        $this->sent[] = [$email, $otp, $purpose];
    }
};
(new MultiRecipientOtpSender($partialFailureSender, ['extra@example.invalid']))
    ->send('primary@example.invalid', '654321', 'DANG_NHAP_ADMIN');
$assert(
    $partialFailureSender->sent === [['extra@example.invalid', '654321', 'DANG_NHAP_ADMIN']],
    'A successful additional recipient must make fan-out succeed'
);

$outboxDirectory = dirname(__DIR__) . '/storage/mail_outbox';
$logPath = dirname(__DIR__) . '/storage/logs/otp.log';
$outboxBefore = array_fill_keys(glob($outboxDirectory . '/*.txt') ?: [], true);
$testOtp = '834729';
$testSender = new MultiRecipientOtpSender(new LogOtpSender(), ['extra@example.invalid']);
$newOutboxFiles = [];
try {
    $testSender->send('primary@example.invalid', $testOtp, 'DANG_NHAP_ADMIN');
    $newOutboxFiles = array_values(array_filter(
        glob($outboxDirectory . '/*.txt') ?: [],
        static fn(string $path): bool => !isset($outboxBefore[$path])
    ));
    $assert(count($newOutboxFiles) === 2, 'Log sender must create one outbox file per recipient');
    $messages = array_map(
        static fn(string $path): string => (string) file_get_contents($path),
        $newOutboxFiles
    );
    foreach ($messages as $message) {
        $assert(
            str_contains($message, 'OTP: ' . $testOtp . "\n"),
            'Each recipient outbox must contain the same OTP'
        );
    }
    $assert(
        count(array_filter(
            $messages,
            static fn(string $message): bool => str_contains($message, 'Đến: primary@example.invalid')
        )) === 1
            && count(array_filter(
                $messages,
                static fn(string $message): bool => str_contains($message, 'Đến: extra@example.invalid')
            )) === 1,
        'Each outbox file must be addressed to its corresponding recipient'
    );
} finally {
    if ($newOutboxFiles !== [] && is_file($logPath)) {
        $handle = fopen($logPath, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new RuntimeException('Could not clean test-only OTP log entries.');
        }
        $contents = stream_get_contents($handle);
        $names = array_map('basename', $newOutboxFiles);
        $lines = preg_split('/(?<=\n)/', $contents === false ? '' : $contents, -1, PREG_SPLIT_NO_EMPTY);
        $keptLines = array_filter($lines, static function (string $line) use ($names): bool {
            foreach ($names as $name) {
                if (str_contains($line, 'file=' . $name)) {
                    return false;
                }
            }
            return true;
        });
        rewind($handle);
        fwrite($handle, implode('', $keptLines));
        ftruncate($handle, ftell($handle));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);
    }
    foreach ($newOutboxFiles as $path) {
        if (is_file($path) && !unlink($path)) {
            throw new RuntimeException('Could not remove a test-only OTP outbox file.');
        }
    }
}

echo "Multi-recipient OTP sender tests passed\n";
