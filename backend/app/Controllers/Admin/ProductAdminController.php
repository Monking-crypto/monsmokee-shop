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

final class ProductAdminController
{
    private const DEFAULT_PER_PAGE = 20;
    private const MAX_PER_PAGE = 50;
    private const MAX_IMAGE_BYTES = 2097152;
    private const MAX_PRICE = 999999999999;

    public function __construct(private PDO $pdo)
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
                static fn(array $row): array => self::mapProduct($row),
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

        Response::success('Chi tiết sản phẩm quản trị', [
            'product' => self::mapProduct($row),
        ]);
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
                 gia_ban, so_luong_ton, trang_thai)
             VALUES (?, ?, ?, ?, ?, ?, 0, 1)'
        );
        $insert->execute([
            $input['danh_muc_id'],
            $input['ten_san_pham'],
            $this->normalizeKeyword($input['ten_san_pham']),
            $input['mo_ta'],
            $input['don_vi_tinh'],
            $input['gia_ban'],
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

        $update = $this->pdo->prepare(
            'UPDATE san_pham
             SET danh_muc_id = ?, ten_san_pham = ?, ten_khong_dau = ?,
                 mo_ta = ?, don_vi_tinh = ?, gia_ban = ?
             WHERE id = ?'
        );
        $update->execute([
            $input['danh_muc_id'],
            $input['ten_san_pham'],
            $this->normalizeKeyword($input['ten_san_pham']),
            $input['mo_ta'],
            $input['don_vi_tinh'],
            $input['gia_ban'],
            $id,
        ]);
        $this->audit('product.updated', $id);
        Response::success('Đã cập nhật sản phẩm', ['id' => $id]);
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
                $hide = $this->pdo->prepare(
                    'UPDATE san_pham SET trang_thai = 0 WHERE id = ?'
                );
                $hide->execute([$id]);
                $this->pdo->commit();
                $this->audit('product.deleted_hidden_historical', $id);
                Response::success('Sản phẩm đã có giao dịch nên được ẩn thay vì xóa', [
                    'id' => $id,
                    'deleted' => false,
                    'trang_thai' => 0,
                ]);
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
                    'Sản phẩm có dữ liệu liên quan và không thể xóa an toàn; hãy ẩn sản phẩm',
                    409
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

        $directory = dirname(__DIR__, 3) . '/uploads/products';
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            throw new RuntimeException('Không thể tạo thư mục lưu ảnh sản phẩm.');
        }
        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        $absolutePath = $directory . '/' . $filename;
        if (!move_uploaded_file((string) $file['tmp_name'], $absolutePath)) {
            throw new RuntimeException('Không thể lưu ảnh sản phẩm.');
        }
        $relativePath = 'uploads/products/' . $filename;

        try {
            $find = $this->pdo->prepare('SELECT hinh_anh FROM san_pham WHERE id = ?');
            $find->execute([$id]);
            $oldImage = $find->fetchColumn();
            if ($oldImage === false) {
                throw new RuntimeException('Sản phẩm không còn tồn tại.');
            }
            $update = $this->pdo->prepare('UPDATE san_pham SET hinh_anh = ? WHERE id = ?');
            $update->execute([$relativePath, $id]);
        } catch (Throwable $error) {
            if (is_file($absolutePath) && !unlink($absolutePath)) {
                Logger::error('Không thể dọn ảnh tải lên sau lỗi lưu CSDL; product_id=' . $id);
            }
            throw $error;
        }

        $this->removeStoredImage($oldImage);
        $this->audit('product.image_uploaded', $id);
        Response::success('Đã cập nhật ảnh sản phẩm', [
            'id' => $id,
            'hinh_anh' => $relativePath,
            'url' => $this->publicImageUrl($relativePath),
        ]);
    }

    private function validatedInput(array $input): array
    {
        $errors = [];
        $name = $input['ten_san_pham'] ?? null;
        $name = is_string($name) ? trim(strip_tags($name)) : '';
        if ($name === '' || mb_strlen($name) > 200) {
            $errors['ten_san_pham'] = 'Tên sản phẩm là bắt buộc và tối đa 200 ký tự';
        }

        $categoryId = $this->positiveInteger($input['danh_muc_id'] ?? null);
        if ($categoryId === null) {
            $errors['danh_muc_id'] = 'danh_muc_id phải là số nguyên dương';
        }
        $price = $this->positiveInteger($input['gia_ban'] ?? null);
        if ($price === null || $price > self::MAX_PRICE) {
            $errors['gia_ban'] = 'gia_ban phải là số nguyên VND dương';
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

        return $errors === []
            ? [
                'ten_san_pham' => $name,
                'danh_muc_id' => $categoryId,
                'gia_ban' => $price,
                'don_vi_tinh' => $unit,
                'mo_ta' => $description,
            ]
            : ['errors' => $errors];
    }

    private function hasHistoricalUse(int $id): bool
    {
        foreach (['chi_tiet_don_hang', 'chi_tiet_phieu_nhap'] as $table) {
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
            || !preg_match('#\Auploads/products/[a-f0-9]{32}\.(?:jpg|png|webp)\z#', $relativePath)
        ) {
            return;
        }
        $path = dirname(__DIR__, 3) . '/' . $relativePath;
        if (is_file($path) && !unlink($path)) {
            Logger::error('Không thể xóa ảnh sản phẩm cũ; path=' . basename($path));
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

    private static function mapProduct(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'danh_muc_id' => (int) $row['danh_muc_id'],
            'ten_danh_muc' => $row['ten_danh_muc'],
            'ten_san_pham' => $row['ten_san_pham'],
            'ten_khong_dau' => $row['ten_khong_dau'],
            'mo_ta' => $row['mo_ta'],
            'hinh_anh' => $row['hinh_anh'],
            'don_vi_tinh' => $row['don_vi_tinh'],
            'gia_ban' => (int) $row['gia_ban'],
            'so_luong_ton' => (int) $row['so_luong_ton'],
            'muc_ton_toi_thieu' => (int) $row['muc_ton_toi_thieu'],
            'trang_thai' => (int) $row['trang_thai'],
            'giam_can_han' => (bool) $row['giam_can_han'],
            'phan_tram_giam_can_han' => (int) $row['phan_tram_giam_can_han'],
            'luot_ban' => (int) $row['luot_ban'],
            'ngay_tao' => $row['ngay_tao'],
            'ngay_cap_nhat' => $row['ngay_cap_nhat'],
        ];
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
