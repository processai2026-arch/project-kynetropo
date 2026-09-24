<?php
/** @var Router $router */

// --- Admin Routes (auth = 'admin' -> AuthMiddleware + AdminMiddleware) ---------

// Admin Users
$router->get('/admin/users',                   [AdminUserController::class, 'index'],      'admin');
$router->post('/admin/users',               [AdminUserController::class,    'store'],        'admin');

// Customer master detail + retention intelligence (database/105_create_customers_extra.sql)
$router->get('/admin/customers/health',             [AdminUserController::class, 'customerHealth'],  'admin');

// Admin Dealer Network and Customer Intelligence
$router->post('/admin/customers/merge',               [AdminDealerController::class, 'mergeCustomers'],        'admin:owner');
