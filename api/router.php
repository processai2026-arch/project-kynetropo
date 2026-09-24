<?php
// Local development router for PHP's built-in server:
//   php -S 127.0.0.1:8020 -t api api/router.php      (npm run api:serve)
// Every /api/* request goes to index.php. Nothing else under api/ is ever
// served — config/, uploads/, backups/ stay unreachable exactly as
// api/.htaccess keeps them in production. Never deployed (see
// scripts/build-release.mjs).
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('#^/api(/|$)#', $path)) {
    require __DIR__ . '/index.php';
    return true;
}
http_response_code(404);
header('Content-Type: text/plain');
echo 'Not found';
return true;
