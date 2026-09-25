<?php
/** @var Router $router */

// ─── Krish Agencies — Admin routes (customers + employees only) ───────────────
// Other Krish portal routes (machines, tickets, orders, products, attendance,
// customer portal, employee portal) were removed — the web app only calls these.

$router->get('/admin/customers',                   [AdminCustomerController::class, 'index'],   'admin');
$router->post('/admin/customers',                  [AdminCustomerController::class, 'store'],   'admin');
$router->get('/admin/customers/{id}',              [AdminCustomerController::class, 'show'],    'admin');
$router->put('/admin/customers/{id}',              [AdminCustomerController::class, 'update'],  'admin');
$router->delete('/admin/customers/{id}',           [AdminCustomerController::class, 'destroy'], 'admin');

$router->get('/admin/employees',                   [AdminKrishEmployeeController::class, 'index'],   'admin');
$router->post('/admin/employees',                  [AdminKrishEmployeeController::class, 'store'],   'admin');
$router->get('/admin/employees/{id}',              [AdminKrishEmployeeController::class, 'show'],    'admin');
$router->put('/admin/employees/{id}',              [AdminKrishEmployeeController::class, 'update'],  'admin');
$router->delete('/admin/employees/{id}',           [AdminKrishEmployeeController::class, 'destroy'], 'admin');
