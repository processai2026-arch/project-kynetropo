<?php
/** @var Router $router */

// Notifications
$router->get('/admin/notifications',           [AdminNotificationController::class, 'index'],   'admin');

// Admin Reports
$router->get('/admin/reports',                 [AdminReportsController::class, 'index'],        'admin');
