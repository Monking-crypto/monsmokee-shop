<?php
declare(strict_types=1);

namespace App\Services;

use PDO;
use Throwable;

final class ProfileService
{
    public function __construct(private PDO $pdo)
    {
    }

    public function updateName(int $userId, string $expectedRole, mixed $rawName): array
    {
        if (!is_string($rawName)) {
            return [
                'status' => 422,
                'message' => 'Họ tên không hợp lệ',
                'errors' => ['ho_ten' => 'Họ tên phải có từ 2 đến 100 ký tự'],
            ];
        }

        $name = trim(strip_tags($rawName));
        if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($name, 'UTF-8') > 100) {
            return [
                'status' => 422,
                'message' => 'Họ tên không hợp lệ',
                'errors' => ['ho_ten' => 'Họ tên phải có từ 2 đến 100 ký tự'],
            ];
        }

        $this->pdo->beginTransaction();
        try {
            $user = $this->findUser($userId, true);
            if ($user === false || (int) $user['trang_thai'] !== 1) {
                $this->pdo->commit();
                return [
                    'status' => 401,
                    'message' => 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa',
                ];
            }
            if ($user['ten_vai_tro'] !== $expectedRole) {
                $this->pdo->commit();
                return [
                    'status' => 403,
                    'message' => 'Bạn không có quyền truy cập chức năng này',
                ];
            }

            $update = $this->pdo->prepare(
                'UPDATE nguoi_dung SET ho_ten = ? WHERE id = ?'
            );
            $update->execute([$name, $userId]);
            $user['ho_ten'] = $name;
            $this->pdo->commit();

            return [
                'status' => 200,
                'message' => 'Đã cập nhật hồ sơ',
                'user' => $this->publicUser($user),
            ];
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    private function findUser(int $userId, bool $forUpdate = false): array|false
    {
        $query = $this->pdo->prepare(
            'SELECT u.id, u.ho_ten, u.so_dien_thoai, u.email, u.trang_thai, v.ten_vai_tro
             FROM nguoi_dung u
             JOIN vai_tro v ON v.id = u.vai_tro_id
             WHERE u.id = ?
             LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $query->execute([$userId]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'ho_ten' => $user['ho_ten'],
            'so_dien_thoai' => $user['so_dien_thoai'],
            'email' => $user['email'],
            'vai_tro' => $user['ten_vai_tro'],
        ];
    }
}
