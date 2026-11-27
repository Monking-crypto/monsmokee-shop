<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use PDO;
use PDOException;
use Logger;
use App\Services\ProductImageService;
use InvalidArgumentException;
use Request;
use Response;
use RuntimeException;
use Session;
use Throwable;

final class ProductAdminController
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 50;
    private const MAX_IMAGE_BYTES = 2097152;
    private const MAX_PRICE = 999999999;

    public function __construct(
        private PDO $pdo,
        private ProductImageService $imageService,
        private array $businessConfig = []
    )
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

        $categoryId = null;
        if (array_key_exists('category_id', $query)) {
            $categoryId = $this->positiveInteger($query['category_id']);
            if ($categoryId === null) {
                $errors['category_id'] = 'category_id phải là số nguyên dương';
            }
        }
        $status = null;
        if (array_key_exists('trang_thai', $query)) {
            $status = $this->visibilityValue($query['trang_thai']);
            if ($status === null) {
                $errors['trang_thai'] = 'trang_thai phải là 0 hoặc 1';
            }
        }
        $search = $query['q'] ?? '';
        if (!is_string($search)) {
            $errors['q'] = 'q phải là chuỗi';
            $search = '';
        } else {
            $search = trim($search);
            if (mb_strlen($search) > 100) {
                $errors['q'] = 'q không được vượt quá 100 ký tự';
            }
        }
        if ($errors !== []) {
            Response::error('Tham số lọc sản phẩm không hợp lệ', 422, $errors);
            return;
        }

        $conditions = [];
        $values = [];
        if ($categoryId !== null) {
            $conditions[] = 's.danh_muc_id = ?';
            $values[] = $categoryId;
        }
        if ($status !== null) {
            $conditions[] = 's.trang_thai = ?';
            $values[] = $status;
        }
        if ($search !== '') {
            $conditions[] = '(s.ten_san_pham LIKE ? OR s.ten_khong_dau LIKE ?)';
            $searchTerm = '%' . $search . '%';
            $values[] = $searchTerm;
            $values[] = $searchTerm;
        }
        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM san_pham s' . $where);
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $totalPages = (int) ceil($total / $perPage);
        $products = [];

        if ($page <= $totalPages) {
            $offset = ($page - 1) * $perPage;
            $list = $this->pdo->prepare(
                'SELECT s.id, s.danh_muc_id, s.ten_san_pham, s.ten_khong_dau,
                        s.mo_ta, s.hinh_anh, s.don_vi_tinh, s.gia_ban,
                        s.so_luong_ton, s.muc_ton_toi_thieu, s.trang_thai,
                        s.giam_can_han, s.phan_tram_giam_can_han, s.luot_ban,
                        s.ngay_tao, s.ngay_cap_nhat, d.ten_danh_muc
                 FROM san_pham s
                 JOIN danh_muc d ON d.id = s.danh_muc_id' . $where . '
                 ORDER BY s.ngay_tao DESC, s.id DESC
                 LIMIT ? OFFSET ?'
            );
            foreach ($values as $index => $value) {
                $list->bindValue($index + 1, $value);
            }
            $list->bindValue(count($values) + 1, $perPage, PDO::PARAM_INT);
            $list->bindValue(count($values) + 2, $offset, PDO::PARAM_INT);
            $list->execute();
            $products = array_map(
                fn(array $row): array => $this->mapProduct($row),
                $list->fetchAll(PDO::FETCH_ASSOC)
            );
        }

        Response::success('Danh sách sản phẩm quản trị', [
            'products' => $products,
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
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }
        $query = $this->pdo->prepare(
            'SELECT s.id, s.danh_muc_id, s.ten_san_pham, s.ten_khong_dau,
                    s.mo_ta, s.hinh_anh, s.don_vi_tinh, s.gia_ban,
                    s.so_luong_ton, s.muc_ton_toi_thieu, s.trang_thai,
                    s.giam_can_han, s.phan_tram_giam_can_han, s.luot_ban,
                    s.ngay_tao, s.ngay_cap_nhat, d.ten_danh_muc
             FROM san_pham s
             JOIN danh_muc d ON d.id = s.danh_muc_id
             WHERE s.id = ?
             LIMIT 1'
        );
        $query->execute([$id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }

        $batchQuery = $this->pdo->prepare(
            'SELECT id, chi_tiet_phieu_nhap_id, ngay_san_xuat,
                    han_su_dung, so_luong_nhap, so_luong_con
             FROM lo_hang
             WHERE san_pham_id = ? AND so_luong_con > 0
               AND (
                   chi_tiet_phieu_nhap_id IS NULL
                   OR EXISTS (
                       SELECT 1
                       FROM chi_tiet_phieu_nhap d
                       JOIN phieu_nhap_kho p ON p.id = d.phieu_nhap_id
                       WHERE d.id = lo_hang.chi_tiet_phieu_nhap_id
                         AND p.trang_thai = \'HOAN_THANH\'
                   )
               )
             ORDER BY han_su_dung ASC, id ASC'
        );
        $batchQuery->execute([$id]);
        $batches = array_map(
            static fn(array $batch): array => [
                'id' => (int) $batch['id'],
                'chi_tiet_phieu_nhap_id' => $batch['chi_tiet_phieu_nhap_id'] === null
                    ? null
                    : (int) $batch['chi_tiet_phieu_nhap_id'],
                'ngay_san_xuat' => $batch['ngay_san_xuat'],
                'han_su_dung' => $batch['han_su_dung'],
                'so_luong_nhap' => (int) $batch['so_luong_nhap'],
                'so_luong_con' => (int) $batch['so_luong_con'],
            ],
            $batchQuery->fetchAll(PDO::FETCH_ASSOC)
        );
        $product = $this->mapProduct($row);
        $product['tong_ton_kho'] = $product['so_luong_ton'];
        $product['han_su_dung_gan_nhat'] = $batches[0]['han_su_dung'] ?? null;
        $product['lo_hang'] = $batches;
        Response::success('Chi tiết sản phẩm quản trị', ['product' => $product]);
    }

    public function create(Request $request, array $params = []): void
    {
        $input = $this->validatedInput($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu sản phẩm không hợp lệ', 422, $input['errors']);
            return;
        }
        if (!$this->categoryExists($input['danh_muc_id'])) {
            Response::error('Danh mục không tồn tại', 422, [
                'danh_muc_id' => 'Chọn một danh mục đang có',
            ]);
            return;
        }

        $insert = $this->pdo->prepare(
            'INSERT INTO san_pham
                (danh_muc_id, ten_san_pham, ten_khong_dau, mo_ta, don_vi_tinh,
                gia_ban, hinh_anh, so_luong_ton, muc_ton_toi_thieu, trang_thai)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1)'
        );
        $insert->execute([
            $input['danh_muc_id'],
            $input['ten'],
            $this->normalizeKeyword($input['ten']),
            $input['mo_ta'],
            $input['don_vi_tinh'],
            $input['gia'],
            $input['anh'],
            $input['muc_ton_toi_thieu']
                ?? max(0, (int) ($this->businessConfig['stock']['low_stock_threshold_default'] ?? 10)),
        ]);
        $id = (int) $this->pdo->lastInsertId();
        $this->audit('product.created', $id);
        Response::success('Đã tạo sản phẩm', ['id' => $id], 201);
    }

    public function update(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null || !$this->productExists($id)) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }
        $input = $this->validatedInput($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu sản phẩm không hợp lệ', 422, $input['errors']);
            return;
        }
        if (!$this->categoryExists($input['danh_muc_id'])) {
            Response::error('Danh mục không tồn tại', 422, [
                'danh_muc_id' => 'Chọn một danh mục đang có',
            ]);
            return;
        }

        $image = $input['anh'];
        if (!array_key_exists('anh', $request->all())) {
            $currentImage = $this->pdo->prepare('SELECT hinh_anh FROM san_pham WHERE id = ?');
            $currentImage->execute([$id]);
            $image = $currentImage->fetchColumn();
        }
        $thresholdSql = $input['muc_ton_toi_thieu'] === null
            ? ''
            : ', muc_ton_toi_thieu = ?';
        $update = $this->pdo->prepare(
            'UPDATE san_pham
             SET danh_muc_id = ?, ten_san_pham = ?, ten_khong_dau = ?,
                 mo_ta = ?, don_vi_tinh = ?, gia_ban = ?, hinh_anh = ?'
                 . $thresholdSql . '
             WHERE id = ?'
        );
        $values = [
            $input['danh_muc_id'],
            $input['ten'],
            $this->normalizeKeyword($input['ten']),
            $input['mo_ta'],
            $input['don_vi_tinh'],
            $input['gia'],
            $image,
        ];
        if ($input['muc_ton_toi_thieu'] !== null) {
            $values[] = $input['muc_ton_toi_thieu'];
        }
        $values[] = $id;
        $update->execute($values);
        $this->audit('product.updated', $id);
        Response::success('Đã cập nhật sản phẩm', ['id' => $id]);
    }

    public function updateCrossSell(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null || !$this->productExists($id)) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }
        $input = $request->all();
        $ids = $input['san_pham_ids'] ?? null;
        $errors = [];
        if (!is_array($ids) || count($ids) > 8) {
            $errors['san_pham_ids'] = 'san_pham_ids phải là mảng tối đa 8 sản phẩm';
            $ids = [];
        }
        $validatedIds = [];
        foreach ($ids as $index => $candidateId) {
            $candidateId = $this->positiveJsonInteger($candidateId);
            if ($candidateId === null || $candidateId === $id) {
                $errors['san_pham_ids.' . $index] = 'Mỗi ID phải là số nguyên dương khác sản phẩm hiện tại';
                continue;
            }
            if (in_array($candidateId, $validatedIds, true)) {
                $errors['san_pham_ids.' . $index] = 'Không được lặp sản phẩm gợi ý';
                continue;
            }
            $validatedIds[] = $candidateId;
        }
        if ($errors !== []) {
            Response::error('Danh sách sản phẩm mua kèm không hợp lệ', 422, $errors);
            return;
        }

        $this->pdo->beginTransaction();
        try {
            if ($validatedIds !== []) {
                $placeholders = implode(',', array_fill(0, count($validatedIds), '?'));
                $exists = $this->pdo->prepare(
                    'SELECT id FROM san_pham WHERE id IN (' . $placeholders . ')'
                );
                $exists->execute($validatedIds);
                $foundIds = array_map('intval', $exists->fetchAll(PDO::FETCH_COLUMN));
                if (count($foundIds) !== count($validatedIds)) {
                    $this->pdo->rollBack();
                    Response::error('Có sản phẩm gợi ý không tồn tại', 422, [
                        'san_pham_ids' => 'Kiểm tra lại các ID sản phẩm',
                    ]);
                    return;
                }
            }

            $delete = $this->pdo->prepare(
                'DELETE FROM san_pham_mua_kem WHERE san_pham_id = ?'
            );
            $delete->execute([$id]);
            $insert = $this->pdo->prepare(
                'INSERT INTO san_pham_mua_kem (san_pham_id, san_pham_goi_y_id) VALUES (?, ?)'
            );
            foreach ($validatedIds as $candidateId) {
                $insert->execute([$id, $candidateId]);
            }
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        $this->audit('product.cross_sell_updated', $id);
        Response::success('Đã cập nhật sản phẩm mua kèm', [
            'san_pham_id' => $id,
            'san_pham_ids' => $validatedIds,
        ]);
    }

    public function updateVisibility(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null || !$this->productExists($id)) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }
        $visible = $this->visibilityValue($request->input('trang_thai'));
        if ($visible === null) {
            Response::error('Dữ liệu trạng thái không hợp lệ', 422, [
                'trang_thai' => 'trang_thai phải là 0 hoặc 1',
            ]);
            return;
        }
        $update = $this->pdo->prepare('UPDATE san_pham SET trang_thai = ? WHERE id = ?');
        $update->execute([$visible, $id]);
        $this->audit($visible === 1 ? 'product.shown' : 'product.hidden', $id);
        Response::success('Đã cập nhật trạng thái sản phẩm', [
            'id' => $id,
            'trang_thai' => $visible,
        ]);
    }

    public function delete(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }

        $this->pdo->beginTransaction();
        try {
            $find = $this->pdo->prepare(
                'SELECT id, hinh_anh FROM san_pham WHERE id = ? FOR UPDATE'
            );
            $find->execute([$id]);
            $product = $find->fetch(PDO::FETCH_ASSOC);
            if ($product === false) {
                $this->pdo->rollBack();
                Response::error('Không tìm thấy sản phẩm', 404);
                return;
            }

            if ($this->hasHistoricalUse($id)) {
                $this->pdo->rollBack();
                Response::error(
                    'Sản phẩm đã có lịch sử nên không thể xóa; hãy dùng chức năng Ẩn để ngừng bán',
                    409,
                    ['code' => 'PRODUCT_HAS_HISTORY']
                );
                return;
            }

            $this->deleteNonHistoricalReferences($id);
            $delete = $this->pdo->prepare('DELETE FROM san_pham WHERE id = ?');
            $delete->execute([$id]);
            $this->pdo->commit();
        } catch (PDOException $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            if ($error->getCode() === '23000') {
                Response::error(
                    'Sản phẩm đã có lịch sử nên không thể xóa; hãy dùng chức năng Ẩn để ngừng bán',
                    409,
                    ['code' => 'PRODUCT_HAS_HISTORY']
                );
                return;
            }
            throw $error;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        $this->removeStoredImage($product['hinh_anh']);
        $this->audit('product.deleted', $id);
        Response::success('Đã xóa sản phẩm', ['id' => $id, 'deleted' => true]);
    }

    public function uploadImage(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null || !$this->productExists($id)) {
            Response::error('Không tìm thấy sản phẩm', 404);
            return;
        }
        $file = $_FILES['image'] ?? null;
        if (!is_array($file) || !isset($file['error'], $file['size'], $file['tmp_name'])) {
            Response::error('Thiếu tệp ảnh', 422, ['image' => 'Gửi ảnh trong trường image']);
            return;
        }
        if ((int) $file['error'] !== UPLOAD_ERR_OK) {
            $status = (int) $file['error'] === UPLOAD_ERR_INI_SIZE
                || (int) $file['error'] === UPLOAD_ERR_FORM_SIZE
                ? 413
                : 422;
            Response::error('Không thể nhận tệp ảnh', $status, [
                'image' => 'Tải lên thất bại hoặc tệp vượt giới hạn máy chủ',
            ]);
            return;
        }
        if ((int) $file['size'] < 1 || (int) $file['size'] > self::MAX_IMAGE_BYTES) {
            Response::error('Kích thước ảnh không hợp lệ', 422, [
                'image' => 'Ảnh phải lớn hơn 0 và không vượt quá 2 MB',
            ]);
            return;
        }
        if (!is_uploaded_file((string) $file['tmp_name'])) {
            Response::error('Tệp tải lên không hợp lệ', 422, ['image' => 'Tệp ảnh không hợp lệ']);
            return;
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file((string) $file['tmp_name']);
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];
        if (!is_string($mime) || !isset($extensions[$mime])) {
            Response::error('Định dạng ảnh không được hỗ trợ', 422, [
                'image' => 'Chỉ chấp nhận JPEG, PNG hoặc WebP',
            ]);
            return;
        }
        if (@getimagesize((string) $file['tmp_name']) === false) {
            Response::error('Tệp ảnh không hợp lệ', 422, ['image' => 'Không đọc được dữ liệu ảnh']);
            return;
        }
        $gdAvailable = ProductImageService::isGdAvailable();
        $directory = dirname(__DIR__, 3) . '/uploads/products';
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new RuntimeException('Không thể tạo thư mục lưu ảnh sản phẩm.');
        }
        $randomName = bin2hex(random_bytes(16));
        $generated = null;
        $finalMainPath = null;
        $finalThumbnailPath = null;
        $relativePath = '';
        $relativeThumbnailPath = null;
        try {
            if ($gdAvailable) {
                $temporaryPrefix = $directory . '/.tmp-' . $randomName;
                $generated = $this->imageService->createVariants(
                    (string) $file['tmp_name'],
                    $mime,
                    $temporaryPrefix
                );
                $mainFilename = $randomName . '.' . $generated['extension'];
                $thumbnailFilename = $randomName . '_thumb.' . $generated['extension'];
                $finalThumbnailPath = $directory . '/' . $thumbnailFilename;
                $relativeThumbnailPath = 'uploads/products/' . $thumbnailFilename;
            } else {
                $mainFilename = $randomName . '_original.' . $extensions[$mime];
            }
            $finalMainPath = $directory . '/' . $mainFilename;
            $relativePath = 'uploads/products/' . $mainFilename;
            if ($gdAvailable) {
                if (
                    !rename($generated['main_path'], $finalMainPath)
                    || !rename($generated['thumbnail_path'], (string) $finalThumbnailPath)
                ) {
                    throw new RuntimeException('Không thể công bố các biến thể ảnh sản phẩm.');
                }
            } elseif (!move_uploaded_file((string) $file['tmp_name'], $finalMainPath)) {
                throw new RuntimeException('Không thể lưu ảnh sản phẩm gốc.');
            }

            $find = $this->pdo->prepare('SELECT hinh_anh FROM san_pham WHERE id = ?');
            $find->execute([$id]);
            $oldImage = $find->fetchColumn();
            if ($oldImage === false) {
                throw new RuntimeException('Sản phẩm không còn tồn tại.');
            }
            $update = $this->pdo->prepare('UPDATE san_pham SET hinh_anh = ? WHERE id = ?');
            $update->execute([$relativePath, $id]);
        } catch (Throwable $error) {
            $cleanupPaths = [
                $generated['main_path'] ?? null,
                $generated['thumbnail_path'] ?? null,
                $finalMainPath,
                $finalThumbnailPath,
            ];
            foreach ($cleanupPaths as $cleanupPath) {
                if (is_string($cleanupPath) && is_file($cleanupPath) && !unlink($cleanupPath)) {
                    Logger::error('Không thể dọn ảnh tải lên sau lỗi lưu CSDL; product_id=' . $id);
                }
            }
            if ($error instanceof InvalidArgumentException) {
                Response::error('Tệp ảnh không hợp lệ hoặc không thể giải mã', 422, [
                    'image' => 'Hãy tải lên ảnh JPEG, PNG hoặc WebP hợp lệ',
                ]);
                return;
            }
            throw $error;
        }

        if (!$gdAvailable) {
            Logger::write(
                'app.log',
                'WARNING: Product image saved without GD normalization or thumbnail; product_id=' . $id
            );
        }
        $this->removeStoredImage($oldImage);
        $this->audit('product.image_uploaded', $id);
        $responseData = [
            'id' => $id,
            'anh' => $relativePath,
            'anh_thumb' => $relativeThumbnailPath,
            'url' => $this->publicImageUrl((string) $relativePath),
            'thumb_url' => $relativeThumbnailPath === null
                ? null
                : $this->publicImageUrl($relativeThumbnailPath),
        ];
        if (!$gdAvailable) {
            $responseData['warning'] = 'Ảnh được lưu nguyên bản; chưa tạo thumbnail vì GD chưa bật.';
        }
        Response::success(
            $gdAvailable ? 'Đã cập nhật ảnh sản phẩm' : 'Đã lưu ảnh sản phẩm nguyên bản',
            $responseData
        );
    }

    private function validatedInput(array $input): array
    {
        $errors = [];
        foreach ([
            'ten_san_pham',
            'gia_ban',
            'hinh_anh',
            'nhom_con',
            'huong_vi',
            'dong_goi',
        ] as $unsupportedField) {
            if (array_key_exists($unsupportedField, $input)) {
                $errors[$unsupportedField] = 'Trường này không còn được API quản trị hỗ trợ';
            }
        }

        $name = $input['ten'] ?? null;
        $name = is_string($name) ? trim(strip_tags($name)) : '';
        if ($name === '' || mb_strlen($name) > 200) {
            $errors['ten'] = 'Tên sản phẩm là bắt buộc và tối đa 200 ký tự';
        }

        $categoryId = $this->positiveInteger($input['danh_muc_id'] ?? null);
        if ($categoryId === null) {
            $errors['danh_muc_id'] = 'danh_muc_id phải là số nguyên dương';
        }
        $price = $this->positiveJsonInteger($input['gia'] ?? null);
        if ($price === null || $price > self::MAX_PRICE) {
            $errors['gia'] = 'gia phải là số nguyên JSON dương, tối đa 999999999 VND';
            $price = null;
        }

        $unit = $input['don_vi_tinh'] ?? null;
        $unit = is_string($unit) ? trim(strip_tags($unit)) : '';
        if ($unit === '' || mb_strlen($unit) > 30) {
            $errors['don_vi_tinh'] = 'Đơn vị tính là bắt buộc và tối đa 30 ký tự';
        }
        $description = $input['mo_ta'] ?? null;
        if ($description !== null && !is_string($description)) {
            $errors['mo_ta'] = 'mo_ta phải là chuỗi';
            $description = null;
        } elseif (is_string($description)) {
            $description = trim(strip_tags($description));
            if (mb_strlen($description) > 10000) {
                $errors['mo_ta'] = 'mo_ta không được vượt quá 10000 ký tự';
            }
            if ($description === '') {
                $description = null;
            }
        }
        $image = $input['anh'] ?? null;
        if (
            $image !== null
            && (
                !is_string($image)
                || (
                    $image !== 'placeholder-product.svg'
                    && preg_match(
                        '#\Auploads/products/[a-f0-9]{32}\.(?:jpg|png|webp)\z#',
                        $image
                    ) !== 1
                )
            )
        ) {
            $errors['anh'] = 'anh phải là đường dẫn ảnh tải lên hợp lệ hoặc null';
            $image = null;
        }
        $minimumStock = null;
        if (array_key_exists('muc_ton_toi_thieu', $input)) {
            $minimumStock = $this->nonNegativeJsonInteger($input['muc_ton_toi_thieu']);
            if ($minimumStock === null || $minimumStock > 2147483647) {
                $errors['muc_ton_toi_thieu'] = 'muc_ton_toi_thieu phải là số nguyên JSON từ 0 đến giới hạn kho';
                $minimumStock = null;
            }
        }

        return $errors === []
            ? [
                'ten' => $name,
                'danh_muc_id' => $categoryId,
                'gia' => $price,
                'don_vi_tinh' => $unit,
                'mo_ta' => $description,
                'anh' => $image,
                'muc_ton_toi_thieu' => $minimumStock,
            ]
            : ['errors' => $errors];
    }

    private function hasHistoricalUse(int $id): bool
    {
        foreach ([
            'chi_tiet_don_hang',
            'chi_tiet_phieu_nhap',
            'lo_hang',
            'lich_su_kho',
            'gio_hang',
        ] as $table) {
            $query = $this->pdo->prepare(
                'SELECT 1 FROM ' . $table . ' WHERE san_pham_id = ? LIMIT 1'
            );
            $query->execute([$id]);
            if ($query->fetchColumn() !== false) {
                return true;
            }
        }
        return false;
    }

    private function deleteNonHistoricalReferences(int $id): void
    {
        $statements = [
            'DELETE FROM gio_hang WHERE san_pham_id = ?',
            'DELETE FROM san_pham_mua_kem WHERE san_pham_id = ? OR san_pham_goi_y_id = ?',
            'DELETE FROM khuyen_mai_san_pham WHERE san_pham_id = ?',
            'DELETE FROM danh_gia WHERE san_pham_id = ?',
        ];
        foreach ($statements as $sql) {
            $query = $this->pdo->prepare($sql);
            $sql === $statements[1]
                ? $query->execute([$id, $id])
                : $query->execute([$id]);
        }
    }

    private function categoryExists(int $id): bool
    {
        $query = $this->pdo->prepare('SELECT 1 FROM danh_muc WHERE id = ?');
        $query->execute([$id]);
        return $query->fetchColumn() !== false;
    }

    private function productExists(int $id): bool
    {
        $query = $this->pdo->prepare('SELECT 1 FROM san_pham WHERE id = ?');
        $query->execute([$id]);
        return $query->fetchColumn() !== false;
    }

    private function removeStoredImage(mixed $relativePath): void
    {
        if (
            !is_string($relativePath)
            || preg_match(
                '#\Auploads/products/([a-f0-9]{32})(_original)?\.(jpg|png|webp)\z#',
                $relativePath,
                $matches
            ) !== 1
        ) {
            return;
        }
        $directory = dirname(__DIR__, 3) . '/uploads/products/';
        $paths = [$directory . $matches[1] . ($matches[2] ?? '') . '.' . $matches[3]];
        if (($matches[2] ?? '') !== '_original') {
            $paths[] = $directory . $matches[1] . '_thumb.' . $matches[3];
        }
        foreach ($paths as $path) {
            if (is_file($path) && !unlink($path)) {
                Logger::error('Không thể xóa ảnh sản phẩm cũ; path=' . basename($path));
            }
        }
    }

    private function publicImageUrl(string $relativePath): string
    {
        $appConfig = require dirname(__DIR__, 3) . '/config/app.php';
        return rtrim((string) $appConfig['url'], '/') . '/backend/' . $relativePath;
    }

    private function normalizeKeyword(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($ascii === false) {
            return strtolower($value);
        }
        $normalized = strtolower($ascii);
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $normalized) ?? '';
        return trim($normalized);
    }

    private function audit(string $action, int $id): void
    {
        Logger::write(
            'admin_audit.log',
            'admin_id=' . (int) Session::get('user_id') . ' action=' . $action
                . ' entity=product entity_id=' . $id
        );
    }

    private function mapProduct(array $row): array
    {
        $image = $row['hinh_anh'];
        return [
            'id' => (int) $row['id'],
            'danh_muc_id' => (int) $row['danh_muc_id'],
            'ten_danh_muc' => $row['ten_danh_muc'],
            'ten' => $row['ten_san_pham'],
            'gia' => (int) $row['gia_ban'],
            'don_vi_tinh' => $row['don_vi_tinh'],
            'mo_ta' => $row['mo_ta'],
            'anh' => $image,
            'anh_thumb' => $this->imageService->cardImagePath($image),
            'so_luong_ton' => (int) $row['so_luong_ton'],
            'muc_ton_toi_thieu' => (int) $row['muc_ton_toi_thieu'],
            'trang_thai' => (int) $row['trang_thai'],
        ];
    }

    private function positiveJsonInteger(mixed $value): ?int
    {
        return is_int($value) && $value > 0 ? $value : null;
    }

    private function nonNegativeJsonInteger(mixed $value): ?int
    {
        return is_int($value) && $value >= 0 ? $value : null;
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
