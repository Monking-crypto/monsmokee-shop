<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/Services/PromotionService.php';

use App\Services\PromotionService;

$pdo = new PDO('sqlite::memory:');
$pdo->exec('CREATE TABLE khuyen_mai (
    id INTEGER PRIMARY KEY,
    loai TEXT NOT NULL,
    phan_tram_giam INTEGER NOT NULL,
    so_san_pham INTEGER NOT NULL,
    trang_thai INTEGER NOT NULL,
    ngay_bat_dau TEXT NOT NULL,
    ngay_ket_thuc TEXT NOT NULL
)');
$pdo->exec('CREATE TABLE khuyen_mai_san_pham (
    khuyen_mai_id INTEGER NOT NULL,
    san_pham_id INTEGER NOT NULL
)');
$pdo->exec('CREATE TABLE lo_hang (
    san_pham_id INTEGER NOT NULL,
    so_luong_con INTEGER NOT NULL,
    han_su_dung TEXT NOT NULL
)');
$pdo->exec(
    "INSERT INTO khuyen_mai VALUES
        (1, 'THU_SAU', 10, 10, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59'),
        (2, 'THU_SAU', 70, 10, 1, '2026-01-01 00:00:00', '2026-12-31 23:59:59'),
        (3, 'THU_SAU', 90, 10, 0, '2026-01-01 00:00:00', '2026-12-31 23:59:59'),
        (4, 'THU_SAU', 90, 10, 1, '2025-01-01 00:00:00', '2025-12-31 23:59:59')"
);
$selection = $pdo->prepare('INSERT INTO khuyen_mai_san_pham VALUES (?, ?)');
for ($promotionId = 1; $promotionId <= 4; $promotionId++) {
    $targets = match ($promotionId) {
        1 => [1, 2],
        2 => [3],
        3 => [4],
        default => [5],
    };
    foreach ($targets as $productId) {
        $selection->execute([$promotionId, $productId]);
    }
    for ($slot = count($targets); $slot < 10; $slot++) {
        $selection->execute([$promotionId, $promotionId * 100 + $slot]);
    }
}
$pdo->exec(
    "INSERT INTO lo_hang VALUES
        (2, 4, '2026-03-10'),
        (3, 3, '2026-03-10'),
        (1, 0, '2026-03-10')"
);

$service = new PromotionService($pdo, [
    'promotion' => [
        'near_expiry_days' => 10,
        'near_expiry_percent' => 50,
        'friday_iso_weekday' => 5,
    ],
], new DateTimeZone('Asia/Ho_Chi_Minh'));
$friday = new DateTimeImmutable('2026-03-06 12:00:00', new DateTimeZone('Asia/Ho_Chi_Minh'));
$thursday = new DateTimeImmutable('2026-03-05 12:00:00', new DateTimeZone('Asia/Ho_Chi_Minh'));

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$price = $service->getEffectivePrice(['id' => 1, 'gia_ban' => 101], $friday);
$assert(
    $price['phan_tram_giam'] === 10 && $price['gia_ban_hieu_luc'] === 91,
    'Friday discount/rounding failed: ' . json_encode($price)
);
$assert($price['nguon'] === 'THU_SAU' && $price['khuyen_mai_id'] === 1, 'Friday source failed');

$price = $service->getEffectivePrice(['id' => 1, 'gia_ban' => 100], $thursday);
$assert($price['phan_tram_giam'] === 0 && $price['nguon'] === null, 'Non-Friday discount applied');

$price = $service->getEffectivePrice(['id' => 2, 'gia_ban' => 100], $friday);
$assert($price['phan_tram_giam'] === 50 && $price['nguon'] === 'CAN_HAN', 'Near-expiry should win without stacking');
$assert($price['khuyen_mai_id'] === null, 'Near-expiry should not expose a Friday promotion ID');

$price = $service->getEffectivePrice(['id' => 3, 'gia_ban' => 100], $friday);
$assert($price['phan_tram_giam'] === 70 && $price['nguon'] === 'THU_SAU', 'Higher Friday discount should win');

$price = $service->getEffectivePrice(['id' => 4, 'gia_ban' => 100], $friday);
$assert($price['phan_tram_giam'] === 0, 'Paused promotion applied');

$price = $service->getEffectivePrice(['id' => 5, 'gia_ban' => 100], $friday);
$assert($price['phan_tram_giam'] === 0, 'Expired promotion applied');

echo "PromotionService tests passed\n";
