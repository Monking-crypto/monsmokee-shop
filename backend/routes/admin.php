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
    new App\Services\OtpService(
        $adminDatabase,
        new App\Services\Mail\MultiRecipientOtpSender(
            $adminOtpSender,
            $adminMailConfig['admin_otp_extra_emails'] ?? []
        ),
        $adminBusinessConfig
    ),
    $adminBusinessConfig,
    $adminMailConfig['admin_otp_extra_emails'] ?? []
);
$categoryAdminController = new App\Controllers\Admin\CategoryAdminController($adminDatabase);
$productAdminController = new App\Controllers\Admin\ProductAdminController($adminDatabase);
$stockAdminController = new App\Controllers\Admin\StockAdminController($adminDatabase);
$promotionAdminController = new App\Controllers\Admin\PromotionAdminController(
    $adminDatabase,
    $adminBusinessConfig
);
$deliveryAreaAdminController = new App\Controllers\Admin\DeliveryAreaAdminController($adminDatabase);
$requireVerifiedAdmin = static fn(Request $request): bool =>
    App\Middleware\AdminMiddleware::handle($request);
$requireAdminCsrf = static fn(Request $request): bool =>
    CsrfMiddleware::handle($request);
$requireLogoutCsrf = static function (Request $request): bool {
    if (Session::get('session_expired') === true) {
        Session::destroy();
        Response::error('Phiên đã hết hạn, vui lòng đăng nhập lại', 401, [
            'code' => 'SESSION_EXPIRED',
        ]);
        return false;
    }
    return CsrfMiddleware::handle($request);
};

$router->post(
    '/api/admin/auth/login',
    [$adminAuthController, 'login'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/admin/auth/verify-otp',
    [$adminAuthController, 'verifyOtp'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/admin/auth/otp/resend',
    [$adminAuthController, 'resendOtp'],
    [static fn(Request $request): bool => CsrfMiddleware::handle($request)]
);
$router->post(
    '/api/admin/auth/logout',
    [$adminAuthController, 'logout'],
    [$requireLogoutCsrf]
);
$router->get(
    '/api/admin/me',
    [$adminAuthController, 'me'],
    [$requireVerifiedAdmin]
);
$router->get('/api/admin/categories', [$categoryAdminController, 'index'], [$requireVerifiedAdmin]);
$router->get(
    '/api/admin/delivery-areas',
    [$deliveryAreaAdminController, 'index'],
    [$requireVerifiedAdmin]
);
$router->post(
    '/api/admin/delivery-areas',
    [$deliveryAreaAdminController, 'create'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->put(
    '/api/admin/delivery-areas/{id}',
    [$deliveryAreaAdminController, 'update'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->patch(
    '/api/admin/delivery-areas/{id}/status',
    [$deliveryAreaAdminController, 'updateStatus'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->post(
    '/api/admin/categories',
    [$categoryAdminController, 'create'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->put(
    '/api/admin/categories/{id}',
    [$categoryAdminController, 'update'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->patch(
    '/api/admin/categories/{id}/visibility',
    [$categoryAdminController, 'updateVisibility'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);

$router->get('/api/admin/products', [$productAdminController, 'index'], [$requireVerifiedAdmin]);
$router->get(
    '/api/admin/products/{id}',
    [$productAdminController, 'show'],
    [$requireVerifiedAdmin]
);
$router->post(
    '/api/admin/products',
    [$productAdminController, 'create'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->put(
    '/api/admin/products/{id}',
    [$productAdminController, 'update'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->patch(
    '/api/admin/products/{id}/visibility',
    [$productAdminController, 'updateVisibility'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->delete(
    '/api/admin/products/{id}',
    [$productAdminController, 'delete'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->post(
    '/api/admin/products/{id}/image',
    [$productAdminController, 'uploadImage'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->post(
    '/api/admin/stock-receipts',
    [$stockAdminController, 'createReceipt'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->get(
    '/api/admin/stock-receipts',
    [$stockAdminController, 'receipts'],
    [$requireVerifiedAdmin]
);
$router->get(
    '/api/admin/stock-receipts/{id}',
    [$stockAdminController, 'receiptDetail'],
    [$requireVerifiedAdmin]
);
$router->post(
    '/api/admin/stock-receipts/{id}/cancel',
    [$stockAdminController, 'cancelReceipt'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->get(
    '/api/admin/batches',
    [$stockAdminController, 'batches'],
    [$requireVerifiedAdmin]
);
$router->get(
    '/api/admin/stock-history',
    [$stockAdminController, 'stockHistory'],
    [$requireVerifiedAdmin]
);
$router->get(
    '/api/admin/promotions',
    [$promotionAdminController, 'index'],
    [$requireVerifiedAdmin]
);
$router->get(
    '/api/admin/promotions/{id}',
    [$promotionAdminController, 'show'],
    [$requireVerifiedAdmin]
);
$router->post(
    '/api/admin/promotions',
    [$promotionAdminController, 'create'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->put(
    '/api/admin/promotions/{id}',
    [$promotionAdminController, 'update'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->patch(
    '/api/admin/promotions/{id}/status',
    [$promotionAdminController, 'updateStatus'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->post(
    '/api/admin/promotions/{id}/random-products',
    [$promotionAdminController, 'randomProducts'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
$router->delete(
    '/api/admin/promotions/{id}',
    [$promotionAdminController, 'delete'],
    [$requireVerifiedAdmin, $requireAdminCsrf]
);
