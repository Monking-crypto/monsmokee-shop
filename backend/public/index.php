<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

$backendRoot = dirname(__DIR__);
$vendorAutoload = $backendRoot . '/vendor/autoload.php';
if (is_file($vendorAutoload)) {
    require_once $vendorAutoload;
}

spl_autoload_register(static function (string $className) use ($backendRoot): void {
    $prefixes = [
        'Core\\' => $backendRoot . '/core/',
        'App\\' => $backendRoot . '/app/',
    ];

    foreach ($prefixes as $prefix => $directory) {
        if (!str_starts_with($className, $prefix)) {
            continue;
        }
        $relative = substr($className, strlen($prefix));
        $file = $directory . str_replace('\\', '/', $relative) . '.php';
        if (is_file($file)) {
            require_once $file;
        }
        return;
    }

    $globalClasses = [
        'Env', 'Database', 'Request', 'Response', 'Router', 'Session', 'Csrf',
        'Validator', 'Logger', 'BaseController', 'CsrfMiddleware',
    ];
    if (in_array($className, $globalClasses, true)) {
        $paths = [
            $backendRoot . '/core/' . $className . '.php',
            $backendRoot . '/app/Middleware/' . $className . '.php',
        ];
        foreach ($paths as $file) {
            if (is_file($file)) {
                require_once $file;
                return;
            }
        }
    }
});

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$appConfig = null;
try {
    $appConfig = require $backendRoot . '/config/app.php';
    date_default_timezone_set((string) $appConfig['timezone']);
    $request = new Request();
    $isPublicCategoryList = $request->method === 'GET' && $request->path === '/api/categories';
    if (!$isPublicCategoryList) {
        Session::start($appConfig['session']);
    }

    $databaseConfig = require $backendRoot . '/config/database.php';
    Database::connection($databaseConfig);

    $router = new Router();

    require $backendRoot . '/routes/customer.php';
    require $backendRoot . '/routes/admin.php';

    $router->dispatch($request);
} catch (Throwable $error) {
    Logger::error($error::class . ': ' . $error->getMessage());
    $debug = strtolower((string) ($appConfig['env'] ?? '')) === 'development'
        && ($appConfig['debug'] ?? false);
    Response::error(
        $debug ? $error->getMessage() : 'Lỗi máy chủ',
        500,
        $debug ? ['exception' => $error::class] : null
    );
}