<?php
declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;
use PDO;
use Throwable;

final class CartService
{
    private int $maxQuantity;

    public function __construct(
        private PDO $pdo,
        array $business
    ) {
        $this->maxQuantity = max(1, (int) ($business['cart']['max_qty_per_line'] ?? 99));
    }

    public function rows(?int $userId): array
    {
        if ($userId !== null) {
            $query = $this->pdo->prepare(
                'SELECT c.san_pham_id, c.so_luong,
                        s.id, s.ten_san_pham, s.hinh_anh, s.don_vi_tinh, s.gia_ban,
                        s.so_luong_ton, s.trang_thai AS san_pham_trang_thai,
                        d.trang_thai AS danh_muc_trang_thai
                 FROM gio_hang c
                 LEFT JOIN san_pham s ON s.id = c.san_pham_id
                 LEFT JOIN danh_muc d ON d.id = s.danh_muc_id
                 WHERE c.user_id = ?
                 ORDER BY c.id'
            );
            $query->execute([$userId]);
            return $query->fetchAll(PDO::FETCH_ASSOC);
        }

        $guestCart = $this->guestCart();
        if ($guestCart === []) {
            return [];
        }
        $ids = array_keys($guestCart);
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $query = $this->pdo->prepare(
            'SELECT s.id AS san_pham_id, s.id, s.ten_san_pham, s.hinh_anh,
                    s.don_vi_tinh, s.gia_ban, s.so_luong_ton,
                    s.trang_thai AS san_pham_trang_thai,
                    d.trang_thai AS danh_muc_trang_thai
             FROM san_pham s
             LEFT JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE s.id IN (' . $placeholders . ')
             ORDER BY s.id'
        );
        $query->execute($ids);
        $products = [];
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $product) {
            $id = (int) $product['san_pham_id'];
            $product['so_luong'] = $guestCart[$id];
            $products[$id] = $product;
        }

        $rows = [];
        foreach ($guestCart as $id => $quantity) {
            if (isset($products[$id])) {
                $rows[] = $products[$id];
            } else {
                $rows[] = [
                    'san_pham_id' => $id,
                    'so_luong' => $quantity,
                    'id' => null,
                    'ten_san_pham' => null,
                    'hinh_anh' => null,
                    'don_vi_tinh' => null,
                    'gia_ban' => 0,
                    'so_luong_ton' => 0,
                    'san_pham_trang_thai' => 0,
                    'danh_muc_trang_thai' => 0,
                ];
            }
        }
        return $rows;
    }

    public function add(int $productId, int $quantity, ?int $userId): void
    {
        if ($userId === null) {
            $product = $this->sellableProduct($productId);
            $current = $this->quantity($productId, null);
            $this->validateQuantity($quantity, (int) $product['so_luong_ton'], $current);
            $guestCart = $this->guestCart();
            $guestCart[$productId] = $current + $quantity;
            $_SESSION['cart'] = $guestCart;
            return;
        }

        $this->pdo->beginTransaction();
        try {
            $product = $this->sellableProduct($productId, true);
            $current = $this->quantity($productId, $userId, true);
            $this->validateQuantity($quantity, (int) $product['so_luong_ton'], $current);
            $newQuantity = $current + $quantity;
            $query = $this->pdo->prepare(
                'INSERT INTO gio_hang (user_id, san_pham_id, so_luong)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE so_luong = VALUES(so_luong)'
            );
            $query->execute([$userId, $productId, $newQuantity]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    public function update(int $productId, int $quantity, ?int $userId): void
    {
        if ($userId === null) {
            $product = $this->sellableProduct($productId);
            $this->validateQuantity($quantity, (int) $product['so_luong_ton']);
            $guestCart = $this->guestCart();
            if (!array_key_exists($productId, $guestCart)) {
                throw new InvalidArgumentException('Sản phẩm không có trong giỏ hàng.');
            }
            $guestCart[$productId] = $quantity;
            $_SESSION['cart'] = $guestCart;
            return;
        }

        $this->pdo->beginTransaction();
        try {
            $product = $this->sellableProduct($productId, true);
            $this->validateQuantity($quantity, (int) $product['so_luong_ton']);
            if ($this->quantity($productId, $userId, true) === 0) {
                throw new InvalidArgumentException('Sản phẩm không có trong giỏ hàng.');
            }
            $query = $this->pdo->prepare(
                'UPDATE gio_hang SET so_luong = ? WHERE user_id = ? AND san_pham_id = ?'
            );
            $query->execute([$quantity, $userId, $productId]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    public function delete(int $productId, ?int $userId): void
    {
        if ($userId !== null) {
            $query = $this->pdo->prepare(
                'DELETE FROM gio_hang WHERE user_id = ? AND san_pham_id = ?'
            );
            $query->execute([$userId, $productId]);
            return;
        }

        $guestCart = $this->guestCart();
        unset($guestCart[$productId]);
        $_SESSION['cart'] = $guestCart;
    }

    public function clear(?int $userId): void
    {
        if ($userId !== null) {
            $query = $this->pdo->prepare('DELETE FROM gio_hang WHERE user_id = ?');
            $query->execute([$userId]);
            return;
        }

        unset($_SESSION['cart']);
    }

    public function mergeGuestCart(int $userId): array
    {
        $guestCart = $this->guestCart();
        $adjustedItems = [];
        if ($guestCart === []) {
            unset($_SESSION['cart']);
            return ['adjusted_items' => []];
        }

        $this->pdo->beginTransaction();
        try {
            foreach ($guestCart as $productId => $guestQuantity) {
                $product = $this->product($productId, true);
                $existingQuantity = $this->quantity($productId, $userId, true);
                $desiredQuantity = $existingQuantity + $guestQuantity;
                $availableQuantity = $product !== false
                    && (int) $product['trang_thai'] === 1
                    && (int) $product['danh_muc_trang_thai'] === 1
                    ? (int) $product['so_luong_ton']
                    : 0;
                $mergedQuantity = min($desiredQuantity, $this->maxQuantity, $availableQuantity);

                if ($mergedQuantity !== $desiredQuantity) {
                    $adjustedItems[] = [
                        'san_pham_id' => $productId,
                        'so_luong_truoc_dieu_chinh' => $desiredQuantity,
                        'so_luong_sau_dieu_chinh' => $mergedQuantity,
                        'ly_do' => $availableQuantity === 0
                            ? 'san_pham_khong_con_kinh_doanh'
                            : ($desiredQuantity > $this->maxQuantity
                                ? 'vuot_so_luong_toi_da'
                                : 'vuot_ton_kho'),
                    ];
                }

                if ($mergedQuantity === 0) {
                    $delete = $this->pdo->prepare(
                        'DELETE FROM gio_hang WHERE user_id = ? AND san_pham_id = ?'
                    );
                    $delete->execute([$userId, $productId]);
                    continue;
                }

                $upsert = $this->pdo->prepare(
                    'INSERT INTO gio_hang (user_id, san_pham_id, so_luong)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE so_luong = VALUES(so_luong)'
                );
                $upsert->execute([$userId, $productId, $mergedQuantity]);
            }
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        unset($_SESSION['cart']);
        return ['adjusted_items' => $adjustedItems];
    }

    private function sellableProduct(int $productId, bool $forUpdate = false): array
    {
        $product = $this->product($productId, $forUpdate);
        if (
            $product === false
            || (int) $product['trang_thai'] !== 1
            || (int) $product['danh_muc_trang_thai'] !== 1
            || (int) $product['so_luong_ton'] < 1
        ) {
            throw new InvalidArgumentException('Sản phẩm không tồn tại, đang ẩn hoặc đã hết hàng.');
        }
        return $product;
    }

    private function product(int $productId, bool $forUpdate = false): array|false
    {
        $query = $this->pdo->prepare(
            'SELECT s.id, s.trang_thai, s.so_luong_ton, d.trang_thai AS danh_muc_trang_thai
             FROM san_pham s
             LEFT JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE s.id = ?
             LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $query->execute([$productId]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    private function quantity(int $productId, ?int $userId, bool $forUpdate = false): int
    {
        if ($userId !== null) {
            $query = $this->pdo->prepare(
                'SELECT so_luong FROM gio_hang
                 WHERE user_id = ? AND san_pham_id = ?
                 LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '')
            );
            $query->execute([$userId, $productId]);
            return (int) ($query->fetchColumn() ?: 0);
        }

        return (int) ($this->guestCart()[$productId] ?? 0);
    }

    private function validateQuantity(int $quantity, int $stock, int $alreadyInCart = 0): void
    {
        if ($quantity < 1) {
            throw new InvalidArgumentException('so_luong phải là số nguyên từ 1 trở lên.');
        }
        if ($quantity + $alreadyInCart > $this->maxQuantity) {
            throw new InvalidArgumentException('Số lượng vượt quá giới hạn mỗi dòng trong giỏ.');
        }
        if ($quantity + $alreadyInCart > $stock) {
            throw new InvalidArgumentException('Số lượng vượt quá tồn kho hiện tại.');
        }
    }

    private function guestCart(): array
    {
        $cart = $_SESSION['cart'] ?? [];
        if (!is_array($cart)) {
            return [];
        }

        $normalized = [];
        foreach ($cart as $productId => $quantity) {
            $id = filter_var((string) $productId, FILTER_VALIDATE_INT);
            $qty = filter_var($quantity, FILTER_VALIDATE_INT);
            if (
                $id === false
                || $id < 1
                || $qty === false
                || $qty < 1
            ) {
                continue;
            }
            $normalized[(int) $id] = (int) $qty;
        }
        ksort($normalized, SORT_NUMERIC);
        return $normalized;
    }
}
