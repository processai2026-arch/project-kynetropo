<?php
/** @var Router $router */

// ─── Chat (public — auth optional) ───────────────────────────────────────────
$router->post('/chat',              [ChatController::class, 'send']);
$router->get('/chat/history',       [ChatController::class, 'history']);
