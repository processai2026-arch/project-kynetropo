<?php
/**
 * CRM and invoice actions the Sales AI assistant can take.
 *
 * No page calls these any more: the CRM and invoicing screens were removed. The
 * assistant (SalesAiChatController) still offers them, and runs each confirmed
 * action by calling the route below with the user's own token, so these must
 * stay registered while api/ai/sales-endpoint-catalog.json lists them.
 */

/** @var Router $router */

$router->post('/admin/crm/leads',                        [AdminCrmController::class, 'leadsStore'],              'admin');
$router->put('/admin/crm/leads/{id}',                    [AdminCrmController::class, 'leadsUpdate'],             'admin');
$router->post('/admin/crm/deals',                        [AdminCrmController::class, 'dealsStore'],              'admin');
$router->put('/admin/crm/deals/{id}',                    [AdminCrmController::class, 'dealsUpdate'],             'admin');
$router->put('/admin/crm/deals/{id}/stage',              [AdminCrmController::class, 'dealsChangeStage'],        'admin');
$router->post('/admin/crm/activities',                   [AdminCrmController::class, 'activitiesStore'],         'admin');

$router->post('/admin/invoices/{id}/payments',           [AdminPaymentController::class, 'storeForInvoice'],     'admin:owner,accountant');
$router->post('/admin/invoices/{id}/reminders',          [AdminInvoiceController::class, 'sendPaymentReminder'], 'admin');
