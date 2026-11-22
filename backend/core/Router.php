<?php
declare(strict_types=1);

/**
 * Đăng ký route, chạy middleware và dispatch controller.
 */
final class Router
{
    private array $routes = [];

    public function add(string $method, string $path, callable|array $handler, array $middleware = []): void
    {
        $this->routes[strtoupper($method)][] = [
            'path' => '/' . trim($path, '/'),
            'handler' => $handler,
            'middleware' => $middleware,
        ];
    }

    public function get(string $path, callable|array $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, callable|array $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, callable|array $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    public function patch(string $path, callable|array $handler, array $middleware = []): void
    {
        $this->add('PATCH', $path, $handler, $middleware);
    }

    public function delete(string $path, callable|array $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    public function dispatch(Request $request): void
    {
        $methodRoutes = $this->routes[$request->method] ?? [];
        $requestPath = '/' . trim($request->path, '/');
        $indexPrefix = '/index.php';
        if ($requestPath === $indexPrefix || str_starts_with($requestPath, $indexPrefix . '/')) {
            $requestPath = substr($requestPath, strlen($indexPrefix));
        }
        $requestPath = '/' . trim($requestPath, '/');

        foreach ($methodRoutes as $route) {
            $params = $this->match($route['path'], $requestPath);
            if ($params === null) {
                continue;
            }

            foreach ($route['middleware'] as $middleware) {
                $allowed = is_callable($middleware)
                    ? $middleware($request)
                    : null;
                if ($allowed === false) {
                    return;
                }
            }

            $handler = $route['handler'];
            if (is_array($handler)) {
                [$controller, $method] = $handler;
                $controller->$method($request, $params);
            } else {
                $handler($request, $params);
            }
            return;
        }

        Response::error('API không tồn tại', 404);
    }

    private function match(string $routePath, string $requestPath): ?array
    {
        $pattern = preg_replace_callback('/\{([A-Za-z_][A-Za-z0-9_]*)\}/', static function () {
            return '([^/]+)';
        }, $routePath);
        $pattern = '#^' . str_replace('/', '\\/', $pattern) . '$#';

        if (!preg_match($pattern, $requestPath, $matches)) {
            return null;
        }

        preg_match_all('/\{([A-Za-z_][A-Za-z0-9_]*)\}/', $routePath, $names);
        $params = [];
        foreach ($names[1] as $index => $name) {
            $params[$name] = rawurldecode($matches[$index + 1]);
        }
        return $params;
    }
}
