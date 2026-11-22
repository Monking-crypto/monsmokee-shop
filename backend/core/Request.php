<?php
declare(strict_types=1);

/**
 * Đọc phương thức, đường dẫn và dữ liệu gửi lên từ request.
 */
final class Request
{
    public readonly string $method;
    public readonly string $path;
    public readonly array $query;
    private array $body;

    public function __construct()
    {
        $this->method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';

        $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        $scriptName = '/' . ltrim($scriptName, '/');
        $baseDir = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
        if ($baseDir === '.' || $baseDir === '') {
            $baseDir = '/';
        }

        $path = '/' . ltrim(str_replace('\\', '/', $path), '/');
        if ($baseDir !== '/' && ($path === $baseDir || str_starts_with($path, $baseDir . '/'))) {
            $path = substr($path, strlen($baseDir));
        }

        $path = '/' . ltrim((string) $path, '/');
        $indexPrefix = '/index.php';
        if ($path === $indexPrefix || str_starts_with($path, $indexPrefix . '/')) {
            $path = substr($path, strlen($indexPrefix));
        }

        $this->path = '/' . trim($path, '/');
        if ($this->path === '/') {
            $this->path = '/';
        }
        $this->query = $_GET;
        $rawBody = file_get_contents('php://input');
        $decoded = $rawBody !== false && trim($rawBody) !== ''
            ? json_decode($rawBody, true)
            : null;
        $this->body = is_array($decoded) ? $decoded : $_POST;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->body;
    }

    public function header(string $name, mixed $default = null): mixed
    {
        $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $_SERVER[$serverName] ?? $default;
    }

    public function ip(): string
    {
        return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
    }
}
