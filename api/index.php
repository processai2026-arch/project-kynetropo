<?php
declare(strict_types=1);

// --- Bootstrap ----------------------------------------------------------------
define('ROOT_PATH', __DIR__);

require_once ROOT_PATH . '/config/app.php';
require_once ROOT_PATH . '/core/Response.php';

// --- Error handling -----------------------------------------------------------
if (defined('APP_ENV') && APP_ENV === 'production') {
    error_reporting(0);
    ini_set('display_errors', '0');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
}

set_exception_handler(function (Throwable $e) {
    error_log('[Unhandled] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (class_exists('Response')) {
        Response::error(
            (!defined('APP_ENV') || APP_ENV === 'development') ? $e->getMessage() : 'Internal server error',
            500
        );
    } else {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Internal server error']);
    }
});

// --- CORS ---------------------------------------------------------------------
$_allowedOrigins = array_filter(array_map('trim', explode(',', defined('CORS_ORIGIN') ? CORS_ORIGIN : '')));
$_allowedOrigins[] = 'http://localhost:8080';
$_allowedOrigins[] = 'http://localhost:8081';
$_allowedOrigins[] = 'https://krish-agencies.kynetropo.com';
$_allowedOrigins[] = 'http://localhost:5173';          // local dev
$_requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$_corsHeader = in_array($_requestOrigin, $_allowedOrigins, true) ? $_requestOrigin : ($_allowedOrigins[0] ?? 'https://api.kynetropo.com');
header('Access-Control-Allow-Origin: ' . $_corsHeader);
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Client-Type, X-Tenant');
header('Access-Control-Max-Age: 86400'); // cache preflight 24h so the browser stops re-sending OPTIONS before every request
unset($_allowedOrigins, $_requestOrigin, $_corsHeader);
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- JWT secret guard ---------------------------------------------------------
if (
    !defined('JWT_SECRET') ||
    strlen(JWT_SECRET) < 32 ||
    JWT_SECRET === 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING_AT_LEAST_64_CHARS'
) {
    error_log('[Config] JWT_SECRET is missing or is still the default placeholder');
    Response::error('Server misconfiguration', 500);
}

// --- 415 Unsupported Media Type -----------------------------------------------
$requestMethod = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$contentType   = $_SERVER['CONTENT_TYPE'] ?? '';

if (
    in_array($requestMethod, ['POST', 'PUT', 'PATCH'], true) &&
    !empty($contentType) &&
    !str_contains($contentType, 'application/json') &&
    !str_contains($contentType, 'application/x-www-form-urlencoded') &&
    !str_contains($contentType, 'multipart/form-data')
) {
    Response::error('Unsupported Media Type. Use application/json', 415);
}

// --- Core ---------------------------------------------------------------------
require_once ROOT_PATH . '/config/database.php';
require_once ROOT_PATH . '/config/tenancy.php';        // multi-tenant config + TENANCY_ENABLED switch
require_once ROOT_PATH . '/core/AppException.php';
require_once ROOT_PATH . '/core/PlatformDB.php';       // control-plane DB connection
require_once ROOT_PATH . '/core/TenantContext.php';    // per-request tenant resolution + plan gating
require_once ROOT_PATH . '/core/TenantScope.php';      // dev tripwire: unscoped tenant-table queries
require_once ROOT_PATH . '/core/Database.php';
require_once ROOT_PATH . '/core/Request.php';
require_once ROOT_PATH . '/core/Router.php';

// Helpers, middleware, services, models and controllers are loaded on first use.
// Each file holds one class named after the file.
spl_autoload_register(function (string $class): void {
    if (!preg_match('/^[A-Za-z0-9_]+$/', $class)) return;
    foreach (['helpers', 'middleware', 'services', 'models', 'controllers'] as $dir) {
        $file = ROOT_PATH . '/' . $dir . '/' . $class . '.php';
        if (is_file($file)) {
            require_once $file;
            return;
        }
    }
});

// --- Routes: one file per module in api/routes/, loaded in name order ---------
// The router is first-match-wins, so the file order is the registration order:
// a static path such as /x/search must be registered before /x/{id}.
$router = new Router();
$_routeFiles = glob(ROOT_PATH . '/routes/*.php') ?: [];
sort($_routeFiles, SORT_STRING);
foreach ($_routeFiles as $_file) {
    (static function (Router $router, string $file): void { require $file; })($router, $_file);
}
unset($_routeFiles, $_file);

$router->dispatch();
