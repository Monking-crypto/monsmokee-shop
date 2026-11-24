<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use PDO;
use PDOException;
use Logger;
use Request;
use Response;
use RuntimeException;
use Session;
use Throwable;

final class PromotionSelectionException extends RuntimeException
{
    public function __construct(
        public readonly int $selectedEligible,
        public readonly int $availableProducts
    ) {
        parent::__construct('Không đủ sản phẩm hợp lệ để kích hoạt chương trình');
    }
}

final class PromotionAdminController
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 50;

    public function __construct(private PDO $pdo, private array $businessConfig)
    {
    }

    public function index(Request $request, array $params = []): void
    {
        $query = $request->query;
        $page = $this->positiveInteger($query['page'] ?? 1);
        $perPage = $this->positiveInteger($query['per_page'] ?? self::DEFAULT_PER_PAGE);
        $errors = [];
        if ($page === null) {
            $errors['page'] = 'page phải là số nguyên dương';
        }
        if ($perPage === null || $perPage > self::MAX_PER_PAGE) {
            $errors['per_page'] = 'per_page phải từ 1 đến 50';
        }

        $conditions = [];
        $values = [];
        if (isset($query['q'])) {
            if (!is_string($query['q']) || mb_strlen(trim($query['q'])) > 100) {
                $errors['q'] = 'q phải là chuỗi không quá 100 ký tự';
            } elseif (trim($query['q']) !== '') {
                $conditions[] = '(p.ma_khuyen_mai LIKE ? OR p.ten_chuong_trinh LIKE ?)';
                $term = '%' . trim($query['q']) . '%';
                $values[] = $term;
                $values[] = $term;
            }
        }
        if (isset($query['loai'])) {
            if (!in_array($query['loai'], ['THU_SAU', 'CAN_HAN', 'KHAC'], true)) {
                $errors['loai'] = 'loai không hợp lệ';
            } else {
                $conditions[] = 'p.loai = ?';
                $values[] = $query['loai'];
            }
        }
        if (array_key_exists('trang_thai', $query)) {
            $status = $this->visibilityValue($query['trang_thai']);
            if ($status === null) {
                $errors['trang_thai'] = 'trang_thai chỉ nhận 0 hoặc 1';
            } else {
                $conditions[] = 'p.trang_thai = ?';
                $values[] = $status;
            }
        }
        if ($errors !== []) {
            Response::error('Tham số lọc khuyến mãi không hợp lệ', 422, $errors);
            return;
        }

        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM khuyen_mai p' . $where);
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $items = [];
        $totalPages = (int) ceil($total / $perPage);
        if ($page <= $totalPages) {
            $statement = $this->pdo->prepare(
                'SELECT p.id, p.ma_khuyen_mai, p.ten_chuong_trinh, p.loai,
                        p.phan_tram_giam, p.so_san_pham, p.che_do_chon_sp,
                        p.ngay_bat_dau, p.ngay_ket_thuc, p.trang_thai,
                        COUNT(ps.san_pham_id) AS so_san_pham_da_chon
                 FROM khuyen_mai p
                 LEFT JOIN khuyen_mai_san_pham ps ON ps.khuyen_mai_id = p.id'
                    . $where . '
                 GROUP BY p.id
                 ORDER BY p.ngay_bat_dau DESC, p.id DESC
                 LIMIT ? OFFSET ?'
            );
            foreach ($values as $index => $value) {
                $statement->bindValue($index + 1, $value);
            }
            $statement->bindValue(count($values) + 1, $perPage, PDO::PARAM_INT);
            $statement->bindValue(count($values) + 2, ($page - 1) * $perPage, PDO::PARAM_INT);
            $statement->execute();
            $items = array_map(fn(array $row): array => $this->formatPromotion($row), $statement->fetchAll(PDO::FETCH_ASSOC));
        }

        Response::success('Danh sách khuyến mãi', [
            'promotions' => $items,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ]);
    }

    public function show(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy khuyến mãi', 404);
            return;
        }
        $promotion = $this->findPromotion($id);
        if ($promotion === null) {
            Response::error('Không tìm thấy khuyến mãi', 404);
            return;
        }
        $productsQuery = $this->pdo->prepare(
            'SELECT s.id, s.ten_san_pham, s.trang_thai, s.so_luong_ton,
                    d.trang_thai AS danh_muc_trang_thai,
                    ps.la_chon_thu_cong
             FROM khuyen_mai_san_pham ps
             JOIN san_pham s ON s.id = ps.san_pham_id
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE ps.khuyen_mai_id = ?
             ORDER BY ps.la_chon_thu_cong DESC, s.ten_san_pham, s.id'
        );
        $productsQuery->execute([$id]);
        $products = [];
        $eligibleCount = 0;
        $needsReplacement = [];
        foreach ($productsQuery->fetchAll(PDO::FETCH_ASSOC) as $product) {
            $eligible = (int) $product['trang_thai'] === 1
                && (int) $product['so_luong_ton'] > 0
                && (int) $product['danh_muc_trang_thai'] === 1;
            if ($eligible) {
                $eligibleCount++;
            } else {
                $needsReplacement[] = [
                    'id' => (int) $product['id'],
                    'ten_san_pham' => $product['ten_san_pham'],
                    'ly_do' => (int) $product['trang_thai'] !== 1
                        ? 'Sản phẩm đang ẩn'
                        : ((int) $product['so_luong_ton'] <= 0
                            ? 'Sản phẩm đã hết hàng'
                            : 'Danh mục đang ẩn'),
                ];
            }
            $products[] = [
                'id' => (int) $product['id'],
                'ten_san_pham' => $product['ten_san_pham'],
                'la_chon_thu_cong' => (bool) $product['la_chon_thu_cong'],
                'hop_le' => $eligible,
            ];
        }

        $target = (int) $promotion['so_san_pham'];
        $warning = null;
        if ($promotion['loai'] === 'THU_SAU' && $eligibleCount < $target) {
            $warning = [
                'message' => 'Chương trình có ít hơn ' . $target . ' sản phẩm hợp lệ; hãy thay sản phẩm được cảnh báo.',
                'so_san_pham_hop_le' => $eligibleCount,
                'so_san_pham_can_co' => $target,
                'so_san_pham_con_thieu' => $target - $eligibleCount,
                'can_thay_the' => $needsReplacement,
            ];
        }

        Response::success('Chi tiết khuyến mãi', [
            'promotion' => $this->formatPromotion($promotion),
            'products' => $products,
            'warning' => $warning,
            'che_do_chon_sp' => $this->selectionMode($id),
        ]);
    }

    public function create(Request $request, array $params = []): void
    {
        $input = $this->validatedInput($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu khuyến mãi không hợp lệ', 422, $input['errors']);
            return;
        }
        $manualIds = $input['san_pham_ids'] ?? [];
        try {
            $this->pdo->beginTransaction();
            $insert = $this->pdo->prepare(
                'INSERT INTO khuyen_mai
                    (ma_khuyen_mai, ten_chuong_trinh, loai, phan_tram_giam,
                     so_tien_giam_toi_da, che_do_chon_sp, so_san_pham, lich_chay_thu,
                     ngay_bat_dau, ngay_ket_thuc, trang_thai)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([
                $input['ma_khuyen_mai'],
                $input['ten_chuong_trinh'],
                $input['loai'],
                $input['phan_tram_giam'],
                $input['so_tien_giam_toi_da'],
                $manualIds === [] ? 'NGAU_NHIEN' : 'THU_CONG',
                $input['so_san_pham'],
                $input['lich_chay_thu'],
                $input['ngay_bat_dau'],
                $input['ngay_ket_thuc'],
                $input['trang_thai'],
            ]);
            $id = (int) $this->pdo->lastInsertId();
            $this->syncSelection($id, $input, $manualIds, $input['trang_thai'] === 1);
            $this->pdo->commit();
        } catch (PromotionSelectionException $error) {
            $this->rollback();
            $this->selectionError($error);
            return;
        } catch (\InvalidArgumentException $error) {
            $this->rollback();
            Response::error($error->getMessage(), 422, ['san_pham_ids' => 'Kiểm tra lại các sản phẩm đã chọn']);
            return;
        } catch (PDOException $error) {
            $this->rollback();
            if ($error->getCode() === '23000') {
                Response::error('Mã khuyến mãi đã tồn tại hoặc sản phẩm không hợp lệ', 409);
                return;
            }
            throw $error;
        } catch (Throwable $error) {
            $this->rollback();
            throw $error;
        }

        $this->audit('promotion.created', $id);
        Response::success('Đã tạo khuyến mãi', ['id' => $id], 201);
    }

    public function update(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null || $this->findPromotion($id) === null) {
            Response::error('Không tìm thấy khuyến mãi', 404);
            return;
        }
        $input = $this->validatedInput($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu khuyến mãi không hợp lệ', 422, $input['errors']);
            return;
        }
        $manualIds = $input['san_pham_ids'] ?? $this->manualProductIds($id);
        unset($input['san_pham_ids']);
        try {
            $this->pdo->beginTransaction();
            $update = $this->pdo->prepare(
                'UPDATE khuyen_mai
                 SET ma_khuyen_mai = ?, ten_chuong_trinh = ?, loai = ?, phan_tram_giam = ?,
                     so_tien_giam_toi_da = ?, so_san_pham = ?, lich_chay_thu = ?,
                     ngay_bat_dau = ?, ngay_ket_thuc = ?, trang_thai = ?
                 WHERE id = ?'
            );
            $update->execute([
                $input['ma_khuyen_mai'],
                $input['ten_chuong_trinh'],
                $input['loai'],
                $input['phan_tram_giam'],
                $input['so_tien_giam_toi_da'],
                $input['so_san_pham'],
                $input['lich_chay_thu'],
                $input['ngay_bat_dau'],
                $input['ngay_ket_thuc'],
                $input['trang_thai'],
                $id,
            ]);
            $this->syncSelection($id, $input, $manualIds, $input['trang_thai'] === 1);
            $this->pdo->commit();
        } catch (PromotionSelectionException $error) {
            $this->rollback();
            $this->selectionError($error);
            return;
        } catch (\InvalidArgumentException $error) {
            $this->rollback();
            Response::error($error->getMessage(), 422, ['san_pham_ids' => 'Kiểm tra lại các sản phẩm đã chọn']);
            return;
        } catch (PDOException $error) {
            $this->rollback();
            if ($error->getCode() === '23000') {
                Response::error('Mã khuyến mãi đã tồn tại hoặc sản phẩm không hợp lệ', 409);
                return;
            }
            throw $error;
        } catch (Throwable $error) {
            $this->rollback();
            throw $error;
        }

        $this->audit('promotion.updated', $id);
        Response::success('Đã cập nhật khuyến mãi', ['id' => $id]);
    }

    public function updateStatus(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        $status = $this->visibilityValue($request->input('trang_thai'));
        if ($id === null || $status === null) {
            Response::error('Dữ liệu trạng thái không hợp lệ', 422, [
                'trang_thai' => 'trang_thai chỉ nhận 0 hoặc 1',
            ]);
            return;
        }
        if ($this->findPromotion($id) === null) {
            Response::error('Không tìm thấy khuyến mãi', 404);
            return;
        }
        try {
            $this->pdo->beginTransaction();
            $promotion = $this->findPromotion($id, true);
            if ($promotion === null) {
                $this->rollback();
                Response::error('Không tìm thấy khuyến mãi', 404);
                return;
            }
            if (
                $status === 1
                && (int) $promotion['trang_thai'] !== 1
                && $promotion['loai'] === 'THU_SAU'
            ) {
                $this->completeFridaySelection($id);
            }
            $update = $this->pdo->prepare('UPDATE khuyen_mai SET trang_thai = ? WHERE id = ?');
            $update->execute([$status, $id]);
            $this->pdo->commit();
        } catch (PromotionSelectionException $error) {
            $this->rollback();
            $this->selectionError($error);
            return;
        } catch (Throwable $error) {
            $this->rollback();
            throw $error;
        }

        $this->audit($status === 1 ? 'promotion.activated' : 'promotion.paused', $id);
        Response::success($status === 1 ? 'Đã kích hoạt khuyến mãi' : 'Đã tạm dừng khuyến mãi');
    }

    public function randomProducts(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy khuyến mãi', 404);
            return;
        }
        try {
            $this->pdo->beginTransaction();
            $promotion = $this->findPromotion($id, true);
            if ($promotion === null) {
                $this->rollback();
                Response::error('Không tìm thấy khuyến mãi', 404);
                return;
            }
            $this->syncSelection(
                $id,
                $promotion,
                $this->manualProductIds($id),
                (int) $promotion['trang_thai'] === 1,
                true
            );
            $this->pdo->commit();
        } catch (PromotionSelectionException $error) {
            $this->rollback();
            $this->selectionError($error);
            return;
        } catch (Throwable $error) {
            $this->rollback();
            throw $error;
        }

        $this->audit('promotion.random_products', $id);
        Response::success('Đã bốc lại sản phẩm ngẫu nhiên', [
            'id' => $id,
            'products' => $this->selectedProductSummary($id),
        ]);
    }

    public function delete(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy khuyến mãi', 404);
            return;
        }
        try {
            $this->pdo->beginTransaction();
            if ($this->findPromotion($id, true) === null) {
                $this->rollback();
                Response::error('Không tìm thấy khuyến mãi', 404);
                return;
            }
            $used = $this->pdo->prepare('SELECT COUNT(*) FROM don_hang WHERE khuyen_mai_id = ?');
            $used->execute([$id]);
            if ((int) $used->fetchColumn() > 0) {
                $this->rollback();
                Response::error('Khuyến mãi đã được dùng trong đơn hàng; chỉ được tạm dừng', 409);
                return;
            }
            $delete = $this->pdo->prepare('DELETE FROM khuyen_mai WHERE id = ?');
            $delete->execute([$id]);
            $this->pdo->commit();
        } catch (PDOException $error) {
            $this->rollback();
            if ($error->getCode() === '23000') {
                Response::error('Khuyến mãi đã được dùng trong đơn hàng; chỉ được tạm dừng', 409);
                return;
            }
            throw $error;
        } catch (Throwable $error) {
            $this->rollback();
            throw $error;
        }
        $this->audit('promotion.deleted', $id);
        Response::success('Đã xóa khuyến mãi');
    }

    private function syncSelection(
        int $promotionId,
        array $input,
        array $manualIds,
        bool $mustBeComplete,
        bool $forceRandom = false
    ): void {
        $type = (string) ($input['loai'] ?? '');
        $isFriday = $type === 'THU_SAU';
        $target = $isFriday
            ? max(1, (int) ($this->businessConfig['promotion']['friday_product_count'] ?? 10))
            : max(1, (int) ($input['so_san_pham'] ?? 10));
        if (count($manualIds) > $target) {
            throw new \InvalidArgumentException('Số sản phẩm Admin ghim vượt quá giới hạn');
        }
        $this->assertProductsExist($manualIds);

        $this->pdo->prepare('DELETE FROM khuyen_mai_san_pham WHERE khuyen_mai_id = ?')
            ->execute([$promotionId]);
        $selected = [];
        foreach ($manualIds as $productId) {
            $selected[$productId] = true;
            $this->insertSelection($promotionId, $productId, true);
        }

        if ($isFriday || $forceRandom) {
            $slots = max(0, $target - count($manualIds));
            if ($slots > 0) {
                $placeholders = $manualIds === []
                    ? ''
                    : ' AND s.id NOT IN (' . implode(',', array_fill(0, count($manualIds), '?')) . ')';
                $random = $this->pdo->prepare(
                    'SELECT s.id
                     FROM san_pham s
                     JOIN danh_muc d ON d.id = s.danh_muc_id
                     WHERE s.trang_thai = 1
                       AND s.so_luong_ton > 0
                       AND d.trang_thai = 1'
                        . $placeholders . '
                     ORDER BY RAND()
                     LIMIT ' . $slots
                );
                $random->execute($manualIds);
                foreach ($random->fetchAll(PDO::FETCH_COLUMN) as $productId) {
                    $productId = (int) $productId;
                    $selected[$productId] = false;
                    $this->insertSelection($promotionId, $productId, false);
                }
            }
        }

        $this->pdo->prepare('UPDATE khuyen_mai SET che_do_chon_sp = ? WHERE id = ?')
            ->execute([$manualIds === [] ? 'NGAU_NHIEN' : 'THU_CONG', $promotionId]);

        if ($isFriday && $mustBeComplete) {
            $eligible = $this->eligibleCount(array_keys($selected));
            if (count($selected) !== $target || $eligible !== $target) {
                throw new PromotionSelectionException($eligible, $this->availableProductCount());
            }
        }
    }

    private function insertSelection(int $promotionId, int $productId, bool $manual): void
    {
        $insert = $this->pdo->prepare(
            'INSERT INTO khuyen_mai_san_pham (khuyen_mai_id, san_pham_id, la_chon_thu_cong)
             VALUES (?, ?, ?)'
        );
        $insert->execute([$promotionId, $productId, $manual ? 1 : 0]);
    }

    private function completeFridaySelection(int $promotionId): void
    {
        $target = max(1, (int) ($this->businessConfig['promotion']['friday_product_count'] ?? 10));
        $manualIds = $this->manualProductIds($promotionId);
        if (count($manualIds) > $target) {
            throw new \InvalidArgumentException('Số sản phẩm Admin ghim vượt quá giới hạn');
        }

        $randomQuery = $this->pdo->prepare(
            'SELECT ps.san_pham_id
             FROM khuyen_mai_san_pham ps
             JOIN san_pham s ON s.id = ps.san_pham_id
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE ps.khuyen_mai_id = ?
               AND ps.la_chon_thu_cong = 0
               AND s.trang_thai = 1
               AND s.so_luong_ton > 0
               AND d.trang_thai = 1
             ORDER BY ps.san_pham_id'
        );
        $randomQuery->execute([$promotionId]);
        $randomIds = array_map('intval', $randomQuery->fetchAll(PDO::FETCH_COLUMN));
        $slots = max(0, $target - count($manualIds));
        $randomIds = array_slice($randomIds, 0, $slots);
        $excludedIds = array_values(array_unique(array_merge($manualIds, $randomIds)));
        $slotsToFill = max(0, $target - count($excludedIds));

        if ($slotsToFill > 0) {
            $placeholders = $excludedIds === []
                ? ''
                : ' AND s.id NOT IN (' . implode(',', array_fill(0, count($excludedIds), '?')) . ')';
            $candidateQuery = $this->pdo->prepare(
                'SELECT s.id
                 FROM san_pham s
                 JOIN danh_muc d ON d.id = s.danh_muc_id
                 WHERE s.trang_thai = 1
                   AND s.so_luong_ton > 0
                   AND d.trang_thai = 1'
                    . $placeholders . '
                 ORDER BY RAND()
                 LIMIT ' . $slotsToFill
            );
            $candidateQuery->execute($excludedIds);
            $randomIds = array_merge(
                $randomIds,
                array_map('intval', $candidateQuery->fetchAll(PDO::FETCH_COLUMN))
            );
        }

        $this->pdo->prepare('DELETE FROM khuyen_mai_san_pham WHERE khuyen_mai_id = ?')
            ->execute([$promotionId]);
        foreach ($manualIds as $productId) {
            $this->insertSelection($promotionId, $productId, true);
        }
        foreach ($randomIds as $productId) {
            $this->insertSelection($promotionId, $productId, false);
        }
        $this->pdo->prepare("UPDATE khuyen_mai SET che_do_chon_sp = ? WHERE id = ?")
            ->execute([$manualIds === [] ? 'NGAU_NHIEN' : 'THU_CONG', $promotionId]);

        $selectedIds = array_values(array_unique(array_merge($manualIds, $randomIds)));
        $eligible = $this->eligibleCount($selectedIds);
        if (count($selectedIds) !== $target || $eligible !== $target) {
            throw new PromotionSelectionException($eligible, $this->availableProductCount());
        }
    }

    private function assertProductsExist(array $ids): void
    {
        if ($ids === []) {
            return;
        }
        $query = $this->pdo->prepare(
            'SELECT id FROM san_pham WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')'
        );
        $query->execute($ids);
        if (count($query->fetchAll(PDO::FETCH_COLUMN)) !== count($ids)) {
            throw new \InvalidArgumentException('Một hoặc nhiều sản phẩm không tồn tại');
        }
    }

    private function eligibleCount(array $ids): int
    {
        if ($ids === []) {
            return 0;
        }
        $query = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM san_pham s
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE s.id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')
               AND s.trang_thai = 1
               AND s.so_luong_ton > 0
               AND d.trang_thai = 1'
        );
        $query->execute($ids);
        return (int) $query->fetchColumn();
    }

    private function availableProductCount(): int
    {
        return (int) $this->pdo->query(
            'SELECT COUNT(*)
             FROM san_pham s
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE s.trang_thai = 1 AND s.so_luong_ton > 0 AND d.trang_thai = 1'
        )->fetchColumn();
    }

    private function selectedProductSummary(int $id): array
    {
        $query = $this->pdo->prepare(
            'SELECT s.id, s.ten_san_pham, ps.la_chon_thu_cong
             FROM khuyen_mai_san_pham ps
             JOIN san_pham s ON s.id = ps.san_pham_id
             WHERE ps.khuyen_mai_id = ?
             ORDER BY ps.la_chon_thu_cong DESC, s.ten_san_pham, s.id'
        );
        $query->execute([$id]);
        return array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'ten_san_pham' => $row['ten_san_pham'],
                'la_chon_thu_cong' => (bool) $row['la_chon_thu_cong'],
            ],
            $query->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    private function findPromotion(int $id, bool $forUpdate = false): ?array
    {
        $query = $this->pdo->prepare(
            'SELECT * FROM khuyen_mai WHERE id = ? LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $query->execute([$id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    private function manualProductIds(int $id): array
    {
        $query = $this->pdo->prepare(
            'SELECT san_pham_id FROM khuyen_mai_san_pham
             WHERE khuyen_mai_id = ? AND la_chon_thu_cong = 1
             ORDER BY san_pham_id'
        );
        $query->execute([$id]);
        return array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN));
    }

    private function selectionMode(int $id): string
    {
        return $this->manualProductIds($id) === [] ? 'NGAU_NHIEN' : 'THU_CONG';
    }

    private function validatedInput(array $input): array
    {
        $errors = [];
        $code = $input['ma_khuyen_mai'] ?? null;
        $title = $input['ten_chuong_trinh'] ?? null;
        $type = $input['loai'] ?? null;
        $percent = $this->positiveInteger($input['phan_tram_giam'] ?? null);
        $productCount = $this->positiveInteger(
            $input['so_san_pham'] ?? ($this->businessConfig['promotion']['friday_product_count'] ?? 10)
        );
        $status = $this->visibilityValue($input['trang_thai'] ?? 0);
        $start = $this->dateTimeValue($input['ngay_bat_dau'] ?? null, false);
        $end = $this->dateTimeValue($input['ngay_ket_thuc'] ?? null, true);
        if (!is_string($code) || trim(strip_tags($code)) === '' || mb_strlen(trim($code)) > 30) {
            $errors['ma_khuyen_mai'] = 'Mã bắt buộc và không quá 30 ký tự';
        }
        if (!is_string($title) || trim(strip_tags($title)) === '' || mb_strlen(trim($title)) > 150) {
            $errors['ten_chuong_trinh'] = 'Tên chương trình bắt buộc và không quá 150 ký tự';
        }
        if (!in_array($type, ['THU_SAU', 'CAN_HAN', 'KHAC'], true)) {
            $errors['loai'] = 'loai phải là THU_SAU, CAN_HAN hoặc KHAC';
        }
        if ($percent === null || $percent < 1 || $percent > 100) {
            $errors['phan_tram_giam'] = 'phan_tram_giam phải từ 1 đến 100';
        }
        if ($productCount === null || $productCount > 100) {
            $errors['so_san_pham'] = 'so_san_pham phải từ 1 đến 100';
        } elseif ($type === 'THU_SAU' && $productCount !== (int) ($this->businessConfig['promotion']['friday_product_count'] ?? 10)) {
            $errors['so_san_pham'] = 'Chương trình THU_SAU phải có đúng 10 sản phẩm';
        }
        if ($status === null) {
            $errors['trang_thai'] = 'trang_thai chỉ nhận 0 hoặc 1';
        }
        if ($start === null) {
            $errors['ngay_bat_dau'] = 'Ngày bắt đầu phải là ngày giờ hợp lệ';
        }
        if ($end === null) {
            $errors['ngay_ket_thuc'] = 'Ngày kết thúc phải là ngày giờ hợp lệ';
        }
        if ($start !== null && $end !== null && $end < $start) {
            $errors['ngay_ket_thuc'] = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu';
        }
        $maxDiscount = null;
        if (array_key_exists('so_tien_giam_toi_da', $input) && $input['so_tien_giam_toi_da'] !== null) {
            $maxDiscount = $this->nonNegativeInteger($input['so_tien_giam_toi_da']);
            if ($maxDiscount === null) {
                $errors['so_tien_giam_toi_da'] = 'so_tien_giam_toi_da phải là số nguyên không âm hoặc null';
            }
        }

        $manualIds = null;
        if (array_key_exists('san_pham_ids', $input)) {
            if (!is_array($input['san_pham_ids'])) {
                $errors['san_pham_ids'] = 'san_pham_ids phải là mảng';
            } else {
                $manualIds = [];
                foreach ($input['san_pham_ids'] as $index => $value) {
                    $productId = $this->positiveInteger($value);
                    if ($productId === null || in_array($productId, $manualIds, true)) {
                        $errors['san_pham_ids.' . $index] = 'ID sản phẩm không hợp lệ hoặc bị trùng';
                    } else {
                        $manualIds[] = $productId;
                    }
                }
                $maximum = $type === 'THU_SAU'
                    ? (int) ($this->businessConfig['promotion']['friday_product_count'] ?? 10)
                    : ($productCount ?? 100);
                if (count($manualIds) > $maximum) {
                    $errors['san_pham_ids'] = 'Số sản phẩm ghim vượt quá giới hạn';
                }
            }
        }

        $weekday = null;
        if ($type === 'THU_SAU') {
            $weekday = 5;
        } elseif (array_key_exists('lich_chay_thu', $input) && $input['lich_chay_thu'] !== null) {
            $weekday = $this->positiveInteger($input['lich_chay_thu']);
            if ($weekday === null || $weekday > 7) {
                $errors['lich_chay_thu'] = 'lich_chay_thu phải từ 1 đến 7 hoặc null';
            }
        }
        if ($errors !== []) {
            return ['errors' => $errors];
        }
        $result = [
            'ma_khuyen_mai' => trim(strip_tags($code)),
            'ten_chuong_trinh' => trim(strip_tags($title)),
            'loai' => $type,
            'phan_tram_giam' => $percent,
            'so_tien_giam_toi_da' => $maxDiscount,
            'so_san_pham' => $productCount,
            'lich_chay_thu' => $weekday,
            'ngay_bat_dau' => $start,
            'ngay_ket_thuc' => $end,
            'trang_thai' => $status,
        ];
        if ($manualIds !== null) {
            $result['san_pham_ids'] = $manualIds;
        }
        return $result;
    }

    private function dateTimeValue(mixed $value, bool $isEnd): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $timezone = new \DateTimeZone('Asia/Ho_Chi_Minh');
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value, $timezone);
            $errors = \DateTimeImmutable::getLastErrors();
            if (
                $date === false
                || ($errors !== false && ($errors['warning_count'] || $errors['error_count']))
                || $date->format('Y-m-d') !== $value
            ) {
                return null;
            }
            return $date->setTime($isEnd ? 23 : 0, $isEnd ? 59 : 0, $isEnd ? 59 : 0)
                ->format('Y-m-d H:i:s');
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, $timezone);
        $errors = \DateTimeImmutable::getLastErrors();
        if (
            $date === false
            || ($errors !== false && ($errors['warning_count'] || $errors['error_count']))
            || $date->format('Y-m-d H:i:s') !== $value
        ) {
            return null;
        }
        return $date->format('Y-m-d H:i:s');
    }

    private function formatPromotion(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'ma_khuyen_mai' => $row['ma_khuyen_mai'],
            'ten_chuong_trinh' => $row['ten_chuong_trinh'],
            'loai' => $row['loai'],
            'phan_tram_giam' => (int) $row['phan_tram_giam'],
            'so_san_pham' => (int) $row['so_san_pham'],
            'so_san_pham_da_chon' => (int) ($row['so_san_pham_da_chon'] ?? 0),
            'che_do_chon_sp' => $row['che_do_chon_sp'] ?? null,
            'ngay_bat_dau' => $row['ngay_bat_dau'],
            'ngay_ket_thuc' => $row['ngay_ket_thuc'],
            'trang_thai' => (int) $row['trang_thai'],
        ];
    }

    private function selectionError(PromotionSelectionException $error): void
    {
        Response::error($error->getMessage(), 422, [
            'so_san_pham_hop_le' => $error->selectedEligible,
            'so_san_pham_can_co' => (int) ($this->businessConfig['promotion']['friday_product_count'] ?? 10),
            'so_san_pham_co_the_chon' => $error->availableProducts,
        ]);
    }

    private function audit(string $action, int $id): void
    {
        Logger::write(
            'admin_audit.log',
            'admin_id=' . (int) Session::get('user_id')
                . ' action=' . $action . ' entity=promotion entity_id=' . $id
        );
    }

    private function rollback(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    private function positiveInteger(mixed $value): ?int
    {
        if (!is_string($value) && !is_int($value)) {
            return null;
        }
        $text = (string) $value;
        if ($text === '' || !ctype_digit($text)) {
            return null;
        }
        $number = filter_var($text, FILTER_VALIDATE_INT);
        return is_int($number) && $number > 0 ? $number : null;
    }

    private function nonNegativeInteger(mixed $value): ?int
    {
        if (!is_string($value) && !is_int($value)) {
            return null;
        }
        $text = (string) $value;
        if ($text === '' || !ctype_digit($text)) {
            return null;
        }
        $number = filter_var($text, FILTER_VALIDATE_INT);
        return is_int($number) && $number >= 0 ? $number : null;
    }

    private function visibilityValue(mixed $value): ?int
    {
        if ($value === true || $value === 1 || $value === '1') {
            return 1;
        }
        if ($value === false || $value === 0 || $value === '0') {
            return 0;
        }
        return null;
    }
}
