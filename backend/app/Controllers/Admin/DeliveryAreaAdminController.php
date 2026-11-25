<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use PDO;
use PDOException;
use Request;
use Response;
use Session;
use Logger;

final class DeliveryAreaAdminController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request, array $params = []): void
    {
        $query = $this->pdo->query(
            'SELECT id, tinh, quan_huyen, phuong_xa, khoang_cach_km, ho_tro
             FROM khu_vuc_giao_hang
             ORDER BY tinh, quan_huyen, phuong_xa, id'
        );
        $areas = array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'tinh' => $row['tinh'],
                'quan_huyen' => $row['quan_huyen'],
                'phuong_xa' => $row['phuong_xa'],
                'khoang_cach_km' => (float) $row['khoang_cach_km'],
                'ho_tro' => (int) $row['ho_tro'],
            ],
            $query->fetchAll(PDO::FETCH_ASSOC)
        );
        Response::success('Danh sách khu vực giao hàng', ['areas' => $areas]);
    }

    public function create(Request $request, array $params = []): void
    {
        $area = $this->validatedInput($request->all());
        if (isset($area['errors'])) {
            Response::error('Dữ liệu khu vực giao hàng không hợp lệ', 422, $area['errors']);
            return;
        }
        if ($this->duplicate($area)) {
            Response::error('Khu vực giao hàng đã tồn tại', 409);
            return;
        }

        try {
            $insert = $this->pdo->prepare(
                'INSERT INTO khu_vuc_giao_hang
                 (tinh, quan_huyen, phuong_xa, khoang_cach_km, ho_tro)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $insert->execute([
                $area['tinh'],
                $area['quan_huyen'],
                $area['phuong_xa'],
                $area['khoang_cach_km'],
                $area['ho_tro'],
            ]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                Response::error('Khu vực giao hàng đã tồn tại', 409);
                return;
            }
            throw $error;
        }

        $id = (int) $this->pdo->lastInsertId();
        $this->audit('delivery_area.created', $id);
        Response::success('Đã tạo khu vực giao hàng', ['id' => $id], 201);
    }

    public function update(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        if ($id === null || !$this->exists($id)) {
            Response::error('Không tìm thấy khu vực giao hàng', 404);
            return;
        }
        $area = $this->validatedInput($request->all());
        if (isset($area['errors'])) {
            Response::error('Dữ liệu khu vực giao hàng không hợp lệ', 422, $area['errors']);
            return;
        }
        if ($this->duplicate($area, $id)) {
            Response::error('Khu vực giao hàng đã tồn tại', 409);
            return;
        }

        try {
            $update = $this->pdo->prepare(
                'UPDATE khu_vuc_giao_hang
                 SET tinh = ?, quan_huyen = ?, phuong_xa = ?, khoang_cach_km = ?, ho_tro = ?
                 WHERE id = ?'
            );
            $update->execute([
                $area['tinh'],
                $area['quan_huyen'],
                $area['phuong_xa'],
                $area['khoang_cach_km'],
                $area['ho_tro'],
                $id,
            ]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                Response::error('Khu vực giao hàng đã tồn tại', 409);
                return;
            }
            throw $error;
        }

        $this->audit('delivery_area.updated', $id);
        Response::success('Đã cập nhật khu vực giao hàng', ['id' => $id]);
    }

    public function updateStatus(Request $request, array $params = []): void
    {
        $id = $this->positiveInteger($params['id'] ?? null);
        $status = $this->statusValue($request->input('ho_tro'));
        if ($id === null || !$this->exists($id)) {
            Response::error('Không tìm thấy khu vực giao hàng', 404);
            return;
        }
        if ($status === null) {
            Response::error('Dữ liệu trạng thái không hợp lệ', 422, [
                'ho_tro' => 'ho_tro phải là 0 hoặc 1',
            ]);
            return;
        }

        $update = $this->pdo->prepare(
            'UPDATE khu_vuc_giao_hang SET ho_tro = ? WHERE id = ?'
        );
        $update->execute([$status, $id]);
        $this->audit($status === 1 ? 'delivery_area.enabled' : 'delivery_area.disabled', $id);
        Response::success('Đã cập nhật trạng thái khu vực giao hàng', [
            'id' => $id,
            'ho_tro' => $status,
        ]);
    }

    private function validatedInput(array $input): array
    {
        $errors = [];
        $names = [];
        foreach (['tinh', 'quan_huyen', 'phuong_xa'] as $field) {
            $value = $input[$field] ?? null;
            $value = is_string($value) ? trim(strip_tags($value)) : '';
            if ($value === '' || mb_strlen($value) > 80) {
                $errors[$field] = 'Trường này là bắt buộc và tối đa 80 ký tự';
            }
            $names[$field] = $value;
        }

        $distance = $input['khoang_cach_km'] ?? null;
        if (
            (!is_string($distance) && !is_int($distance) && !is_float($distance))
            || !is_numeric($distance)
            || (float) $distance < 0
            || (float) $distance > 999.9
            || preg_match('/^\d+(?:\.\d{1})?$/', (string) $distance) !== 1
        ) {
            $errors['khoang_cach_km'] = 'Khoảng cách phải từ 0 đến 999.9 km, tối đa 1 chữ số thập phân';
        }

        $status = $this->statusValue($input['ho_tro'] ?? 1);
        if ($status === null) {
            $errors['ho_tro'] = 'ho_tro phải là 0 hoặc 1';
        }
        if ($errors !== []) {
            return ['errors' => $errors];
        }
        return [
            ...$names,
            'khoang_cach_km' => (float) $distance,
            'ho_tro' => $status,
        ];
    }

    private function duplicate(array $area, ?int $exceptId = null): bool
    {
        $sql = 'SELECT 1 FROM khu_vuc_giao_hang
                WHERE tinh = ? AND quan_huyen = ? AND phuong_xa = ?';
        $values = [$area['tinh'], $area['quan_huyen'], $area['phuong_xa']];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $values[] = $exceptId;
        }
        $sql .= ' LIMIT 1';
        $query = $this->pdo->prepare($sql);
        $query->execute($values);
        return $query->fetchColumn() !== false;
    }

    private function exists(int $id): bool
    {
        $query = $this->pdo->prepare('SELECT 1 FROM khu_vuc_giao_hang WHERE id = ?');
        $query->execute([$id]);
        return $query->fetchColumn() !== false;
    }

    private function audit(string $action, int $id): void
    {
        Logger::write(
            'admin_audit.log',
            'admin_id=' . (int) Session::get('user_id')
                . ' action=' . $action . ' entity=delivery_area entity_id=' . $id
        );
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

    private function statusValue(mixed $value): ?int
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
