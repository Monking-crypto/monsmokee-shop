<?php
declare(strict_types=1);

use App\Services\ProductImageService;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$backendRoot = dirname(__DIR__);
require_once $backendRoot . '/core/Env.php';
require_once $backendRoot . '/core/Database.php';
require_once $backendRoot . '/app/Services/ProductImageService.php';

$pdo = Database::connection(require $backendRoot . '/config/database.php');
$imageService = new ProductImageService();
$images = $pdo->query(
    "SELECT DISTINCT hinh_anh
     FROM san_pham
     WHERE hinh_anh IS NOT NULL
       AND hinh_anh <> ''
       AND hinh_anh <> 'placeholder-product.svg'"
)->fetchAll(PDO::FETCH_COLUMN);

$processed = 0;
$skipped = 0;
$failures = 0;

foreach ($images as $storedPath) {
    if (
        !is_string($storedPath)
        || preg_match(
            '#\Auploads/products/([a-f0-9]{32})(_original)?\.(jpg|png|webp)\z#',
            $storedPath,
            $matches
        ) !== 1
    ) {
        fwrite(STDERR, "Skipped an image path outside the managed product upload format.\n");
        $failures++;
        continue;
    }

    $directory = $backendRoot . '/uploads/products';
    $sourcePath = $backendRoot . '/' . str_replace('/', DIRECTORY_SEPARATOR, $storedPath);
    $oldThumbnailPath = ($matches[2] ?? '') === '_original'
        ? null
        : $directory . '/' . $matches[1] . '_thumb.' . $matches[3];
    if (!is_file($sourcePath)) {
        fwrite(STDERR, 'Missing stored image: ' . basename($sourcePath) . PHP_EOL);
        $failures++;
        continue;
    }

    $mainSize = @getimagesize($sourcePath);
    $thumbnailSize = is_string($oldThumbnailPath) && is_file($oldThumbnailPath)
        ? @getimagesize($oldThumbnailPath)
        : false;
    if (
        ($matches[2] ?? '') !== '_original'
        && is_array($mainSize)
        && (int) $mainSize[0] === 800
        && (int) $mainSize[1] === 800
        && is_array($thumbnailSize)
        && (int) $thumbnailSize[0] === 400
        && (int) $thumbnailSize[1] === 400
    ) {
        $skipped++;
        continue;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($sourcePath);
    if (!is_string($mime) || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        fwrite(STDERR, 'Unsupported stored image type: ' . basename($sourcePath) . PHP_EOL);
        $failures++;
        continue;
    }

    $randomName = bin2hex(random_bytes(16));
    $temporaryPrefix = $directory . '/.regen-' . $randomName;
    $generated = null;
    $newMainPath = null;
    $newThumbnailPath = null;
    try {
        $generated = $imageService->createVariants($sourcePath, $mime, $temporaryPrefix);
        $mainFilename = $randomName . '.' . $generated['extension'];
        $thumbnailFilename = $randomName . '_thumb.' . $generated['extension'];
        $newMainPath = $directory . '/' . $mainFilename;
        $newThumbnailPath = $directory . '/' . $thumbnailFilename;
        if (
            !rename($generated['main_path'], $newMainPath)
            || !rename($generated['thumbnail_path'], $newThumbnailPath)
        ) {
            throw new RuntimeException('Could not publish both generated image variants.');
        }

        $newStoredPath = 'uploads/products/' . $mainFilename;
        $pdo->beginTransaction();
        $update = $pdo->prepare('UPDATE san_pham SET hinh_anh = ? WHERE hinh_anh = ?');
        $update->execute([$newStoredPath, $storedPath]);
        if ($update->rowCount() < 1) {
            throw new RuntimeException('No product rows referenced the source image.');
        }
        $pdo->commit();

        foreach ([$sourcePath, $oldThumbnailPath] as $oldPath) {
            if (is_string($oldPath) && is_file($oldPath) && !unlink($oldPath)) {
                fwrite(STDERR, 'Could not remove replaced image: ' . basename($oldPath) . PHP_EOL);
                $failures++;
            }
        }
        $processed++;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        foreach ([
            $generated['main_path'] ?? null,
            $generated['thumbnail_path'] ?? null,
            $newMainPath,
            $newThumbnailPath,
        ] as $temporaryPath) {
            if (is_string($temporaryPath) && is_file($temporaryPath) && !unlink($temporaryPath)) {
                fwrite(STDERR, 'Could not clean a temporary generated image.' . PHP_EOL);
                $failures++;
            }
        }
        fwrite(
            STDERR,
            'Image regeneration failed for ' . basename($sourcePath)
                . ': ' . $error->getMessage() . PHP_EOL
        );
        $failures++;
    }
}

fwrite(
    STDOUT,
    'Processed: ' . $processed . '; skipped: ' . $skipped . '; failures: ' . $failures . PHP_EOL
);
exit($failures === 0 ? 0 : 1);
