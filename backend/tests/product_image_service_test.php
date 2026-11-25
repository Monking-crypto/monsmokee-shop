<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/Services/ProductImageService.php';

use App\Services\ProductImageService;

if (!ProductImageService::isGdAvailable()) {
    echo "Product image service tests skipped: GD is unavailable\n";
    exit(0);
}

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'monsmokee-image-' . bin2hex(random_bytes(6));
if (!mkdir($directory, 0700)) {
    throw new RuntimeException('Could not create a temporary image test directory.');
}

$sourcePath = $directory . DIRECTORY_SEPARATOR . 'source.png';
$source = imagecreatetruecolor(200, 100);
$blue = imagecolorallocate($source, 20, 70, 220);
imagefill($source, 0, 0, $blue);
imagepng($source, $sourcePath);
imagedestroy($source);

$generated = [];
try {
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($sourcePath);
    $generated = (new ProductImageService())->createVariants(
        $sourcePath,
        (string) $mime,
        $directory . DIRECTORY_SEPARATOR . '.normalized'
    );
    $assert(
        $generated['extension'] === (function_exists('imagewebp') ? 'webp' : 'jpg'),
        'The output must prefer WebP and fall back to JPEG'
    );
    $mainSize = getimagesize($generated['main_path']);
    $thumbnailSize = getimagesize($generated['thumbnail_path']);
    $assert(
        $mainSize !== false && $mainSize[0] === 800 && $mainSize[1] === 800,
        'The main image must be normalized to 800 by 800'
    );
    $assert(
        $thumbnailSize !== false && $thumbnailSize[0] === 400 && $thumbnailSize[1] === 400,
        'The thumbnail must be normalized to 400 by 400'
    );

    $normalized = imagecreatefromstring((string) file_get_contents($generated['main_path']));
    $corner = imagecolorat($normalized, 10, 10);
    $center = imagecolorat($normalized, 400, 400);
    imagedestroy($normalized);
    $assert(
        (($corner >> 16) & 255) >= 240
            && (($corner >> 8) & 255) >= 240
            && ($corner & 255) >= 240,
        'The padding around the product must be white'
    );
    $assert(
        (($center >> 16) & 255) < 80 && ($center & 255) > 180,
        'The original product must remain centered and uncropped'
    );
    $assert(
        (new ProductImageService())->thumbnailPath(
            'uploads/products/0123456789abcdef0123456789abcdef_original.png'
        ) === null,
        'An unprocessed source image must not be presented as a thumbnail'
    );
} finally {
    foreach ([
        $sourcePath,
        $generated['main_path'] ?? null,
        $generated['thumbnail_path'] ?? null,
    ] as $path) {
        if (is_string($path) && is_file($path) && !unlink($path)) {
            throw new RuntimeException('Could not remove a temporary image test file.');
        }
    }
    if (is_dir($directory) && !rmdir($directory)) {
        throw new RuntimeException('Could not remove the temporary image test directory.');
    }
}

echo "Product image service tests passed\n";
