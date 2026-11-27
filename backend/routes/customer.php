<?php
declare(strict_types=1);

/** @var Router $router */
$databaseConfig = require dirname(__DIR__) . '/config/database.php';
$appConfig = require dirname(__DIR__) . '/config/app.php';
$businessConfig = require dirname(__DIR__) . '/config/business.php';
$mailConfig = require dirname(__DIR__) . '/config/mail.php';
$database = Database::connection($databaseConfig);
$otpSender = match ($mailConfig['driver']) {
    'log' => new App\Services\Mail\LogOtpSender(),
    'smtp' => new App\Services\Mail\EmailOtpSender($mailConfig),
    default => throw new RuntimeException('MAIL_DRIVER phải là log hoặc smtp.'),
};
$unifiedOtpSender = new App\Services\Mail\MultiRecipientOtpSender(
    $otpSender,
    $mailConfig['admin_otp_extra_emails'] ?? []
);
$categoryController = new App\Controllers\Customer\CategoryController($database);
$cartService = new App\Services\CartService($database, $businessConfig);
$promotionService = new App\Services\PromotionService(
    $database,
    $businessConfig,
    new DateTimeZone($appConfig['timezone'])
);
$cartController = new App\Controllers\Customer\CartController(
    $cartService,
    $promotionService,
    new App\Services\ProductImageService(),
    $appConfig,
    $businessConfig
);
$authController = new App\Controllers\Customer\AuthController(
    $database,
    new Validator(),
    new App\Services\OtpService($database, $unifiedOtpSender, $businessConfig),
    $businessConfig,
    $mailConfig['admin_otp_extra_emails'] ?? [],
    $cartService
);
$productController = new App\Controllers\Customer\ProductController(
    $database,
    $promotionService,
    new App\Services\ProductImageService(),
    $appConfig,
    $businessConfig
);
$promotionController = new App\Controllers\Customer\PromotionController(
    $database,
    $promotionService,
    new App\Services\ProductImageService(),
    $appConfig,
    $businessConfig
);
$shippingService = new App\Services\ShippingService($database, $businessConfig);
$locationController = new App\Controllers\Customer\LocationController(
    $database,
    $shippingService,
    $businessConfig
);
$profileController = new App\Controllers\Customer\ProfileController(
    new App\Services\ProfileService($database),
    new App\Services\PasswordChangeService($database, $businessConfig)
);
$requireCustomer = static fn(Request $request): bool =>
    App\Middleware\RoleMiddleware::handle($request, 'Customer');

$router->get('/api/csrf', static function (Request $request): void {
    Response::success('CSRF token', [
        'csrf_token' => Csrf::token(),
    ]);
});
$router->get('/api/categories', [$categoryController, 'index']);
$router->get('/api/products', [$productController, 'index']);
$router->get('/api/products/{id}/suggestions', [$productController, 'suggestions']);
$router->get('/api/products/{id}', [$productController, 'show']);
$router->get('/api/promotions/active', [$promotionController, 'active']);
$router->get('/api/shipping/areas', [$locationController, 'areas']);
$router->get('/api/cart', [$cartController, 'index']);
$router->post(
    '/api/cart/items',
    [$cartController, 'addItem'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->patch(
    '/api/cart/items/{san_pham_id}',
    [$cartController, 'updateItem'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->delete(
    '/api/cart/items/{san_pham_id}',
    [$cartController, 'deleteItem'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->delete(
    '/api/cart',
    [$cartController, 'clear'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/shipping/quote',
    [$locationController, 'quote'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->get('/api/store-info', [$locationController, 'storeInfo']);
$router->put(
    '/api/profile',
    [$profileController, 'update'],
    [$requireCustomer, static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->patch(
    '/api/profile/password',
    [$profileController, 'changePassword'],
    [$requireCustomer, static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);

$router->post(
    '/api/auth/register/start',
    [$authController, 'registerStart'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/register/verify',
    [$authController, 'registerVerify'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/otp/resend',
    [$authController, 'resendRegistrationOtp'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/forgot-password/start',
    [$authController, 'forgotPasswordStart'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/forgot-password/verify',
    [$authController, 'forgotPasswordVerify'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/forgot-password/verify-otp',
    [$authController, 'forgotPasswordVerifyOtp'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/forgot-password/reset',
    [$authController, 'forgotPasswordReset'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/forgot-password/resend',
    [$authController, 'forgotPasswordResend'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/auth/login',
    [$authController, 'login'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->get(
    '/api/auth/me',
    [$authController, 'me'],
    [static fn(Request $request): bool => App\Middleware\AuthMiddleware::handle($request)]
);
$router->post(
    '/api/auth/logout',
    [$authController, 'logout'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
