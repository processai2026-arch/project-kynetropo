<?php
/** @var Router $router */

// ─── Kynetropo Sales Module ───────────────────────────────────────────────────
// Every route sits behind the 'admin' guard (authentication + admin user type);
// each controller then enforces the specific sales permission and record-level
// access, so a sales user cannot reach an admin action by calling it directly.

// Access control (the caller's own permissions are readable by any admin user;
// everything else in this group is gated to sales administrators).
$router->get('/admin/sales/me',                          [AdminSalesAccessController::class, 'me'],              'admin');
$router->get('/admin/sales/permissions',                 [AdminSalesAccessController::class, 'permissions'],     'admin');
$router->get('/admin/sales/users',                       [AdminSalesAccessController::class, 'users'],           'admin');
$router->post('/admin/sales/users',                      [AdminSalesAccessController::class, 'createUser'],      'admin');
$router->put('/admin/sales/users/{id}/permissions',      [AdminSalesAccessController::class, 'setPermissions'],  'admin');
$router->put('/admin/sales/users/{id}/role',             [AdminSalesAccessController::class, 'setRole'],         'admin');
$router->put('/admin/sales/users/{id}/active',           [AdminSalesAccessController::class, 'setActive'],       'admin');
$router->put('/admin/sales/users/{id}/password',         [AdminSalesAccessController::class, 'setPassword'],     'admin');
$router->get('/admin/sales/lockouts',                    [AdminSalesAccessController::class, 'lockouts'],        'admin');
$router->post('/admin/sales/users/{id}/restore-access',  [AdminSalesAccessController::class, 'restoreAccess'],   'admin');

$router->get('/admin/sales/assignable-users',            [AdminSalesAccessController::class, 'assignableUsers'], 'admin');

// ─── Sales AI assistant ───────────────────────────────────────────────────────
// A write-capable, conversational assistant. It answers questions from live
// data and proposes actions (add lead / follow-up / meeting / call / task /
// challenge) that only run after the user confirms — replayed through the
// real REST API with the caller's own JWT, so every permission check applies.
$router->post('/admin/sales-ai/message',                 [SalesAiChatController::class, 'message'],              'admin');
$router->post('/admin/sales-ai/execute',                 [SalesAiChatController::class, 'execute'],              'admin');
$router->get('/admin/sales-ai/conversations',            [SalesAiChatController::class, 'conversations'],        'admin');
$router->get('/admin/sales-ai/conversations/{id}',       [SalesAiChatController::class, 'conversation'],         'admin');
$router->delete('/admin/sales-ai/conversations/{id}',    [SalesAiChatController::class, 'deleteConversation'],   'admin');

// Dashboard + activity
$router->get('/admin/sales/dashboard',                   [AdminSalesDashboardController::class, 'index'],        'admin');
$router->get('/admin/sales/activity',                    [AdminSalesDashboardController::class, 'activity'],     'admin');
$router->get('/admin/sales/notifications',               [AdminSalesDashboardController::class, 'notifications'],'admin');

// Leads (static segments registered before {id})
$router->get('/admin/sales/leads',                       [AdminSalesLeadController::class, 'index'],             'admin');
$router->post('/admin/sales/leads',                      [AdminSalesLeadController::class, 'store'],             'admin');
$router->get('/admin/sales/leads/{id}',                  [AdminSalesLeadController::class, 'show'],              'admin');
$router->put('/admin/sales/leads/{id}',                  [AdminSalesLeadController::class, 'update'],            'admin');
$router->put('/admin/sales/leads/{id}/temperature',      [AdminSalesLeadController::class, 'changeTemperature'], 'admin');
$router->put('/admin/sales/leads/{id}/assign',           [AdminSalesLeadController::class, 'assign'],            'admin');
$router->post('/admin/sales/leads/{id}/onboarding',      [AdminSalesLeadController::class, 'startOnboarding'],   'admin');
$router->post('/admin/sales/leads/{id}/convert',         [AdminSalesLeadController::class, 'convert'],           'admin');
$router->post('/admin/sales/leads/{id}/revert',          [AdminSalesLeadController::class, 'revertStatus'],      'admin');
$router->delete('/admin/sales/leads/{id}',               [AdminSalesLeadController::class, 'destroy'],           'admin');

// Calls
$router->get('/admin/sales/calls/meta',                  [AdminSalesCallController::class, 'meta'],              'admin');
$router->get('/admin/sales/calls/leads',                 [AdminSalesCallController::class, 'byLead'],            'admin');
$router->get('/admin/sales/calls',                       [AdminSalesCallController::class, 'index'],             'admin');
$router->post('/admin/sales/calls',                      [AdminSalesCallController::class, 'store'],             'admin');

// Reports — a fixed catalogue; the id selects a query, it never supplies one.
$router->get('/admin/ops/reports',                       [AdminOpsReportController::class, 'index'],             'admin');
$router->get('/admin/ops/reports/{id}',                  [AdminOpsReportController::class, 'show'],              'admin');

// Follow-ups
$router->get('/admin/sales/followups',                   [AdminSalesFollowupController::class, 'index'],         'admin');
$router->post('/admin/sales/followups',                  [AdminSalesFollowupController::class, 'store'],         'admin');
$router->put('/admin/sales/followups/{id}',              [AdminSalesFollowupController::class, 'update'],        'admin');
$router->post('/admin/sales/followups/{id}/complete',    [AdminSalesFollowupController::class, 'complete'],      'admin');
$router->post('/admin/sales/followups/{id}/cancel',      [AdminSalesFollowupController::class, 'cancel'],        'admin');

// Meetings
$router->get('/admin/sales/meetings',                    [AdminSalesMeetingController::class, 'index'],          'admin');
$router->post('/admin/sales/meetings',                   [AdminSalesMeetingController::class, 'store'],          'admin');
$router->get('/admin/sales/meetings/{id}',               [AdminSalesMeetingController::class, 'show'],           'admin');
$router->put('/admin/sales/meetings/{id}',               [AdminSalesMeetingController::class, 'update'],         'admin');
$router->post('/admin/sales/meetings/{id}/complete',     [AdminSalesMeetingController::class, 'complete'],       'admin');
$router->post('/admin/sales/meetings/{id}/cancel',       [AdminSalesMeetingController::class, 'cancel'],         'admin');

// Challenges — "Challenge Accepted"
$router->get('/admin/sales/challenges',                  [AdminSalesChallengeController::class, 'index'],        'admin');
$router->post('/admin/sales/challenges',                 [AdminSalesChallengeController::class, 'store'],        'admin');
$router->get('/admin/sales/challenges/{id}',             [AdminSalesChallengeController::class, 'show'],         'admin');
$router->put('/admin/sales/challenges/{id}',             [AdminSalesChallengeController::class, 'update'],       'admin');
$router->post('/admin/sales/challenges/{id}/accept',     [AdminSalesChallengeController::class, 'accept'],       'admin');
$router->post('/admin/sales/challenges/{id}/start',      [AdminSalesChallengeController::class, 'start'],        'admin');
$router->post('/admin/sales/challenges/{id}/complete',   [AdminSalesChallengeController::class, 'complete'],     'admin');
$router->post('/admin/sales/challenges/{id}/expire',     [AdminSalesChallengeController::class, 'expire'],       'admin');
$router->post('/admin/sales/challenges/{id}/cancel',     [AdminSalesChallengeController::class, 'cancel'],       'admin');
$router->delete('/admin/sales/challenges/{id}',          [AdminSalesChallengeController::class, 'destroy'],      'admin');

// Tasks — assign work to one person and be told when it comes back. Static
// segments would go before {id}; there are none, so plain order is enough.
$router->get('/admin/sales/tasks',                       [AdminSalesTaskController::class, 'index'],             'admin');
$router->post('/admin/sales/tasks',                      [AdminSalesTaskController::class, 'store'],             'admin');
$router->get('/admin/sales/tasks/{id}',                  [AdminSalesTaskController::class, 'show'],              'admin');
$router->put('/admin/sales/tasks/{id}',                  [AdminSalesTaskController::class, 'update'],            'admin');
$router->post('/admin/sales/tasks/{id}/start',           [AdminSalesTaskController::class, 'start'],             'admin');
$router->post('/admin/sales/tasks/{id}/complete',        [AdminSalesTaskController::class, 'complete'],          'admin');
$router->post('/admin/sales/tasks/{id}/reopen',          [AdminSalesTaskController::class, 'reopen'],            'admin');
$router->post('/admin/sales/tasks/{id}/acknowledge',     [AdminSalesTaskController::class, 'acknowledge'],       'admin');
$router->post('/admin/sales/tasks/{id}/cancel',          [AdminSalesTaskController::class, 'cancel'],            'admin');
$router->post('/admin/sales/tasks/{id}/restore',         [AdminSalesTaskController::class, 'restore'],           'admin');

// Comments — the discussion thread on a lead, call, follow-up, meeting, task or
// challenge. Access follows the record: the controller re-resolves the entity
// and applies the same lead scope before it reads or writes a thread.
$router->get('/admin/push/key',                          [AdminPushController::class, 'key'],                    'admin');
$router->post('/admin/push/subscribe',                   [AdminPushController::class, 'subscribe'],              'admin');
$router->post('/admin/push/unsubscribe',                 [AdminPushController::class, 'unsubscribe'],            'admin');
$router->post('/admin/push/test',                        [AdminPushController::class, 'test'],                   'admin');

$router->post('/admin/sales/mentions/read',              [AdminSalesMentionController::class, 'read'],           'admin');

$router->get('/admin/sales/comments',                    [AdminSalesCommentController::class, 'index'],          'admin');
$router->post('/admin/sales/comments',                   [AdminSalesCommentController::class, 'store'],          'admin');
$router->post('/admin/sales/comments/{id}/restore',      [AdminSalesCommentController::class, 'restore'],        'admin');
$router->put('/admin/sales/comments/{id}',               [AdminSalesCommentController::class, 'update'],         'admin');
$router->delete('/admin/sales/comments/{id}',            [AdminSalesCommentController::class, 'destroy'],        'admin');
