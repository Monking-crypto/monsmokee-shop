<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use PDO;
use PDOException;
use Logger;
use Request;
use Response;
use Session;

final class CategoryAdminController
{
    private const DEFAULT_ICON = 'box';

    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request, array $params = []): void
    {
        $query = $this->pdo->query(
            'SELECT id, ten_danh_muc, slug, icon, thu_tu, trang_thai
             FROM danh_muc
             ORDER BY thu_tu ASC, ten_danh_muc ASC, id ASC'
        );
        $categories = array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'ten_danh_muc' => $row['ten_danh_muc'],
                'slug' => $row['slug'],
                'icon' => $row['icon'],
                'thu_tu' => (int) $row['thu_tu'],
                'trang_thai' => (int) $row['trang_thai'],
            ],
            $query->fetchAll(PDO::FETCH_ASSOC)
        );

        Response::success('Danh sách danh mục', ['categories' => $categories]);
    }

    public function create(Request $request, array $params = []): void
    {
        $input = $this->validatedInput($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu danh mục không hợp lệ', 422, $input['errors']);
            return;
        }

        $slug = $this->uniqueSlug($input['ten_danh_muc']);
        if ($slug === '') {
            Response::error('Không thể tạo slug từ tên danh mục', 422, [
                'ten_danh_muc' => 'Tên danh mục cần có ký tự chữ hoặc số',
            ]);
            return;
        }

        try {
            $insert = $this->pdo->prepare(
                'INSERT INTO danh_muc (ten_danh_muc, slug, icon, thu_tu)
                 VALUES (?, ?, ?, ?)'
            );
            $insert->execute([
                $input['ten_danh_muc'],
                $slug,
                $input['icon'],
                $input['thu_tu'],
            ]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                Response::error('Tên danh mục đã tồn tại', 409);
                return;
            }
            throw $error;
        }

        $id = (int) $this->pdo->lastInsertId();
        $this->audit('category.created', $id);
        Response::success('Đã tạo danh mục', ['id' => $id], 201);
    }

    public function update(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy danh mục', 404);
            return;
        }
        $currentQuery = $this->pdo->prepare('SELECT id FROM danh_muc WHERE id = ?');
        $currentQuery->execute([$id]);
        if ($currentQuery->fetchColumn() === false) {
            Response::error('Không tìm thấy danh mục', 404);
            return;
        }

        $input = $this->validatedInput($request->all());
        if (isset($input['errors'])) {
            Response::error('Dữ liệu danh mục không hợp lệ', 422, $input['errors']);
            return;
        }
        $slug = $this->uniqueSlug($input['ten_danh_muc'], $id);
        if ($slug === '') {
            Response::error('Không thể tạo slug từ tên danh mục', 422, [
                'ten_danh_muc' => 'Tên danh mục cần có ký tự chữ hoặc số',
            ]);
            return;
        }

        try {
            $update = $this->pdo->prepare(
                'UPDATE danh_muc
                 SET ten_danh_muc = ?, slug = ?, icon = ?, thu_tu = ?
                 WHERE id = ?'
            );
            $update->execute([
                $input['ten_danh_muc'],
                $slug,
                $input['icon'],
                $input['thu_tu'],
                $id,
            ]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                Response::error('Tên danh mục đã tồn tại', 409);
                return;
            }
            throw $error;
        }

        $this->audit('category.updated', $id);
        Response::success('Đã cập nhật danh mục', ['id' => $id]);
    }

    public function updateVisibility(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null) {
            Response::error('Không tìm thấy danh mục', 404);
            return;
        }
        $visible = $this->visibilityValue($request->input('trang_thai'));
        if ($visible === null) {
            Response::error('Dữ liệu trạng thái không hợp lệ', 422, [
                'trang_thai' => 'trang_thai phải là 0 hoặc 1',
            ]);
            return;
        }

        $update = $this->pdo->prepare('UPDATE danh_muc SET trang_thai = ? WHERE id = ?');
        $update->execute([$visible, $id]);
        if ($update->rowCount() === 0 && !$this->exists($id)) {
            Response::error('Không tìm thấy danh mục', 404);
            return;
        }

        $this->audit($visible === 1 ? 'category.shown' : 'category.hidden', $id);
        Response::success('Đã cập nhật trạng thái danh mục', [
            'id' => $id,
            'trang_thai' => $visible,
        ]);
    }

    private function validatedInput(array $input): array
    {
        $errors = [];
        foreach (['slug', 'icon', 'nhom_con'] as $unsupportedField) {
            if (array_key_exists($unsupportedField, $input)) {
                $errors[$unsupportedField] = 'Trường này không còn được API quản trị hỗ trợ';
            }
        }
        $name = $input['ten_danh_muc'] ?? null;
        $name = is_string($name) ? trim(strip_tags($name)) : '';
        if ($name === '' || mb_strlen($name) > 100) {
            $errors['ten_danh_muc'] = 'Tên danh mục là bắt buộc và tối đa 100 ký tự';
        }

        $order = $input['thu_tu'] ?? 0;
        $order = $this->nonNegativeInteger($order);
        if ($order === null || $order > 2147483647) {
            $errors['thu_tu'] = 'thu_tu phải là số nguyên không âm';
            $order = 0;
        }

        return $errors === []
            ? [
                'ten_danh_muc' => $name,
                'icon' => self::DEFAULT_ICON,
                'thu_tu' => $order,
            ]
            : ['errors' => $errors];
    }

    private function slugify(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($ascii === false) {
            return '';
        }
        $slug = strtolower($ascii);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        return trim($slug, '-');
    }

    private function uniqueSlug(string $name, ?int $exceptId = null): string
    {
        $base = substr($this->slugify($name), 0, 120);
        if ($base === '') {
            return '';
        }
        for ($suffix = 1; $suffix <= 10000; $suffix++) {
            $candidate = $suffix === 1
                ? $base
                : substr($base, 0, 120 - strlen((string) $suffix) - 1) . '-' . $suffix;
            $sql = 'SELECT 1 FROM danh_muc WHERE slug = ?';
            $values = [$candidate];
            if ($exceptId !== null) {
                $sql .= ' AND id <> ?';
                $values[] = $exceptId;
            }
            $sql .= ' LIMIT 1';
            $query = $this->pdo->prepare($sql);
            $query->execute($values);
            if ($query->fetchColumn() === false) {
                return $candidate;
            }
        }
        throw new \RuntimeException('Không thể tạo slug duy nhất cho danh mục.');
    }

    private function audit(string $action, int $id): void
    {
        Logger::write(
            'admin_audit.log',
            'admin_id=' . (int) Session::get('user_id') . ' action=' . $action
                . ' entity=category entity_id=' . $id
        );
    }

    private function exists(int $id): bool
    {
        $query = $this->pdo->prepare('SELECT 1 FROM danh_muc WHERE id = ?');
        $query->execute([$id]);
        return $query->fetchColumn() !== false;
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
