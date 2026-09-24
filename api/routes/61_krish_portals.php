<?php
/** @var Router $router */

// ─── Krish Agencies — Admin routes ───────────────────────────────────────────
$router->get('/admin/dashboard-stats',             [AdminDashboardController::class, 'stats'], 'admin');

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

$router->get('/admin/machines',                    [AdminMachineController::class, 'index'],   'admin');
$router->post('/admin/machines',                   [AdminMachineController::class, 'store'],   'admin');
$router->get('/admin/machines/{id}',               [AdminMachineController::class, 'show'],    'admin');
$router->put('/admin/machines/{id}',               [AdminMachineController::class, 'update'],  'admin');
$router->delete('/admin/machines/{id}',            [AdminMachineController::class, 'destroy'], 'admin');

$router->get('/admin/tickets',                     [AdminTicketController::class, 'index'],    'admin');
$router->post('/admin/tickets',                    [AdminTicketController::class, 'store'],    'admin');
$router->get('/admin/tickets/{id}/notes',          [AdminTicketController::class, 'notes'],    'admin');
$router->post('/admin/tickets/{id}/notes',         [AdminTicketController::class, 'addNote'],  'admin');
$router->get('/admin/tickets/{id}',                [AdminTicketController::class, 'show'],     'admin');
$router->put('/admin/tickets/{id}',                [AdminTicketController::class, 'update'],   'admin');
$router->delete('/admin/tickets/{id}',             [AdminTicketController::class, 'destroy'],  'admin');

$router->get('/admin/orders',                      [AdminOrderController::class, 'index'],    'admin');
$router->post('/admin/orders',                     [AdminOrderController::class, 'store'],    'admin');
$router->get('/admin/orders/{id}',                 [AdminOrderController::class, 'show'],     'admin');
$router->put('/admin/orders/{id}',                 [AdminOrderController::class, 'update'],   'admin');
$router->delete('/admin/orders/{id}',              [AdminOrderController::class, 'destroy'],  'admin');

$router->get('/admin/products',                    [AdminProductsController::class, 'index'],   'admin');
$router->post('/admin/products',                   [AdminProductsController::class, 'store'],   'admin');
$router->get('/admin/products/{id}',               [AdminProductsController::class, 'show'],    'admin');
$router->put('/admin/products/{id}',               [AdminProductsController::class, 'update'],  'admin');
$router->delete('/admin/products/{id}',            [AdminProductsController::class, 'destroy'], 'admin');

$router->get('/admin/attendance',                  [AdminAttendanceLogController::class, 'index'],    'admin');
$router->post('/admin/attendance/check-in',        [AdminAttendanceLogController::class, 'checkIn'],  'admin');
$router->post('/admin/attendance/check-out',       [AdminAttendanceLogController::class, 'checkOut'], 'admin');
$router->post('/admin/attendance/manual',          [AdminAttendanceLogController::class, 'manual'],   'admin');
$router->put('/admin/attendance/{id}',             [AdminAttendanceLogController::class, 'update'],   'admin');

// ─── Krish Agencies — Customer portal routes ─────────────────────────────────
$router->get('/customer/dashboard-stats',          [CustomerPortalController::class, 'dashboardStats'], 'customer');
$router->get('/customer/machines',                 [CustomerPortalController::class, 'machines'],       'customer');
$router->get('/customer/tickets',                  [CustomerPortalController::class, 'tickets'],        'customer');
$router->post('/customer/tickets',                 [CustomerPortalController::class, 'storeTicket'],    'customer');
$router->get('/customer/tickets/{id}/notes',       [CustomerPortalController::class, 'addTicketNote'],  'customer');
$router->post('/customer/tickets/{id}/notes',      [CustomerPortalController::class, 'addTicketNote'],  'customer');
$router->get('/customer/tickets/{id}',             [CustomerPortalController::class, 'showTicket'],     'customer');
$router->get('/customer/products',                 [CustomerPortalController::class, 'products'],       'customer');
$router->get('/customer/orders',                   [CustomerPortalController::class, 'orders'],         'customer');
$router->post('/customer/orders',                  [CustomerPortalController::class, 'storeOrder'],     'customer');
$router->get('/customer/orders/{id}',              [CustomerPortalController::class, 'showOrder'],      'customer');

// ─── Krish Agencies — Employee portal routes ─────────────────────────────────
$router->get('/employee/dashboard-stats',          [EmployeePortalController::class, 'dashboardStats'], 'employee');
$router->get('/employee/tickets',                  [EmployeePortalController::class, 'tickets'],        'employee');
$router->get('/employee/tickets/{id}',             [EmployeePortalController::class, 'showTicket'],     'employee');
$router->put('/employee/tickets/{id}',             [EmployeePortalController::class, 'updateTicket'],   'employee');
$router->post('/employee/tickets/{id}/notes',      [EmployeePortalController::class, 'addTicketNote'],  'employee');
$router->get('/employee/attendance/today',         [EmployeePortalController::class, 'attendanceToday'],'employee');
$router->get('/employee/attendance',               [EmployeePortalController::class, 'attendance'],     'employee');
$router->post('/employee/attendance/check-in',     [EmployeePortalController::class, 'checkIn'],        'employee');
$router->post('/employee/attendance/check-out',    [EmployeePortalController::class, 'checkOut'],       'employee');
