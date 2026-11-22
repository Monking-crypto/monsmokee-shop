<?php
declare(strict_types=1);

/** @var Router $router */
$router->get('/api/csrf', static function (Request $request): void {
    Response::success('CSRF token', [
        'csrf_token' => Csrf::token(),
    ]);
});

$customerMutations = [
    '/api/auth/register/start',
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
