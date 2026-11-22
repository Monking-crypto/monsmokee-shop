<?php
declare(strict_types=1);

/** @var Router $router */
$databaseConfig = require dirname(__DIR__) . '/config/database.php';
$businessConfig = require dirname(__DIR__) . '/config/business.php';
$mailConfig = require dirname(__DIR__) . '/config/mail.php';
$database = Database::connection($databaseConfig);
$otpSender = match ($mailConfig['driver']) {
    'log' => new App\Services\Mail\LogOtpSender(),
    'smtp' => new App\Services\Mail\EmailOtpSender($mailConfig),
    default => throw new RuntimeException('MAIL_DRIVER phải là log hoặc smtp.'),
};
$authController = new App\Controllers\Customer\AuthController(
    $database,
    new Validator(),
    new App\Services\OtpService($database, $otpSender, $businessConfig),
    $businessConfig
);

$router->get('/api/csrf', static function (Request $request): void {
    Response::success('CSRF token', [
        'csrf_token' => Csrf::token(),
    ]);
});

$router->post(
    '/api/auth/register/start',
    [$authController, 'registerStart'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);

$customerMutations = [
    '/api/auth/register/verify',
    '/api/auth/otp/resend',
    '/api/auth/login',
    '/api/auth/logout',
];

foreach ($customerMutations as $path) {
    $router->post($path, static function (Request $request): void {
        Response::notImplemented('Tính năng đang được phát triển');
    }, [static fn(Request $request): bool => CsrfMiddleware::handle($request)]);
}
