<?php
declare(strict_types=1);

namespace App\Controllers\Customer;

use PDO;
use Request;
use Response;

final class CategoryController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(Request $request, array $params = []): void
    {
        $query = $this->pdo->query(
            'SELECT id, ten_danh_muc, slug, icon, thu_tu
             FROM danh_muc
             WHERE trang_thai = 1
             ORDER BY thu_tu ASC, ten_danh_muc ASC, id ASC'
        );
        $categories = array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'ten_danh_muc' => $row['ten_danh_muc'],
                'slug' => $row['slug'],
                'icon' => $row['icon'],
                'thu_tu' => (int) $row['thu_tu'],
            ],
            $query->fetchAll(PDO::FETCH_ASSOC)
        );

        header_remove('Pragma');
        header_remove('Expires');
        header('Cache-Control: public, max-age=300', true);
        Response::success('Danh sách danh mục', ['categories' => $categories]);
    }
}
