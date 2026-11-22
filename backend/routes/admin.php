<?php
declare(strict_types=1);

/** @var Router $router */
$adminDatabaseConfig = require dirname(__DIR__) . '/config/database.php';
$adminBusinessConfig = require dirname(__DIR__) . '/config/business.php';
$adminMailConfig = require dirname(__DIR__) . '/config/mail.php';
$adminDatabase = Database::connection($adminDatabaseConfig);
$adminOtpSender = match ($adminMailConfig['driver']) {
    'log' => new App\Services\Mail\LogOtpSender(),
    'smtp' => new App\Services\Mail\EmailOtpSender($adminMailConfig),
    default => throw new RuntimeException('MAIL_DRIVER phải là log hoặc smtp.'),
};
$adminAuthController = new App\Controllers\Admin\AdminAuthController(
    $adminDatabase,
    new Validator(),
    new App\Services\OtpService($adminDatabase, $adminOtpSender, $adminBusinessConfig),
    $adminBusinessConfig
);

$router->post(
    '/api/admin/auth/login',
    [$adminAuthController, 'login'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
