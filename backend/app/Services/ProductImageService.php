<?php
declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;
use Throwable;

final class ProductImageService
{
    private const MAX_IMAGE_PIXELS = 20000000;
    private const IMAGE_QUALITY = 82;

    public static function isGdAvailable(): bool
    {
        return extension_loaded('gd')
            && function_exists('imagecreatefromstring')
            && function_exists('imagecreatetruecolor')
            && function_exists('imagecopyresampled')
            && function_exists('imagejpeg');
    }

    /**
     * @return array{extension:string,main_path:string,thumbnail_path:string}
     */
    public function createVariants(string $sourcePath, string $mime, string $temporaryPrefix): array
    {
        if (!self::isGdAvailable()) {
            throw new RuntimeException('GD_EXTENSION_UNAVAILABLE');
        }
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new InvalidArgumentException('IMAGE_MIME_UNSUPPORTED');
        }

        $contents = @file_get_contents($sourcePath);
        if (!is_string($contents) || $contents === '') {
            throw new RuntimeException('IMAGE_SOURCE_READ_FAILED');
        }
        $source = @imagecreatefromstring($contents);
        unset($contents);
        if ($source === false) {
            throw new InvalidArgumentException('IMAGE_DECODE_FAILED');
        }

        $extension = function_exists('imagewebp') ? 'webp' : 'jpg';
        $mainPath = $temporaryPrefix . '.' . $extension;
        $thumbnailPath = $temporaryPrefix . '_thumb.' . $extension;

        try {
            $width = imagesx($source);
            $height = imagesy($source);
            if (
                $width < 1
                || $height < 1
                || $width > intdiv(self::MAX_IMAGE_PIXELS, $height)
            ) {
                throw new InvalidArgumentException('IMAGE_DIMENSIONS_INVALID');
            }

            $large = $this->createSquare($source, 800);
            try {
                $this->writeImage($large, $mainPath, $extension);
            } finally {
                imagedestroy($large);
            }

            $thumbnail = $this->createSquare($source, 400);
            try {
                $this->writeImage($thumbnail, $thumbnailPath, $extension);
            } finally {
                imagedestroy($thumbnail);
            }
        } catch (Throwable $error) {
            foreach ([$mainPath, $thumbnailPath] as $path) {
                if (is_file($path) && !unlink($path)) {
                    throw new RuntimeException('IMAGE_TEMP_CLEANUP_FAILED', 0, $error);
                }
            }
            throw $error;
        } finally {
            imagedestroy($source);
        }

        return [
            'extension' => $extension,
            'main_path' => $mainPath,
            'thumbnail_path' => $thumbnailPath,
        ];
    }

    public function thumbnailPath(?string $mainPath): ?string
    {
        if ($mainPath === null || $mainPath === '') {
            return null;
        }
        if ($mainPath === 'placeholder-product.svg') {
            return $mainPath;
        }
        if (
            preg_match(
                '#\Auploads/products/[a-f0-9]{32}_original\.(jpg|png|webp)\z#',
                $mainPath
            ) === 1
        ) {
            return null;
        }
        if (
            preg_match(
                '#\Auploads/products/([a-f0-9]{32})\.(jpg|png|webp)\z#',
                $mainPath,
                $matches
            ) !== 1
        ) {
            return $mainPath;
        }

        return 'uploads/products/' . $matches[1] . '_thumb.' . $matches[2];
    }

    public function cardImagePath(?string $mainPath): ?string
    {
        $thumbnailPath = $this->thumbnailPath($mainPath);
        if ($thumbnailPath === null || $thumbnailPath === $mainPath) {
            return $thumbnailPath;
        }

        $backendRoot = dirname(__DIR__, 2);
        $absoluteThumbnailPath = $backendRoot . '/' . str_replace('/', DIRECTORY_SEPARATOR, $thumbnailPath);
        return is_file($absoluteThumbnailPath) ? $thumbnailPath : $mainPath;
    }

    private function createSquare(\GdImage $source, int $size): \GdImage
    {
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $scale = min($size / $sourceWidth, $size / $sourceHeight);
        $width = max(1, (int) round($sourceWidth * $scale));
        $height = max(1, (int) round($sourceHeight * $scale));
        $canvas = imagecreatetruecolor($size, $size);
        if ($canvas === false) {
            throw new RuntimeException('IMAGE_CANVAS_CREATE_FAILED');
        }

        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagealphablending($canvas, true);
        if (!imagecopyresampled(
            $canvas,
            $source,
            intdiv($size - $width, 2),
            intdiv($size - $height, 2),
            0,
            0,
            $width,
            $height,
            $sourceWidth,
            $sourceHeight
        )) {
            imagedestroy($canvas);
            throw new RuntimeException('IMAGE_RESIZE_FAILED');
        }

        return $canvas;
    }

    private function writeImage(\GdImage $image, string $path, string $extension): void
    {
        $written = $extension === 'webp'
            ? imagewebp($image, $path, self::IMAGE_QUALITY)
            : imagejpeg($image, $path, self::IMAGE_QUALITY);
        if ($written !== true || !is_file($path) || filesize($path) < 1) {
            throw new RuntimeException('IMAGE_ENCODE_FAILED');
        }
    }
}
