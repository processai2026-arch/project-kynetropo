<?php
/** @var Router $router */

// Auth - public
$router->post('/auth/login',    [AuthController::class, 'login']);
$router->post('/auth/refresh',  [AuthController::class, 'refresh']);
$router->post('/auth/logout',   [AuthController::class, 'logout'],  true);
$router->get('/auth/me',        [AuthController::class, 'me'],      true);
