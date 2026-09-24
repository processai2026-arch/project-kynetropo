<?php
/** @var Router $router */

// ─── Kynetropo Ops — Dashboard ────────────────────────────────────────────────
$router->get('/admin/ops/dashboard-stats',                   [AdminOpsDashboardController::class, 'stats'],          'admin');

// ─── Kynetropo Ops — Clients ──────────────────────────────────────────────────
$router->get('/admin/ops/clients',                           [AdminOpsClientController::class, 'index'],             'admin');
$router->post('/admin/ops/clients',                          [AdminOpsClientController::class, 'store'],             'admin');
$router->get('/admin/ops/clients/{id}',                      [AdminOpsClientController::class, 'show'],              'admin');
$router->put('/admin/ops/clients/{id}',                      [AdminOpsClientController::class, 'update'],            'admin');
$router->post('/admin/ops/clients/{id}/stage',               [AdminOpsClientController::class, 'advanceStage'],      'admin');
$router->put('/admin/ops/clients/{id}/checklist/{item_id}',               [AdminOpsClientController::class, 'checklistUpdate'],      'admin');
$router->delete('/admin/ops/clients/{id}',                   [AdminOpsClientController::class, 'destroy'],           'admin');

// ─── Kynetropo Ops — Projects ─────────────────────────────────────────────────
$router->get('/admin/ops/projects',                          [AdminOpsProjectController::class, 'index'],            'admin');
$router->post('/admin/ops/projects',                         [AdminOpsProjectController::class, 'store'],            'admin');
$router->get('/admin/ops/projects/{id}',                     [AdminOpsProjectController::class, 'show'],             'admin');
$router->put('/admin/ops/projects/{id}',                     [AdminOpsProjectController::class, 'update'],           'admin');
$router->delete('/admin/ops/projects/{id}',                  [AdminOpsProjectController::class, 'destroy'],          'admin');

// ─── Kynetropo Ops — Bugs ─────────────────────────────────────────────────────
$router->get('/admin/ops/bugs',                              [AdminOpsBugController::class, 'index'],                'admin');
$router->post('/admin/ops/bugs',                             [AdminOpsBugController::class, 'store'],                'admin');
$router->get('/admin/ops/bugs/{id}',                         [AdminOpsBugController::class, 'show'],                 'admin');
$router->put('/admin/ops/bugs/{id}',                         [AdminOpsBugController::class, 'update'],               'admin');
$router->post('/admin/ops/bugs/{id}/comments',               [AdminOpsBugController::class, 'addComment'],           'admin');
$router->delete('/admin/ops/bugs/{id}',                      [AdminOpsBugController::class, 'destroy'],              'admin');

// ─── Kynetropo Ops — Meetings ─────────────────────────────────────────────────
$router->get('/admin/ops/meetings',                          [AdminOpsMeetingController::class, 'index'],            'admin');
$router->post('/admin/ops/meetings',                         [AdminOpsMeetingController::class, 'store'],            'admin');
$router->get('/admin/ops/meetings/{id}',                     [AdminOpsMeetingController::class, 'show'],             'admin');
$router->put('/admin/ops/meetings/{id}',                     [AdminOpsMeetingController::class, 'update'],           'admin');
$router->delete('/admin/ops/meetings/{id}',                  [AdminOpsMeetingController::class, 'destroy'],          'admin');

// ─── Kynetropo Ops — Finance ──────────────────────────────────────────────────
$router->get('/admin/ops/finance/summary',                   [AdminOpsFinanceController::class, 'summary'],          'admin');
$router->get('/admin/ops/finance/payments',                  [AdminOpsFinanceController::class, 'payments'],         'admin');
$router->post('/admin/ops/finance/payments',                 [AdminOpsFinanceController::class, 'addPayment'],       'admin');
$router->put('/admin/ops/finance/payments/{id}',             [AdminOpsFinanceController::class, 'updatePayment'],    'admin');
$router->delete('/admin/ops/finance/payments/{id}',          [AdminOpsFinanceController::class, 'deletePayment'],    'admin');
$router->get('/admin/ops/finance/expenses',                  [AdminOpsFinanceController::class, 'expenses'],         'admin');
$router->post('/admin/ops/finance/expenses',                 [AdminOpsFinanceController::class, 'addExpense'],       'admin');
$router->delete('/admin/ops/finance/expenses/{id}',          [AdminOpsFinanceController::class, 'deleteExpense'],    'admin');

// ─── Kynetropo Ops — AMC ─────────────────────────────────────────────────────
$router->get('/admin/ops/amc',                               [AdminOpsAmcController::class, 'index'],                'admin');
$router->post('/admin/ops/amc',                              [AdminOpsAmcController::class, 'store'],                'admin');
$router->put('/admin/ops/amc/{id}',                          [AdminOpsAmcController::class, 'update'],               'admin');
$router->delete('/admin/ops/amc/{id}',                       [AdminOpsAmcController::class, 'destroy'],              'admin');

// ─── Kynetropo Ops — Pitches ─────────────────────────────────────────────────
$router->get('/admin/ops/pitches',                           [AdminOpsPitchController::class, 'index'],              'admin');
$router->post('/admin/ops/pitches',                          [AdminOpsPitchController::class, 'store'],              'admin');
$router->get('/admin/ops/pitches/{id}',                      [AdminOpsPitchController::class, 'show'],               'admin');
$router->put('/admin/ops/pitches/{id}',                      [AdminOpsPitchController::class, 'update'],             'admin');
$router->delete('/admin/ops/pitches/{id}',                   [AdminOpsPitchController::class, 'destroy'],            'admin');

// ─── Kynetropo Ops — Hiring ──────────────────────────────────────────────────
$router->get('/admin/ops/hiring',                            [AdminOpsHiringController::class, 'index'],             'admin');
$router->post('/admin/ops/hiring',                           [AdminOpsHiringController::class, 'store'],             'admin');
$router->put('/admin/ops/hiring/{id}',                       [AdminOpsHiringController::class, 'update'],            'admin');
$router->delete('/admin/ops/hiring/{id}',                    [AdminOpsHiringController::class, 'destroy'],           'admin');

// ─── Kynetropo Ops — Employees ───────────────────────────────────────────────
$router->get('/admin/ops/employees',                         [AdminOpsEmployeeController::class, 'index'],           'admin');
$router->post('/admin/ops/employees',                        [AdminOpsEmployeeController::class, 'store'],           'admin');
$router->get('/admin/ops/employees/{id}',                    [AdminOpsEmployeeController::class, 'show'],            'admin');
$router->put('/admin/ops/employees/{id}',                    [AdminOpsEmployeeController::class, 'update'],          'admin');
$router->delete('/admin/ops/employees/{id}',                 [AdminOpsEmployeeController::class, 'destroy'],         'admin');
