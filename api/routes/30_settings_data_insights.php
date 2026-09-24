<?php
/** @var Router $router */

// Admin Settings
$router->get('/admin/settings',             [AdminSettingsController::class, 'show'],         'admin');
$router->put('/admin/settings',             [AdminSettingsController::class, 'update'],       'admin');
