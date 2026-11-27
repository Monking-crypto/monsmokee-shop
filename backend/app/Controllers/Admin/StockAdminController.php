<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use DateTimeImmutable;
use PDO;
use Request;
use Response;
use Session;
use Throwable;

final class StockAdminController
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 50;
    private const MAX_QUANTITY = 2147483647;
    private const MAX_PRICE = 999999999999;
    private const MAX_RECEIPT_TOTAL = 99999999999999;

    public function __construct(private PDO $pdo, private array $businessConfig = [])
    {
    }

    public function createReceipt(Request $request, array $params = []): void
    {
        $input = $this->validatedReceipt($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu phiếu nhập không hợp lệ', 422, $input['errors']);
            return;
        }

        $productQuantities = [];
        $total = 0;
        foreach ($input['lines'] as $index => $line) {
            $current = $productQuantities[$line['san_pham_id']] ?? 0;
            if ($current > self::MAX_QUANTITY - $line['so_luong']) {
                Response::error('Tổng số lượng nhập vượt giới hạn kho', 422, [
                    'chi_tiet[' . $index . '].so_luong' => 'Tổng số lượng sản phẩm quá lớn',
                ]);
                return;
            }
            $productQuantities[$line['san_pham_id']] = $current + $line['so_luong'];
            if ($line['gia_nhap'] > 0) {
                if (
                    $line['so_luong'] > intdiv(self::MAX_RECEIPT_TOTAL - $total, $line['gia_nhap'])
                ) {
                    Response::error('Tổng giá trị phiếu nhập vượt giới hạn', 422, [
                        'chi_tiet[' . $index . '].gia_nhap' => 'Tổng giá trị phiếu nhập quá lớn',
                    ]);
                    return;
                }
                $total += $line['so_luong'] * $line['gia_nhap'];
            }
        }

        $this->pdo->beginTransaction();
        try {
            $productIds = array_keys($productQuantities);
            sort($productIds, SORT_NUMERIC);
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $productsQuery = $this->pdo->prepare(
                'SELECT id, so_luong_ton, trang_thai
                 FROM san_pham
                 WHERE id IN (' . $placeholders . ')
                 ORDER BY id
                 FOR UPDATE'
            );
            $productsQuery->execute($productIds);
            $products = [];
            foreach ($productsQuery->fetchAll(PDO::FETCH_ASSOC) as $product) {
                $products[(int) $product['id']] = $product;
            }
            foreach ($productQuantities as $productId => $quantity) {
                if (
                    !isset($products[$productId])
                    || (int) $products[$productId]['trang_thai'] !== 1
                ) {
                    $this->pdo->rollBack();
                    Response::error('Sản phẩm không tồn tại hoặc đã bị ẩn', 422, [
                        'san_pham_id' => 'Kiểm tra lại các sản phẩm trong phiếu nhập',
                    ]);
                    return;
                }
                if ((int) $products[$productId]['so_luong_ton'] > self::MAX_QUANTITY - $quantity) {
                    $this->pdo->rollBack();
                    Response::error('Tổng tồn kho vượt giới hạn', 422, [
                        'san_pham_id' => 'Số lượng nhập vượt giới hạn tồn kho',
                    ]);
                    return;
                }
            }

            $receiptCode = 'PN' . date('ymd') . strtoupper(bin2hex(random_bytes(5)));
            $receipt = $this->pdo->prepare(
                'INSERT INTO phieu_nhap_kho
                    (ma_phieu, admin_id, ngay_nhap, nha_cung_cap, tong_tien_nhap, ghi_chu, trang_thai)
                 VALUES (?, ?, ?, ?, ?, ?, \'HOAN_THANH\')'
            );
            $receipt->execute([
                $receiptCode,
                (int) Session::get('user_id'),
                $input['ngay_nhap'] . ' 00:00:00',
                $input['nha_cung_cap'],
                $total,
                $input['ghi_chu'],
            ]);
            $receiptId = (int) $this->pdo->lastInsertId();

            $insertDetail = $this->pdo->prepare(
                'INSERT INTO chi_tiet_phieu_nhap
                    (phieu_nhap_id, san_pham_id, so_luong_nhap, gia_nhap,
                     ngay_san_xuat, han_su_dung, so_lo)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $insertBatch = $this->pdo->prepare(
                'INSERT INTO lo_hang
                    (san_pham_id, chi_tiet_phieu_nhap_id, ngay_san_xuat,
                     han_su_dung, so_luong_nhap, so_luong_con)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($input['lines'] as $line) {
                $insertDetail->execute([
                    $receiptId,
                    $line['san_pham_id'],
                    $line['so_luong'],
                    $line['gia_nhap'],
                    $line['ngay_san_xuat'],
                    $line['han_su_dung'],
                    $line['so_lo'],
                ]);
                $detailId = (int) $this->pdo->lastInsertId();
                $insertBatch->execute([
                    $line['san_pham_id'],
                    $detailId,
                    $line['ngay_san_xuat'],
                    $line['han_su_dung'],
                    $line['so_luong'],
                    $line['so_luong'],
                ]);
            }

            $updateStock = $this->pdo->prepare(
                'UPDATE san_pham
                 SET so_luong_ton = so_luong_ton + ?
                 WHERE id = ? AND so_luong_ton <= ?'
            );
            $insertHistory = $this->pdo->prepare(
                'INSERT INTO lich_su_kho
                    (san_pham_id, loai_giao_dich, so_luong_thay_doi, ton_sau_giao_dich,
                     tham_chieu_loai, tham_chieu_id, nguoi_thuc_hien_id, ghi_chu)
                 VALUES (?, \'NHAP_KHO\', ?, ?, \'PHIEU_NHAP\', ?, ?, ?)'
            );
            foreach ($productQuantities as $productId => $quantity) {
                $before = (int) $products[$productId]['so_luong_ton'];
                $after = $before + $quantity;
                $updateStock->execute([$quantity, $productId, self::MAX_QUANTITY - $quantity]);
                if ($updateStock->rowCount() !== 1 || $after < $before) {
                    throw new \RuntimeException('Không thể cập nhật tồn kho một cách an toàn.');
                }
                $insertHistory->execute([
                    $productId,
                    $quantity,
                    $after,
                    $receiptId,
                    (int) Session::get('user_id'),
                    'Nhập kho ' . $receiptCode,
                ]);
            }

            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        $this->audit('stock_receipt.created', 'receipt', $receiptId);
        Response::success('Đã tạo phiếu nhập kho', [
            'id' => $receiptId,
            'ma_phieu' => $receiptCode,
            'tong_tien_nhap' => $total,
        ], 201);
    }

    public function receipts(Request $request, array $params = []): void
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
        $from = $this->optionalDate($query['from_date'] ?? null, 'from_date', $errors);
        $to = $this->optionalDate($query['to_date'] ?? null, 'to_date', $errors);
        if ($from !== null && $to !== null && $from > $to) {
            $errors['from_date'] = 'from_date không được sau to_date';
        }
        if ($errors !== []) {
            Response::error('Tham số lọc phiếu nhập không hợp lệ', 422, $errors);
            return;
        }

        $conditions = [];
        $values = [];
        if ($from !== null) {
            $conditions[] = 'p.ngay_nhap >= ?';
            $values[] = $from . ' 00:00:00';
        }
        if ($to !== null) {
            $conditions[] = 'p.ngay_nhap < DATE_ADD(?, INTERVAL 1 DAY)';
            $values[] = $to;
        }
        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM phieu_nhap_kho p' . $where);
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $totalPages = (int) ceil($total / $perPage);
        $receipts = [];
        if ($page <= $totalPages) {
            $list = $this->pdo->prepare(
                'SELECT p.id, p.ma_phieu, p.admin_id, p.ngay_nhap, p.nha_cung_cap,
                        p.tong_tien_nhap, p.ghi_chu, p.trang_thai,
                        COUNT(d.id) AS so_dong
                 FROM phieu_nhap_kho p
                 LEFT JOIN chi_tiet_phieu_nhap d ON d.phieu_nhap_id = p.id' . $where . '
                 GROUP BY p.id, p.ma_phieu, p.admin_id, p.ngay_nhap, p.nha_cung_cap,
                          p.tong_tien_nhap, p.ghi_chu, p.trang_thai
                 ORDER BY p.ngay_nhap DESC, p.id DESC
                 LIMIT ? OFFSET ?'
            );
            foreach ($values as $index => $value) {
                $list->bindValue($index + 1, $value);
            }
            $list->bindValue(count($values) + 1, $perPage, PDO::PARAM_INT);
            $list->bindValue(count($values) + 2, ($page - 1) * $perPage, PDO::PARAM_INT);
            $list->execute();
            $receipts = array_map(
                static fn(array $row): array => [
                    'id' => (int) $row['id'],
                    'ma_phieu' => $row['ma_phieu'],
                    'admin_id' => (int) $row['admin_id'],
                    'ngay_nhap' => $row['ngay_nhap'],
                    'nha_cung_cap' => $row['nha_cung_cap'],
                    'tong_tien_nhap' => (int) $row['tong_tien_nhap'],
                    'ghi_chu' => $row['ghi_chu'],
                    'trang_thai' => $row['trang_thai'],
                    'so_dong' => (int) $row['so_dong'],
                ],
                $list->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        Response::success('Danh sách phiếu nhập kho', [
            'receipts' => $receipts,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ]);
    }

    public function receiptDetail(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy phiếu nhập', 404);
            return;
        }
        $receiptQuery = $this->pdo->prepare(
            'SELECT id, ma_phieu, admin_id, ngay_nhap, nha_cung_cap,
                    tong_tien_nhap, ghi_chu, trang_thai
             FROM phieu_nhap_kho WHERE id = ?'
        );
        $receiptQuery->execute([$id]);
        $receipt = $receiptQuery->fetch(PDO::FETCH_ASSOC);
        if ($receipt === false) {
            Response::error('Không tìm thấy phiếu nhập', 404);
            return;
        }
        $linesQuery = $this->pdo->prepare(
            'SELECT d.id AS chi_tiet_id, d.san_pham_id, s.ten_san_pham,
                    d.so_luong_nhap, d.gia_nhap, d.ngay_san_xuat,
                    d.han_su_dung, d.so_lo, b.id AS lo_hang_id,
                    b.so_luong_nhap AS lo_so_luong_nhap,
                    b.so_luong_con AS lo_so_luong_con
             FROM chi_tiet_phieu_nhap d
             JOIN san_pham s ON s.id = d.san_pham_id
             LEFT JOIN lo_hang b ON b.chi_tiet_phieu_nhap_id = d.id
             WHERE d.phieu_nhap_id = ?
             ORDER BY d.id'
        );
        $linesQuery->execute([$id]);
        $lines = array_map(
            static fn(array $row): array => [
                'chi_tiet_id' => (int) $row['chi_tiet_id'],
                'san_pham_id' => (int) $row['san_pham_id'],
                'ten_san_pham' => $row['ten_san_pham'],
                'so_luong' => (int) $row['so_luong_nhap'],
                'gia_nhap' => (int) $row['gia_nhap'],
                'ngay_san_xuat' => $row['ngay_san_xuat'],
                'han_su_dung' => $row['han_su_dung'],
                'so_lo' => $row['so_lo'],
                'lo_hang' => $row['lo_hang_id'] === null ? null : [
                    'id' => (int) $row['lo_hang_id'],
                    'so_luong_nhap' => (int) $row['lo_so_luong_nhap'],
                    'so_luong_con' => (int) $row['lo_so_luong_con'],
                ],
            ],
            $linesQuery->fetchAll(PDO::FETCH_ASSOC)
        );

        $receipt['id'] = (int) $receipt['id'];
        $receipt['admin_id'] = (int) $receipt['admin_id'];
        $receipt['tong_tien_nhap'] = (int) $receipt['tong_tien_nhap'];
        $receipt['chi_tiet'] = $lines;
        Response::success('Chi tiết phiếu nhập kho', ['receipt' => $receipt]);
    }

    public function cancelReceipt(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy phiếu nhập', 404);
            return;
        }

        $this->pdo->beginTransaction();
        try {
            $receiptQuery = $this->pdo->prepare(
                'SELECT id, ma_phieu, trang_thai
                 FROM phieu_nhap_kho
                 WHERE id = ?
                 FOR UPDATE'
            );
            $receiptQuery->execute([$id]);
            $receipt = $receiptQuery->fetch(PDO::FETCH_ASSOC);
            if ($receipt === false) {
                $this->pdo->rollBack();
                Response::error('Không tìm thấy phiếu nhập', 404);
                return;
            }
            if ($receipt['trang_thai'] !== 'HOAN_THANH') {
                $this->pdo->rollBack();
                Response::error('Phiếu nhập đã được hủy trước đó', 409, [
                    'reason' => 'RECEIPT_ALREADY_CANCELED',
                ]);
                return;
            }

            $detailsQuery = $this->pdo->prepare(
                'SELECT id, san_pham_id, so_luong_nhap
                 FROM chi_tiet_phieu_nhap
                 WHERE phieu_nhap_id = ?
                 ORDER BY san_pham_id, id
                 FOR UPDATE'
            );
            $detailsQuery->execute([$id]);
            $details = $detailsQuery->fetchAll(PDO::FETCH_ASSOC);
            if ($details === []) {
                $this->pdo->rollBack();
                Response::error('Phiếu nhập không có dòng hàng để hủy', 409, [
                    'reason' => 'RECEIPT_HAS_NO_LINES',
                ]);
                return;
            }

            $batchesQuery = $this->pdo->prepare(
                'SELECT id, chi_tiet_phieu_nhap_id, so_luong_nhap, so_luong_con
                 FROM lo_hang
                 WHERE chi_tiet_phieu_nhap_id IN (
                     SELECT id FROM chi_tiet_phieu_nhap WHERE phieu_nhap_id = ?
                 )
                 ORDER BY chi_tiet_phieu_nhap_id, id
                 FOR UPDATE'
            );
            $batchesQuery->execute([$id]);
            $batches = [];
            foreach ($batchesQuery->fetchAll(PDO::FETCH_ASSOC) as $batch) {
                $batches[(int) $batch['chi_tiet_phieu_nhap_id']][] = $batch;
            }

            $productQuantities = [];
            foreach ($details as $detail) {
                $detailId = (int) $detail['id'];
                $detailBatches = $batches[$detailId] ?? [];
                if (count($detailBatches) !== 1) {
                    $this->pdo->rollBack();
                    Response::error('Không thể hủy phiếu: thiếu hoặc trùng lô hàng', 409, [
                        'reason' => 'RECEIPT_BATCH_MISMATCH',
                    ]);
                    return;
                }
                $batch = $detailBatches[0];
                if (
                    (int) $batch['so_luong_con'] !== (int) $batch['so_luong_nhap']
                    || (int) $batch['so_luong_nhap'] !== (int) $detail['so_luong_nhap']
                ) {
                    $this->pdo->rollBack();
                    Response::error('Không thể hủy phiếu: đã có hàng trong lô được xuất', 409, [
                        'reason' => 'BATCH_HAS_BEEN_ISSUED',
                        'chi_tiet_id' => $detailId,
                        'lo_so_luong_nhap' => (int) $batch['so_luong_nhap'],
                        'lo_so_luong_con' => (int) $batch['so_luong_con'],
                    ]);
                    return;
                }
                $productId = (int) $detail['san_pham_id'];
                $productQuantities[$productId] = ($productQuantities[$productId] ?? 0)
                    + (int) $detail['so_luong_nhap'];
            }

            $productIds = array_keys($productQuantities);
            sort($productIds, SORT_NUMERIC);
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $productsQuery = $this->pdo->prepare(
                'SELECT id, so_luong_ton
                 FROM san_pham
                 WHERE id IN (' . $placeholders . ')
                 ORDER BY id
                 FOR UPDATE'
            );
            $productsQuery->execute($productIds);
            $products = [];
            foreach ($productsQuery->fetchAll(PDO::FETCH_ASSOC) as $product) {
                $products[(int) $product['id']] = $product;
            }
            foreach ($productQuantities as $productId => $quantity) {
                if (
                    !isset($products[$productId])
                    || (int) $products[$productId]['so_luong_ton'] < $quantity
                ) {
                    $this->pdo->rollBack();
                    Response::error('Không thể hủy phiếu: tồn kho hiện tại không đủ để trừ', 409, [
                        'reason' => 'INSUFFICIENT_PRODUCT_STOCK',
                        'san_pham_id' => $productId,
                    ]);
                    return;
                }
            }

            $updateBatch = $this->pdo->prepare(
                'UPDATE lo_hang
                 SET so_luong_con = 0
                 WHERE id = ? AND so_luong_con = so_luong_nhap'
            );
            $updateProduct = $this->pdo->prepare(
                'UPDATE san_pham
                 SET so_luong_ton = so_luong_ton - ?
                 WHERE id = ? AND so_luong_ton >= ?'
            );
            $insertHistory = $this->pdo->prepare(
                'INSERT INTO lich_su_kho
                    (san_pham_id, loai_giao_dich, so_luong_thay_doi, ton_sau_giao_dich,
                     tham_chieu_loai, tham_chieu_id, nguoi_thuc_hien_id, ghi_chu)
                 VALUES (?, \'HUY_DON\', ?, ?, \'PHIEU_NHAP\', ?, ?, ?)'
            );
            foreach ($details as $detail) {
                $batch = $batches[(int) $detail['id']][0];
                $updateBatch->execute([(int) $batch['id']]);
                if ($updateBatch->rowCount() !== 1) {
                    throw new \RuntimeException('Lô hàng thay đổi trong lúc hủy phiếu.');
                }
            }
            foreach ($productQuantities as $productId => $quantity) {
                $before = (int) $products[$productId]['so_luong_ton'];
                $after = $before - $quantity;
                $updateProduct->execute([$quantity, $productId, $quantity]);
                if ($updateProduct->rowCount() !== 1 || $after < 0) {
                    throw new \RuntimeException('Không thể giảm tồn kho một cách an toàn.');
                }
                $insertHistory->execute([
                    $productId,
                    -$quantity,
                    $after,
                    $id,
                    (int) Session::get('user_id'),
                    'Hủy phiếu nhập ' . $receipt['ma_phieu'],
                ]);
            }
            $cancel = $this->pdo->prepare(
                'UPDATE phieu_nhap_kho SET trang_thai = \'DA_HUY\' WHERE id = ? AND trang_thai = \'HOAN_THANH\''
            );
            $cancel->execute([$id]);
            if ($cancel->rowCount() !== 1) {
                throw new \RuntimeException('Không thể cập nhật trạng thái phiếu nhập.');
            }
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        $this->audit('stock_receipt.canceled', 'receipt', $id);
        Response::success('Đã hủy phiếu nhập kho', [
            'id' => $id,
            'trang_thai' => 'DA_HUY',
        ]);
    }

    public function batches(Request $request, array $params = []): void
    {
        $this->batchList($request, $params, false);
    }

    public function expiring(Request $request, array $params = []): void
    {
        $this->batchList($request, $params, true);
    }

    private function batchList(Request $request, array $params, bool $expiringOnly): void
    {
        $query = $request->query;
        $productId = null;
        $errors = [];
        if (array_key_exists('product_id', $query)) {
            $productId = $this->positiveInteger($query['product_id']);
            if ($productId === null) {
                $errors['product_id'] = 'product_id phải là số nguyên dương';
            }
        }
        $expired = null;
        if (!$expiringOnly && array_key_exists('expired', $query)) {
            $expired = $this->booleanInteger($query['expired']);
            if ($expired === null) {
                $errors['expired'] = 'expired phải là 0 hoặc 1';
            }
        } elseif ($expiringOnly && array_key_exists('expired', $query)) {
            $errors['expired'] = 'Không kết hợp lọc sắp hết hạn với lọc hết hạn';
        }
        $days = null;
        $daysParameter = $expiringOnly ? 'days' : 'expiring_within_days';
        if (array_key_exists($daysParameter, $query)) {
            $days = $this->positiveInteger($query[$daysParameter]);
            if ($days === null || $days > 3650) {
                $errors[$daysParameter] = $daysParameter . ' phải từ 1 đến 3650';
            }
        } elseif ($expiringOnly) {
            $days = min(
                3650,
                max(1, (int) ($this->businessConfig['promotion']['near_expiry_days'] ?? 10))
            );
        }
        if ($expired === 1 && $days !== null) {
            $errors['expiring_within_days'] = 'Không kết hợp lọc hết hạn với sắp hết hạn';
        }
        if ($errors !== []) {
            Response::error('Tham số lọc lô hàng không hợp lệ', 422, $errors);
            return;
        }

        $conditions = ['b.so_luong_con > 0'];
        $values = [];
        if ($productId !== null) {
            $conditions[] = 'b.san_pham_id = ?';
            $values[] = $productId;
        }
        if ($expired === 1) {
            $conditions[] = 'b.han_su_dung < CURDATE()';
        } elseif ($days !== null) {
            $today = new DateTimeImmutable('today', new \DateTimeZone('Asia/Ho_Chi_Minh'));
            $until = $today->modify('+' . $days . ' days')->format('Y-m-d');
            $conditions[] = 'b.han_su_dung >= ? AND b.han_su_dung <= ?';
            $values[] = $today->format('Y-m-d');
            $values[] = $until;
        }
        $list = $this->pdo->prepare(
            'SELECT b.id, b.san_pham_id, s.ten_san_pham, b.chi_tiet_phieu_nhap_id,
                    d.phieu_nhap_id, p.ma_phieu, d.so_lo,
                    b.ngay_san_xuat, b.han_su_dung, b.so_luong_nhap, b.so_luong_con
             FROM lo_hang b
             JOIN san_pham s ON s.id = b.san_pham_id
             LEFT JOIN chi_tiet_phieu_nhap d ON d.id = b.chi_tiet_phieu_nhap_id
             LEFT JOIN phieu_nhap_kho p
               ON p.id = d.phieu_nhap_id AND p.trang_thai = \'HOAN_THANH\'
             WHERE ' . implode(' AND ', $conditions) . '
               AND (d.id IS NULL OR p.id IS NOT NULL)
             -- Future sales must lock and consume available batches in FEFO order.
             ORDER BY b.han_su_dung ASC, b.id ASC'
        );
        $list->execute($values);
        $batches = array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'san_pham_id' => (int) $row['san_pham_id'],
                'ten_san_pham' => $row['ten_san_pham'],
                'phieu_nhap_id' => $row['phieu_nhap_id'] === null ? null : (int) $row['phieu_nhap_id'],
                'ma_phieu' => $row['ma_phieu'],
                'chi_tiet_phieu_nhap_id' => $row['chi_tiet_phieu_nhap_id'] === null
                    ? null
                    : (int) $row['chi_tiet_phieu_nhap_id'],
                'so_lo' => $row['so_lo'],
                'ngay_san_xuat' => $row['ngay_san_xuat'],
                'han_su_dung' => $row['han_su_dung'],
                'so_luong_nhap' => (int) $row['so_luong_nhap'],
                'so_luong_con' => (int) $row['so_luong_con'],
            ],
            $list->fetchAll(PDO::FETCH_ASSOC)
        );
        Response::success(
            $expiringOnly ? 'Danh sách lô hàng sắp hết hạn' : 'Danh sách lô hàng còn tồn',
            ['batches' => $batches]
        );
    }

    public function lowStock(Request $request, array $params = []): void
    {
        $query = $this->pdo->query(
            'SELECT id AS san_pham_id, ten_san_pham, so_luong_ton, muc_ton_toi_thieu
             FROM san_pham
             WHERE so_luong_ton <= muc_ton_toi_thieu
             ORDER BY so_luong_ton ASC, id ASC'
        );
        $products = array_map(
            static fn(array $row): array => [
                'san_pham_id' => (int) $row['san_pham_id'],
                'ten_san_pham' => $row['ten_san_pham'],
                'so_luong_ton' => (int) $row['so_luong_ton'],
                'muc_ton_toi_thieu' => (int) $row['muc_ton_toi_thieu'],
            ],
            $query->fetchAll(PDO::FETCH_ASSOC)
        );
        Response::success('Danh sách sản phẩm sắp hết hàng', ['products' => $products]);
    }

    public function adjust(Request $request, array $params = []): void
    {
        $input = $request->all();
        $productId = $this->positiveInteger($input['san_pham_id'] ?? null);
        $newQuantity = $this->nonNegativeInteger($input['so_luong_moi'] ?? null);
        $reason = $input['ly_do'] ?? null;
        $reason = is_string($reason) ? trim(strip_tags($reason)) : '';
        $errors = [];
        if ($productId === null) {
            $errors['san_pham_id'] = 'san_pham_id phải là số nguyên dương';
        }
        if ($newQuantity === null || $newQuantity > self::MAX_QUANTITY) {
            $errors['so_luong_moi'] = 'so_luong_moi phải là số nguyên từ 0 đến giới hạn kho';
        }
        if ($reason === '' || mb_strlen($reason) > 255) {
            $errors['ly_do'] = 'ly_do là bắt buộc và tối đa 255 ký tự';
        }
        if ($errors !== []) {
            Response::error('Dữ liệu điều chỉnh tồn kho không hợp lệ', 422, $errors);
            return;
        }

        $this->pdo->beginTransaction();
        try {
            $productQuery = $this->pdo->prepare(
                'SELECT id, so_luong_ton FROM san_pham WHERE id = ? FOR UPDATE'
            );
            $productQuery->execute([$productId]);
            $product = $productQuery->fetch(PDO::FETCH_ASSOC);
            if ($product === false) {
                $this->pdo->rollBack();
                Response::error('Không tìm thấy sản phẩm', 404);
                return;
            }

            $oldQuantity = (int) $product['so_luong_ton'];
            $delta = $newQuantity - $oldQuantity;
            if ($delta !== 0) {
                $batchesQuery = $this->pdo->prepare(
                    'SELECT b.id, b.so_luong_con
                     FROM lo_hang b
                     WHERE b.san_pham_id = ? AND b.so_luong_con > 0
                       AND (
                           b.chi_tiet_phieu_nhap_id IS NULL
                           OR EXISTS (
                               SELECT 1
                               FROM chi_tiet_phieu_nhap d
                               JOIN phieu_nhap_kho p ON p.id = d.phieu_nhap_id
                               WHERE d.id = b.chi_tiet_phieu_nhap_id
                                 AND p.trang_thai = \'HOAN_THANH\'
                           )
                       )
                     ORDER BY (b.han_su_dung IS NULL) ASC, b.han_su_dung ASC, b.id ASC
                     FOR UPDATE'
                );
                $batchesQuery->execute([$productId]);
                $batches = $batchesQuery->fetchAll(PDO::FETCH_ASSOC);
                $batchTotal = array_sum(array_map(
                    static fn(array $batch): int => (int) $batch['so_luong_con'],
                    $batches
                ));
                if ($batchTotal !== $oldQuantity) {
                    $this->pdo->rollBack();
                    Response::error('Tồn sản phẩm và tồn các lô không nhất quán', 409, [
                        'code' => 'STOCK_BATCH_MISMATCH',
                    ]);
                    return;
                }

                if ($delta < 0) {
                    $remaining = -$delta;
                    $decreaseBatch = $this->pdo->prepare(
                        'UPDATE lo_hang
                         SET so_luong_con = so_luong_con - ?
                         WHERE id = ? AND so_luong_con >= ?'
                    );
                    foreach ($batches as $batch) {
                        if ($remaining === 0) {
                            break;
                        }
                        $available = (int) $batch['so_luong_con'];
                        $quantity = min($remaining, $available);
                        $decreaseBatch->execute([$quantity, (int) $batch['id'], $quantity]);
                        if ($decreaseBatch->rowCount() !== 1) {
                            throw new \RuntimeException('Lô hàng thay đổi trong lúc điều chỉnh tồn.');
                        }
                        $remaining -= $quantity;
                    }
                    if ($remaining !== 0) {
                        $this->pdo->rollBack();
                        Response::error('Không thể giảm tồn vượt số lượng các lô hiện có', 409);
                        return;
                    }
                } else {
                    $manufactureDate = $this->dateValue($input['ngay_san_xuat'] ?? null);
                    $expiryDate = $this->dateValue($input['han_su_dung'] ?? null);
                    $today = $this->today();
                    $dateErrors = [];
                    if ($manufactureDate === null) {
                        $dateErrors['ngay_san_xuat'] = 'ngay_san_xuat là bắt buộc theo định dạng YYYY-MM-DD';
                    } elseif ($manufactureDate > $today) {
                        $dateErrors['ngay_san_xuat'] = 'Ngày sản xuất không được ở tương lai';
                    }
                    if ($expiryDate === null) {
                        $dateErrors['han_su_dung'] = 'han_su_dung là bắt buộc theo định dạng YYYY-MM-DD';
                    } elseif (
                        $manufactureDate !== null
                        && $expiryDate <= $manufactureDate
                    ) {
                        $dateErrors['han_su_dung'] = 'Hạn sử dụng phải sau ngày sản xuất';
                    } elseif ($expiryDate <= $today) {
                        $dateErrors['han_su_dung'] = 'Hạn sử dụng phải còn hiệu lực';
                    }
                    if ($dateErrors !== []) {
                        $this->pdo->rollBack();
                        Response::error('Ngày lô điều chỉnh không hợp lệ', 422, $dateErrors);
                        return;
                    }

                    $insertBatch = $this->pdo->prepare(
                        'INSERT INTO lo_hang
                            (san_pham_id, chi_tiet_phieu_nhap_id, ngay_san_xuat, han_su_dung,
                             so_luong_nhap, so_luong_con)
                         VALUES (?, NULL, ?, ?, ?, ?)'
                    );
                    $insertBatch->execute([
                        $productId,
                        $manufactureDate,
                        $expiryDate,
                        $delta,
                        $delta,
                    ]);
                }

                $updateProduct = $this->pdo->prepare(
                    'UPDATE san_pham
                     SET so_luong_ton = ?
                     WHERE id = ? AND so_luong_ton = ?'
                );
                $updateProduct->execute([$newQuantity, $productId, $oldQuantity]);
                if ($updateProduct->rowCount() !== 1) {
                    throw new \RuntimeException('Không thể cập nhật tồn kho một cách an toàn.');
                }
            }

            $history = $this->pdo->prepare(
                'INSERT INTO lich_su_kho
                    (san_pham_id, loai_giao_dich, so_luong_thay_doi, ton_sau_giao_dich,
                     tham_chieu_loai, nguoi_thuc_hien_id, ghi_chu)
                 VALUES (?, \'DIEU_CHINH\', ?, ?, \'DIEU_CHINH\', ?, ?)'
            );
            $history->execute([
                $productId,
                $delta,
                $newQuantity,
                (int) Session::get('user_id'),
                $reason,
            ]);
            $historyId = (int) $this->pdo->lastInsertId();
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        $this->audit('stock.adjusted', 'product', $productId);
        Response::success('Đã điều chỉnh tồn kho', [
            'san_pham_id' => $productId,
            'so_luong_truoc' => $oldQuantity,
            'so_luong_moi' => $newQuantity,
            'so_luong_thay_doi' => $delta,
            'lich_su_kho_id' => $historyId,
        ]);
    }

    public function stockHistory(Request $request, array $params = []): void
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
        $productId = null;
        if (array_key_exists('product_id', $query)) {
            $productId = $this->positiveInteger($query['product_id']);
            if ($productId === null) {
                $errors['product_id'] = 'product_id phải là số nguyên dương';
            }
        }
        if ($errors !== []) {
            Response::error('Tham số lịch sử kho không hợp lệ', 422, $errors);
            return;
        }

        $where = $productId === null ? '' : ' WHERE h.san_pham_id = ?';
        $values = $productId === null ? [] : [$productId];
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM lich_su_kho h' . $where);
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $totalPages = (int) ceil($total / $perPage);
        $history = [];
        if ($page <= $totalPages) {
            $list = $this->pdo->prepare(
                'SELECT h.id, h.san_pham_id, s.ten_san_pham, h.loai_giao_dich,
                        h.so_luong_thay_doi, h.ton_sau_giao_dich, h.tham_chieu_loai,
                        h.tham_chieu_id, h.nguoi_thuc_hien_id, h.ghi_chu, h.ngay_tao
                 FROM lich_su_kho h
                 JOIN san_pham s ON s.id = h.san_pham_id' . $where . '
                 ORDER BY h.ngay_tao DESC, h.id DESC
                 LIMIT ? OFFSET ?'
            );
            foreach ($values as $index => $value) {
                $list->bindValue($index + 1, $value);
            }
            $list->bindValue(count($values) + 1, $perPage, PDO::PARAM_INT);
            $list->bindValue(count($values) + 2, ($page - 1) * $perPage, PDO::PARAM_INT);
            $list->execute();
            $history = array_map(
                static fn(array $row): array => [
                    'id' => (int) $row['id'],
                    'san_pham_id' => (int) $row['san_pham_id'],
                    'ten_san_pham' => $row['ten_san_pham'],
                    'loai_giao_dich' => $row['loai_giao_dich'],
                    'so_luong_thay_doi' => (int) $row['so_luong_thay_doi'],
                    'ton_sau_giao_dich' => (int) $row['ton_sau_giao_dich'],
                    'tham_chieu_loai' => $row['tham_chieu_loai'],
                    'tham_chieu_id' => $row['tham_chieu_id'] === null
                        ? null
                        : (int) $row['tham_chieu_id'],
                    'nguoi_thuc_hien_id' => $row['nguoi_thuc_hien_id'] === null
                        ? null
                        : (int) $row['nguoi_thuc_hien_id'],
                    'ghi_chu' => $row['ghi_chu'],
                    'ngay_tao' => $row['ngay_tao'],
                ],
                $list->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        Response::success('Lịch sử biến động kho', [
            'history' => $history,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ]);
    }

    private function validatedReceipt(array $input): array
    {
        $errors = [];
        $receiptDate = $this->dateValue($input['ngay_nhap'] ?? null);
        $today = $this->today();
        if ($receiptDate === null) {
            $errors['ngay_nhap'] = 'ngay_nhap phải theo định dạng YYYY-MM-DD';
        } elseif ($receiptDate > $today) {
            $errors['ngay_nhap'] = 'Ngày nhập không được ở tương lai';
        }

        $supplier = $input['nha_cung_cap'] ?? null;
        if ($supplier !== null && !is_string($supplier)) {
            $errors['nha_cung_cap'] = 'nha_cung_cap phải là chuỗi';
            $supplier = null;
        } elseif (is_string($supplier)) {
            $supplier = trim(strip_tags($supplier));
            if (mb_strlen($supplier) > 150) {
                $errors['nha_cung_cap'] = 'nha_cung_cap không được vượt quá 150 ký tự';
            }
            if ($supplier === '') {
                $supplier = null;
            }
        }

        $note = $input['ghi_chu'] ?? null;
        if ($note !== null && !is_string($note)) {
            $errors['ghi_chu'] = 'ghi_chu phải là chuỗi';
            $note = null;
        } elseif (is_string($note)) {
            $note = trim(strip_tags($note));
            if (mb_strlen($note) > 255) {
                $errors['ghi_chu'] = 'ghi_chu không được vượt quá 255 ký tự';
            }
            if ($note === '') {
                $note = null;
            }
        }

        $lines = $input['chi_tiet'] ?? null;
        if (!is_array($lines) || $lines === [] || count($lines) > 100) {
            $errors['chi_tiet'] = 'Phiếu nhập cần từ 1 đến 100 dòng hàng';
            $lines = [];
        }
        $validatedLines = [];
        foreach ($lines as $index => $line) {
            $prefix = 'chi_tiet[' . $index . ']';
            if (!is_array($line)) {
                $errors[$prefix] = 'Dòng hàng không hợp lệ';
                continue;
            }

            $productId = $this->positiveInteger($line['san_pham_id'] ?? null);
            if ($productId === null) {
                $errors[$prefix . '.san_pham_id'] = 'san_pham_id phải là số nguyên dương';
            }
            $quantity = $this->positiveInteger($line['so_luong'] ?? null);
            if ($quantity === null || $quantity > self::MAX_QUANTITY) {
                $errors[$prefix . '.so_luong'] = 'so_luong phải là số nguyên dương';
            }
            $cost = $this->nonNegativeInteger($line['gia_nhap'] ?? null);
            if ($cost === null || $cost > self::MAX_PRICE) {
                $errors[$prefix . '.gia_nhap'] = 'gia_nhap phải là số nguyên không âm';
            }
            $manufacture = $this->dateValue($line['ngay_san_xuat'] ?? null);
            if ($manufacture === null) {
                $errors[$prefix . '.ngay_san_xuat'] = 'ngay_san_xuat là bắt buộc theo định dạng YYYY-MM-DD';
            } elseif ($manufacture > $today) {
                $errors[$prefix . '.ngay_san_xuat'] = 'Ngày sản xuất không được ở tương lai';
            } elseif ($receiptDate !== null && $manufacture > $receiptDate) {
                $errors[$prefix . '.ngay_san_xuat'] = 'Ngày sản xuất không được sau ngày nhập';
            }
            $expiry = $this->dateValue($line['han_su_dung'] ?? null);
            if ($expiry === null) {
                $errors[$prefix . '.han_su_dung'] = 'han_su_dung phải theo định dạng YYYY-MM-DD';
            } elseif ($manufacture !== null && $expiry <= $manufacture) {
                $errors[$prefix . '.han_su_dung'] = 'Hạn sử dụng phải sau ngày sản xuất';
            } elseif ($expiry <= $today || ($receiptDate !== null && $expiry <= $receiptDate)) {
                $errors[$prefix . '.han_su_dung'] = 'Hạn sử dụng phải sau ngày nhập và chưa hết hạn';
            }
            $lotNumber = $line['so_lo'] ?? null;
            $lotNumber = is_string($lotNumber) ? trim(strip_tags($lotNumber)) : '';
            if ($lotNumber === '' || mb_strlen($lotNumber) > 100) {
                $errors[$prefix . '.so_lo'] = 'so_lo là bắt buộc và tối đa 100 ký tự';
            }

            if (
                $productId !== null
                && $quantity !== null
                && $quantity <= self::MAX_QUANTITY
                && $cost !== null
                && $cost <= self::MAX_PRICE
                && $manufacture !== null
                && $manufacture <= $today
                && $expiry !== null
                && $lotNumber !== ''
                && mb_strlen($lotNumber) <= 100
            ) {
                $validatedLines[] = [
                    'san_pham_id' => $productId,
                    'so_luong' => $quantity,
                    'gia_nhap' => $cost,
                    'ngay_san_xuat' => $manufacture,
                    'han_su_dung' => $expiry,
                    'so_lo' => $lotNumber,
                ];
            }
        }

        return $errors === []
            ? [
                'ngay_nhap' => $receiptDate,
                'nha_cung_cap' => $supplier,
                'ghi_chu' => $note,
                'lines' => $validatedLines,
            ]
            : ['errors' => $errors];
    }

    private function optionalDate(mixed $value, string $field, array &$errors): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $date = $this->dateValue($value);
        if ($date === null) {
            $errors[$field] = $field . ' phải theo định dạng YYYY-MM-DD';
        }
        return $date;
    }

    private function dateValue(mixed $value): ?string
    {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = DateTimeImmutable::getLastErrors();
        if (
            $date === false
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $date->format('Y-m-d') !== $value
        ) {
            return null;
        }
        return $value;
    }

    private function today(): string
    {
        return (new DateTimeImmutable('now', new \DateTimeZone('Asia/Ho_Chi_Minh')))
            ->format('Y-m-d');
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

    private function booleanInteger(mixed $value): ?int
    {
        if ($value === 1 || $value === '1' || $value === true) {
            return 1;
        }
        if ($value === 0 || $value === '0' || $value === false) {
            return 0;
        }
        return null;
    }

    private function audit(string $action, string $entity, int $id): void
    {
        \Logger::write(
            'admin_audit.log',
            'admin_id=' . (int) Session::get('user_id') . ' action=' . $action
                . ' entity=' . $entity . ' entity_id=' . $id
        );
    }
}
