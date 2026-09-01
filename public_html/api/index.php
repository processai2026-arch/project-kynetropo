<?php
declare(strict_types=1);

// --- Bootstrap ----------------------------------------------------------------
define('ROOT_PATH', __DIR__);

require_once ROOT_PATH . '/config/app.php';
require_once ROOT_PATH . '/core/Response.php';

// --- Error handling -----------------------------------------------------------
if (defined('APP_ENV') && APP_ENV === 'production') {
    error_reporting(0);
    ini_set('display_errors', '0');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
}

set_exception_handler(function (Throwable $e) {
    error_log('[Unhandled] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (class_exists('Response')) {
        Response::error(
            (!defined('APP_ENV') || APP_ENV === 'development') ? $e->getMessage() : 'Internal server error',
            500
        );
    } else {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Internal server error']);
    }
});

// --- CORS ---------------------------------------------------------------------
$_allowedOrigins = array_filter(array_map('trim', explode(',', defined('CORS_ORIGIN') ? CORS_ORIGIN : '')));
$_allowedOrigins[] = 'http://localhost:8080';
$_allowedOrigins[] = 'http://localhost:8081';
$_allowedOrigins[] = 'https://krish-agencies.kynetropo.com';
$_allowedOrigins[] = 'http://localhost:5173';          // local dev
$_requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$_corsHeader = in_array($_requestOrigin, $_allowedOrigins, true) ? $_requestOrigin : ($_allowedOrigins[0] ?? 'https://api.kynetropo.com');
header('Access-Control-Allow-Origin: ' . $_corsHeader);
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Client-Type, X-Tenant');
header('Access-Control-Max-Age: 86400'); // cache preflight 24h so the browser stops re-sending OPTIONS before every request
unset($_allowedOrigins, $_requestOrigin, $_corsHeader);
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- JWT secret guard ---------------------------------------------------------
if (
    !defined('JWT_SECRET') ||
    strlen(JWT_SECRET) < 32 ||
    JWT_SECRET === 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING_AT_LEAST_64_CHARS'
) {
    error_log('[Config] JWT_SECRET is missing or is still the default placeholder');
    Response::error('Server misconfiguration', 500);
}

// --- 415 Unsupported Media Type -----------------------------------------------
$requestMethod = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$contentType   = $_SERVER['CONTENT_TYPE'] ?? '';

if (
    in_array($requestMethod, ['POST', 'PUT', 'PATCH'], true) &&
    !empty($contentType) &&
    !str_contains($contentType, 'application/json') &&
    !str_contains($contentType, 'application/x-www-form-urlencoded') &&
    !str_contains($contentType, 'multipart/form-data')
) {
    Response::error('Unsupported Media Type. Use application/json', 415);
}

// --- Requires -----------------------------------------------------------------
require_once ROOT_PATH . '/config/database.php';
require_once ROOT_PATH . '/config/tenancy.php';        // multi-tenant config + TENANCY_ENABLED switch
require_once ROOT_PATH . '/core/AppException.php';
require_once ROOT_PATH . '/core/PlatformDB.php';       // control-plane DB connection
require_once ROOT_PATH . '/core/TenantContext.php';    // per-request tenant resolution + plan gating
require_once ROOT_PATH . '/core/TenantScope.php';      // dev tripwire: unscoped tenant-table queries
require_once ROOT_PATH . '/core/Database.php';
require_once ROOT_PATH . '/core/Request.php';
require_once ROOT_PATH . '/core/Router.php';
require_once ROOT_PATH . '/services/NumberSequence.php';
require_once ROOT_PATH . '/services/FileStore.php';
require_once ROOT_PATH . '/services/ImportEngine.php';
require_once ROOT_PATH . '/services/SmartAllocationEngine.php';
require_once ROOT_PATH . '/services/MovementEngine.php';
require_once ROOT_PATH . '/services/InventoryIntelligence.php';
require_once ROOT_PATH . '/services/ReorderIntelligence.php';
require_once ROOT_PATH . '/services/ApprovalWorkflow.php';
require_once ROOT_PATH . '/services/GstinLookupService.php';
require_once ROOT_PATH . '/helpers/JWT.php';
require_once ROOT_PATH . '/helpers/Mailer.php';
require_once ROOT_PATH . '/helpers/Validator.php';
require_once ROOT_PATH . '/helpers/InventoryPermissions.php';
require_once ROOT_PATH . '/middleware/AuthMiddleware.php';

require_once ROOT_PATH . '/models/User.php';
require_once ROOT_PATH . '/models/Product.php';
require_once ROOT_PATH . '/models/Order.php';
require_once ROOT_PATH . '/models/Employee.php';
require_once ROOT_PATH . '/models/AttendanceShift.php';
require_once ROOT_PATH . '/models/Attendance.php';
require_once ROOT_PATH . '/models/AttendanceAnalytics.php';
require_once ROOT_PATH . '/models/Payroll.php';
require_once ROOT_PATH . '/models/PayrollRun.php';
require_once ROOT_PATH . '/models/EmployeeAdvance.php';
require_once ROOT_PATH . '/models/Task.php';
require_once ROOT_PATH . '/models/Meeting.php';
require_once ROOT_PATH . '/models/EmployeeCompliance.php';
require_once ROOT_PATH . '/models/HrImport.php';
require_once ROOT_PATH . '/models/MeetingMedia.php';
require_once ROOT_PATH . '/models/DataImportMapper.php';
require_once ROOT_PATH . '/models/DataExportService.php';
require_once ROOT_PATH . '/models/BackupService.php';
require_once ROOT_PATH . '/models/Sop.php';
require_once ROOT_PATH . '/models/Workflow.php';
require_once ROOT_PATH . '/models/Insights.php';
require_once ROOT_PATH . '/models/Vendor.php';
require_once ROOT_PATH . '/models/PurchaseRequest.php';
require_once ROOT_PATH . '/models/Inventory.php';
require_once ROOT_PATH . '/models/InventoryProduct.php';
require_once ROOT_PATH . '/models/InventoryZone.php';
require_once ROOT_PATH . '/models/InventoryStock.php';
require_once ROOT_PATH . '/models/InventoryMovement.php';
require_once ROOT_PATH . '/models/InventoryAllocation.php';
require_once ROOT_PATH . '/models/PurchaseOrder.php';
require_once ROOT_PATH . '/models/Payment.php';
require_once ROOT_PATH . '/models/SalesDocument.php';
require_once ROOT_PATH . '/models/TestCertificate.php';
require_once ROOT_PATH . '/models/GstCompliance.php';
require_once ROOT_PATH . '/models/DealerNetwork.php';
require_once ROOT_PATH . '/models/FinanceAnalytics.php';
require_once ROOT_PATH . '/models/Lead.php';
require_once ROOT_PATH . '/models/Deal.php';
require_once ROOT_PATH . '/models/CrmActivity.php';
require_once ROOT_PATH . '/models/VendorCredit.php';
require_once ROOT_PATH . '/models/Role.php';
require_once ROOT_PATH . '/models/ChatConversation.php';
require_once ROOT_PATH . '/models/ChatMessage.php';
require_once ROOT_PATH . '/models/Account.php';
require_once ROOT_PATH . '/models/JournalEntry.php';
require_once ROOT_PATH . '/models/JournalLine.php';
require_once ROOT_PATH . '/models/LeaveType.php';
require_once ROOT_PATH . '/models/LeaveRequest.php';
require_once ROOT_PATH . '/models/LeaveBalance.php';
require_once ROOT_PATH . '/models/QueryThread.php';
require_once ROOT_PATH . '/helpers/GroqAPI.php';
require_once ROOT_PATH . '/middleware/PlatformAuthMiddleware.php';
require_once ROOT_PATH . '/controllers/AuthController.php';
require_once ROOT_PATH . '/controllers/SignupController.php';
// Legacy storefront/dealer controllers — not part of the invoice build.
// Load only if present so their absence doesn't take down the whole API.
foreach ([
    '/controllers/PlatformAdminController.php',
    '/controllers/UserController.php',
    '/controllers/ProductController.php',
    '/controllers/OrderController.php',
    '/controllers/StatisticsController.php',
    '/controllers/QueryController.php',
    '/controllers/QuoteController.php',
    '/controllers/DealerWorkspaceController.php',
] as $_legacy) {
    if (is_file(ROOT_PATH . $_legacy)) require_once ROOT_PATH . $_legacy;
}
unset($_legacy);

// Admin
require_once ROOT_PATH . '/middleware/AdminMiddleware.php';
require_once ROOT_PATH . '/middleware/CustomerMiddleware.php';
require_once ROOT_PATH . '/middleware/EmployeeMiddleware.php';
require_once ROOT_PATH . '/controllers/admin/AdminUserController.php';
require_once ROOT_PATH . '/controllers/admin/AdminProductController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceProductController.php';
require_once ROOT_PATH . '/controllers/admin/AdminQuoteController.php';
require_once ROOT_PATH . '/controllers/admin/AdminCrmController.php';
require_once ROOT_PATH . '/controllers/admin/AdminQueryController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSettingsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminQuotationController.php';
require_once ROOT_PATH . '/controllers/admin/AdminQuotationComponentController.php';
require_once ROOT_PATH . '/controllers/admin/AdminBillingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminPricingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminExpenseController.php';
require_once ROOT_PATH . '/controllers/admin/AdminFinanceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminReportsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminTaskController.php';
require_once ROOT_PATH . '/controllers/admin/AdminEmployeeController.php';
require_once ROOT_PATH . '/controllers/admin/AdminAttendanceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminPayrollController.php';
require_once ROOT_PATH . '/controllers/admin/AdminEmployeeAdvanceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminFaqController.php';
require_once ROOT_PATH . '/controllers/admin/AdminMeetingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminWorkflowController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSopController.php';
require_once ROOT_PATH . '/helpers/GroqClient.php';
require_once ROOT_PATH . '/helpers/DataBridge.php';
require_once ROOT_PATH . '/controllers/ChatController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInsightsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminNotificationController.php';
require_once ROOT_PATH . '/controllers/admin/AdminGstLookupController.php';
require_once ROOT_PATH . '/controllers/admin/AdminAttachmentController.php';
require_once ROOT_PATH . '/controllers/admin/AdminImportController.php';
require_once ROOT_PATH . '/controllers/admin/AdminVendorController.php';
require_once ROOT_PATH . '/controllers/admin/AdminRoleController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSecurityController.php';
require_once ROOT_PATH . '/controllers/admin/AdminPurchaseRequestController.php';
require_once ROOT_PATH . '/controllers/admin/AdminProcurementController.php';
require_once ROOT_PATH . '/controllers/admin/AdminPurchaseOrderController.php';
require_once ROOT_PATH . '/controllers/admin/AdminGoodsReceiptController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInventoryController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryProductController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryZoneController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryStockController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryAllocationController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryMovementController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryIntelligenceController.php';
require_once ROOT_PATH . '/controllers/admin/ReorderIntelligenceController.php';
require_once ROOT_PATH . '/controllers/admin/InventoryApprovalController.php';
require_once ROOT_PATH . '/controllers/admin/AdminPaymentController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesDocumentController.php';
require_once ROOT_PATH . '/controllers/admin/AdminTestCertificateController.php';
require_once ROOT_PATH . '/controllers/admin/AdminGstComplianceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminDealerController.php';
require_once ROOT_PATH . '/controllers/admin/AdminFinancePlanningController.php';
require_once ROOT_PATH . '/controllers/admin/AdminComplianceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminAttendanceAnalyticsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminHrImportController.php';
require_once ROOT_PATH . '/controllers/admin/AdminMeetingMediaController.php';
require_once ROOT_PATH . '/controllers/admin/AdminDataInteropController.php';
require_once ROOT_PATH . '/controllers/admin/AdminLedgerController.php';
require_once ROOT_PATH . '/controllers/admin/AdminLeaveController.php';

// ─── Invoice Processing Module ────────────────────────────────────────────────
require_once ROOT_PATH . '/services/InvoiceProcessingService.php';
require_once ROOT_PATH . '/controllers/admin/AdminScanInvoiceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceProductCatalogController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceCustomerController.php';
require_once ROOT_PATH . '/controllers/admin/AdminMarketplaceExpenseController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceNotificationController.php';
require_once ROOT_PATH . '/controllers/admin/AdminMarketplaceSalesController.php';
require_once ROOT_PATH . '/controllers/admin/AdminGSTController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceAccountingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminMarketplaceAnalyticsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceProductMappingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceDashboardController.php';
require_once ROOT_PATH . '/controllers/admin/AdminDamagedStockController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceAuditLogController.php';
require_once ROOT_PATH . '/controllers/admin/AdminDropdownOptionsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOutstandingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceBankStatementController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoiceReportsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminProductMappingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminStaffController.php';
require_once ROOT_PATH . '/controllers/admin/AdminInvoicePaymentsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminPdfSplitterController.php';

// --- Routes -------------------------------------------------------------------
$router = new Router();

// Public self-service signup / pricing
$router->get('/plans',  [SignupController::class, 'plans']);
$router->post('/signup', [SignupController::class, 'signup']);

// Super-admin (control plane) — Kynetropo staff manage all tenants.
$router->post('/platform/login',                  [PlatformAdminController::class, 'login']);
$router->get('/platform/stats',                   [PlatformAdminController::class, 'stats'],   'platform');
$router->get('/platform/tenants',                 [PlatformAdminController::class, 'tenants'], 'platform');
$router->post('/platform/tenants/{id}/suspend',   [PlatformAdminController::class, 'suspend'], 'platform');
$router->post('/platform/tenants/{id}/resume',    [PlatformAdminController::class, 'resume'],  'platform');
$router->get('/platform/plans',                   [PlatformAdminController::class, 'plans'],   'platform');

// Billing (tenant subscription). Webhook is PUBLIC (Razorpay-signed); rest admin.
$router->get('/admin/billing',            [AdminBillingController::class, 'show'],      'admin');
$router->post('/admin/billing/subscribe', [AdminBillingController::class, 'subscribe'], 'admin');
$router->post('/admin/billing/change-plan', [AdminBillingController::class, 'changePlan'], 'admin');
$router->post('/admin/billing/cancel',      [AdminBillingController::class, 'cancel'],     'admin');
$router->post('/admin/billing/resume',      [AdminBillingController::class, 'resume'],     'admin');
$router->get('/admin/billing/history',      [AdminBillingController::class, 'history'],    'admin');
$router->get('/platform/billing/metrics',   [AdminBillingController::class, 'metrics'],    'admin');
$router->post('/billing/webhook',         [AdminBillingController::class, 'webhook']);

// Auth - public
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/login',    [AuthController::class, 'login']);
$router->post('/auth/refresh',  [AuthController::class, 'refresh']);
$router->post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
$router->post('/auth/send-otp',        [AuthController::class, 'sendOtp']);
$router->post('/auth/verify-otp',      [AuthController::class, 'verifyOtp']);
$router->post('/auth/reset-password',  [AuthController::class, 'resetPassword']);
$router->post('/auth/logout',   [AuthController::class, 'logout'],  true);
$router->get('/auth/me',        [AuthController::class, 'me'],      true);

// Users
$router->get('/users/{id}',               [UserController::class, 'show'],           true);
$router->get('/users/email/{email}',      [UserController::class, 'findByEmail'],    true);
$router->put('/users/{id}',               [UserController::class, 'update'],         true);
$router->put('/users/{id}/password',      [UserController::class, 'changePassword'], true);
$router->delete('/users/{id}',            [UserController::class, 'deactivate'],     true);
$router->get('/users/{userId}/orders',    [UserController::class, 'orders'],         true);

// Products - public read
$router->get('/products',                              [ProductController::class, 'index']);
$router->get('/products/sub-purposes',                 [ProductController::class, 'subPurposes']);
$router->get('/products/{id}',                         [ProductController::class, 'show']);
$router->get('/products/{id}/configurations',          [ProductController::class, 'configurations']);
$router->get('/products/{id}/price',                   [ProductController::class, 'price']);   // ?size=8mm[&purpose=...]
$router->get('/products/{id}/sizes',                   [ProductController::class, 'sizes']);    // distinct available sizes

// Orders
$router->get('/orders',          [OrderController::class, 'index'],         true);
$router->post('/orders',         [OrderController::class, 'store'],         true);
$router->get('/orders/{id}',     [OrderController::class, 'show'],          true);
$router->put('/orders/{id}/status',         [OrderController::class, 'updateStatus'],        true);
$router->put('/orders/{id}/payment',        [OrderController::class, 'updatePayment'],       true);
$router->put('/orders/{id}/payment-status', [OrderController::class, 'updatePaymentStatus'], true);
$router->put('/orders/{id}/refund-status',  [OrderController::class, 'updateRefundStatus'],  true);

// Statistics
// Tenant-wide dashboard stats are admin-only (was: any authenticated tenant user).
$router->get('/statistics/orders',        [StatisticsController::class, 'orders'],       'admin');
$router->get('/statistics/active-orders', [StatisticsController::class, 'activeOrders'], 'admin');
$router->get('/statistics/overview',      [StatisticsController::class, 'overview'],     'admin');
$router->get('/statistics/employees',     [StatisticsController::class, 'employees'],    'admin');
$router->get('/statistics/tasks',         [StatisticsController::class, 'tasks'],        'admin');
$router->get('/statistics/sales',         [StatisticsController::class, 'sales'],        'admin');
$router->get('/statistics/revenue',       [StatisticsController::class, 'revenue'],      'admin');
$router->get('/statistics/customers',     [StatisticsController::class, 'customers'],    'admin');

// Public Queries & Quotes
$router->post('/queries', [QueryController::class, 'store']); // Auth optional (handled if token sent? Actually without AuthMiddleware user is null but that's fine for guests)

$router->post('/quotes',  [QuoteController::class, 'store'], true); // Auth REQUIRED for quotes

// Dealer Workspace (role-scoped)
$router->get('/dealer/profile',       [DealerWorkspaceController::class, 'profile'],       'dealer');
$router->get('/dealer/dashboard',     [DealerWorkspaceController::class, 'dashboard'],     'dealer');
$router->get('/dealer/customers',     [DealerWorkspaceController::class, 'customers'],     'dealer');
$router->post('/dealer/customers',    [DealerWorkspaceController::class, 'storeCustomer'], 'dealer');
$router->put('/dealer/customers/{id}',[DealerWorkspaceController::class, 'updateCustomer'],'dealer');
$router->get('/dealer/price-list',    [DealerWorkspaceController::class, 'priceList'],     'dealer');
$router->get('/dealer/orders',        [DealerWorkspaceController::class, 'orders'],        'dealer');
$router->post('/dealer/orders',       [DealerWorkspaceController::class, 'storeOrder'],    'dealer');
$router->get('/dealer/statement',     [DealerWorkspaceController::class, 'statement'],     'dealer');

// --- Admin Routes (auth = 'admin' -> AuthMiddleware + AdminMiddleware) ---------

// Admin Users
$router->get('/admin/users/pending',           [AdminUserController::class, 'pending'],    'admin');
$router->post('/admin/users/{id}/approve',     [AdminUserController::class, 'approve'],    'admin');
$router->post('/admin/users/{id}/reject',      [AdminUserController::class, 'reject'],     'admin');
$router->get('/admin/users/{id}/stats',        [AdminUserController::class, 'orderStats'], 'admin');
$router->get('/admin/users',                   [AdminUserController::class, 'index'],      'admin');
$router->put('/admin/users/{id}/status',       [AdminUserController::class, 'updateStatus'],'admin');
$router->post('/admin/users',               [AdminUserController::class,    'store'],        'admin');
$router->put('/admin/users/{id}',           [AdminUserController::class,    'update'],       'admin');
$router->delete('/admin/users/{id}',        [AdminUserController::class,    'destroy'],      'admin');

// Customer master detail + retention intelligence (database/create_customers_extra.sql)
$router->get('/admin/users/{id}/detail',            [AdminUserController::class, 'detail'],          'admin');
$router->post('/admin/users/{id}/reset-password',   [AdminUserController::class, 'resetPassword'],   'admin');
$router->post('/admin/users/{id}/recompute-health', [AdminUserController::class, 'recomputeHealth'], 'admin');
$router->get('/admin/customers/health',             [AdminUserController::class, 'customerHealth'],  'admin');

// Admin Dealer Network and Customer Intelligence
$router->get('/admin/dealers',                       [AdminDealerController::class, 'index'],                 'admin:owner,sales,accountant');
$router->get('/admin/dealers/{id}',                   [AdminDealerController::class, 'show'],                  'admin:owner,sales,accountant');
$router->get('/admin/dealer-price-lists',             [AdminDealerController::class, 'priceLists'],            'admin:owner,sales');
$router->post('/admin/dealer-price-lists',            [AdminDealerController::class, 'createPriceList'],       'admin:owner,sales');
$router->put('/admin/dealer-price-lists/{id}/items',  [AdminDealerController::class, 'updatePriceItems'],      'admin:owner,sales');
$router->get('/admin/dealer-price-lists/{id}',        [AdminDealerController::class, 'showPriceList'],         'admin:owner,sales,accountant');
$router->put('/admin/dealer-price-lists/{id}',        [AdminDealerController::class, 'updatePriceList'],       'admin:owner,sales');
$router->get('/admin/dealer-customers/conflicts',     [AdminDealerController::class, 'conflicts'],             'admin:owner,sales');
$router->get('/admin/dealer-customers',               [AdminDealerController::class, 'dealerCustomers'],       'admin:owner,sales,accountant');
$router->post('/admin/dealer-customers/{id}/resolve', [AdminDealerController::class, 'resolveDealerCustomer'], 'admin:owner,sales');
$router->post('/admin/customers/merge',               [AdminDealerController::class, 'mergeCustomers'],        'admin:owner');
$router->get('/admin/customers/analytics/summary',    [AdminDealerController::class, 'analyticsSummary'],      'admin:owner,accountant,sales');
$router->post('/admin/customer-metrics/recompute',    [AdminDealerController::class, 'recomputeMetrics'],      'admin:owner,accountant');
$router->get('/admin/customers/{id}/analytics',       [AdminDealerController::class, 'customerAnalytics'],     'admin:owner,accountant,sales');
$router->get('/admin/dealer-price-simulation',        [AdminDealerController::class, 'priceSimulation'],       'admin:owner,sales,accountant');

// Admin Products
$router->get('/admin/products/{id}/variants',          [AdminProductController::class, 'variants'],       'admin');
$router->post('/admin/products/{id}/variants',         [AdminProductController::class, 'storeVariant'],   'admin');
$router->put('/admin/products/{id}/variants/{vid}',    [AdminProductController::class, 'updateVariant'],  'admin');
$router->delete('/admin/products/{id}/variants/{vid}', [AdminProductController::class, 'destroyVariant'], 'admin');
$router->get('/admin/products/{id}/kit',               [AdminProductController::class, 'kit'],            'admin');
$router->put('/admin/products/{id}/kit',               [AdminProductController::class, 'updateKit'],      'admin');
// ─── Template product write routes — overridden by Krish AdminProductsController ─
// $router->post('/admin/products',             [AdminProductController::class,  'store'],   'admin');
// $router->put('/admin/products/{id}',         [AdminProductController::class,  'update'],  'admin');
// $router->delete('/admin/products/{id}',      [AdminProductController::class,  'destroy'], 'admin');

// Admin Product Pricing (size-based configurations)
$router->get('/admin/products/{id}/configurations',          [AdminPricingController::class, 'index'],   'admin');
$router->post('/admin/products/{id}/configurations',         [AdminPricingController::class, 'store'],   'admin');
$router->put('/admin/products/{id}/configurations/{cid}',    [AdminPricingController::class, 'update'],  'admin');
$router->delete('/admin/products/{id}/configurations/{cid}', [AdminPricingController::class, 'destroy'], 'admin');

// Admin reusable pricing
$router->get('/admin/pricing/resolve',                  [AdminPricingController::class, 'resolvePrice'],                 'admin');
$router->get('/admin/pricing/price-lists',              [AdminPricingController::class, 'priceLists'],                   'admin');
$router->post('/admin/pricing/price-lists',             [AdminPricingController::class, 'storePriceList'],               'admin');
$router->put('/admin/pricing/price-lists/{id}/items',   [AdminPricingController::class, 'replacePriceListItemsAction'],  'admin');
$router->get('/admin/pricing/price-lists/{id}',         [AdminPricingController::class, 'showPriceList'],                'admin');
$router->put('/admin/pricing/price-lists/{id}',         [AdminPricingController::class, 'updatePriceList'],              'admin');
$router->delete('/admin/pricing/price-lists/{id}',      [AdminPricingController::class, 'destroyPriceList'],             'admin');

// Admin Procurement - Vendors
$router->get('/admin/vendors',                  [AdminVendorController::class, 'index'],       'admin');
$router->post('/admin/vendors',                 [AdminVendorController::class, 'store'],       'admin:owner,accountant');
$router->get('/admin/vendors/{id}/performance', [AdminVendorController::class, 'performance'], 'admin');
$router->get('/admin/vendors/{id}',             [AdminVendorController::class, 'show'],        'admin');
$router->put('/admin/vendors/{id}',             [AdminVendorController::class, 'update'],      'admin:owner,accountant');
$router->delete('/admin/vendors/{id}',          [AdminVendorController::class, 'destroy'],     'admin:owner,accountant');
$router->get('/admin/vendor-credits',           [AdminVendorController::class, 'creditsIndex'],  'admin');
$router->post('/admin/vendor-credits',          [AdminVendorController::class, 'creditStore'],   'admin:owner,accountant');
$router->get('/admin/vendor-credits/{id}',      [AdminVendorController::class, 'creditShow'],    'admin');
$router->post('/admin/vendor-credits/{id}/status', [AdminVendorController::class, 'creditStatus'], 'admin:owner,accountant');

// RBAC roles/permissions
$router->get('/admin/roles/permissions',     [AdminRoleController::class, 'permissions'], 'admin');
$router->get('/admin/roles',                 [AdminRoleController::class, 'index'],       'admin');
$router->post('/admin/roles',                [AdminRoleController::class, 'store'],       'admin');
$router->put('/admin/roles/{id}',            [AdminRoleController::class, 'update'],      'admin');
$router->delete('/admin/roles/{id}',         [AdminRoleController::class, 'destroy'],     'admin');
$router->post('/admin/roles/{id}/assign',    [AdminRoleController::class, 'assign'],      'admin');
$router->post('/admin/roles/{id}/unassign',  [AdminRoleController::class, 'unassign'],    'admin');
$router->get('/admin/users/{id}/permissions',[AdminRoleController::class, 'userPermissions'], 'admin');

// Account security: MFA + audit log
$router->get('/admin/security/mfa',          [AdminSecurityController::class, 'mfaStatus'],  'admin');
$router->post('/admin/security/mfa/enroll',  [AdminSecurityController::class, 'mfaEnroll'],  'admin');
$router->post('/admin/security/mfa/verify',  [AdminSecurityController::class, 'mfaVerify'],  'admin');
$router->post('/admin/security/mfa/disable', [AdminSecurityController::class, 'mfaDisable'], 'admin');
$router->get('/admin/security/audit',        [AdminSecurityController::class, 'auditLog'],   'admin');

// Admin Procurement - Purchase Requests
$router->get('/admin/procurement/cockpit',            [AdminProcurementController::class, 'cockpit'],        'admin');
$router->get('/admin/procurement/reorder',            [AdminProcurementController::class, 'reorder'],        'admin');
$router->get('/admin/procurement/product-insight',    [AdminProcurementController::class, 'productInsight'],  'admin');
$router->get('/admin/purchase-requests',              [AdminPurchaseRequestController::class, 'index'],   'admin');
$router->post('/admin/purchase-requests',             [AdminPurchaseRequestController::class, 'store'],   'admin:owner,accountant,store_keeper');
$router->get('/admin/purchase-requests/{id}',         [AdminPurchaseRequestController::class, 'show'],    'admin');
$router->put('/admin/purchase-requests/{id}',         [AdminPurchaseRequestController::class, 'update'],  'admin:owner,accountant,store_keeper');
$router->post('/admin/purchase-requests/{id}/submit', [AdminPurchaseRequestController::class, 'submit'],  'admin:owner,accountant,store_keeper');
$router->post('/admin/purchase-requests/{id}/approve',[AdminPurchaseRequestController::class, 'approve'], 'admin:owner,accountant');
$router->post('/admin/purchase-requests/{id}/reject', [AdminPurchaseRequestController::class, 'reject'],  'admin:owner,accountant');
$router->delete('/admin/purchase-requests/{id}',      [AdminPurchaseRequestController::class, 'destroy'], 'admin:owner,accountant,store_keeper');

// Admin Procurement - Purchase Orders and Goods Receipts
$router->get('/admin/purchase-orders',                    [AdminPurchaseOrderController::class, 'index'],      'admin');
$router->post('/admin/purchase-orders',                   [AdminPurchaseOrderController::class, 'store'],      'admin:owner,accountant');
$router->get('/admin/purchase-orders/{id}/pdf',           [AdminPurchaseOrderController::class, 'pdf'],        'admin');
$router->post('/admin/purchase-orders/{id}/issue',        [AdminPurchaseOrderController::class, 'issue'],      'admin:owner,accountant');
$router->post('/admin/purchase-orders/{id}/cancel',       [AdminPurchaseOrderController::class, 'cancel'],     'admin:owner,accountant');
$router->post('/admin/purchase-orders/{id}/short-close',  [AdminPurchaseOrderController::class, 'shortClose'], 'admin:owner');
$router->post('/admin/purchase-orders/{id}/bill',         [AdminPurchaseOrderController::class, 'bill'],       'admin:owner,accountant');
$router->post('/admin/purchase-orders/{id}/receipts',     [AdminPurchaseOrderController::class, 'receive'],    'admin:owner,store_keeper');
$router->get('/admin/purchase-orders/{id}/payments',      [AdminPaymentController::class, 'poPayments'],       'admin');
$router->post('/admin/purchase-orders/{id}/payments',     [AdminPaymentController::class, 'storeForPurchaseOrder'], 'admin:owner,accountant');
$router->get('/admin/purchase-orders/{id}',               [AdminPurchaseOrderController::class, 'show'],       'admin');
$router->put('/admin/purchase-orders/{id}',               [AdminPurchaseOrderController::class, 'update'],     'admin:owner,accountant');

$router->get('/admin/goods-receipts',                     [AdminGoodsReceiptController::class, 'index'],       'admin');
$router->get('/admin/goods-receipts/{id}',                [AdminGoodsReceiptController::class, 'show'],        'admin');
$router->post('/admin/goods-receipts/{id}/void',          [AdminGoodsReceiptController::class, 'void'],        'admin:owner');

// Admin Inventory
$router->get('/admin/inventory',                          [AdminInventoryController::class, 'index'],          'admin');
$router->get('/admin/inventory/valuation',                [AdminInventoryController::class, 'valuation'],      'admin');
$router->get('/admin/inventory/locations',                [AdminInventoryController::class, 'locations'],      'admin');
$router->post('/admin/inventory/adjustments',             [AdminInventoryController::class, 'adjustment'],     'admin:owner,store_keeper');
$router->post('/admin/inventory/reconcile',               [AdminInventoryController::class, 'reconcile'],      'admin:owner');
$router->get('/admin/inventory/{productId}/movements',    [AdminInventoryController::class, 'movements'],      'admin');

// Smart Inventory — Products (static routes before {id} so /search & literals win)
$router->get('/admin/inventory/products/search',          [InventoryProductController::class, 'search'],   'admin');
$router->get('/admin/inventory/products',                 [InventoryProductController::class, 'index'],    'admin');
$router->post('/admin/inventory/products',                [InventoryProductController::class, 'store'],    'admin:owner,store_keeper');
$router->get('/admin/inventory/products/{id}',            [InventoryProductController::class, 'show'],     'admin');
$router->put('/admin/inventory/products/{id}',            [InventoryProductController::class, 'update'],   'admin:owner,store_keeper');
$router->delete('/admin/inventory/products/{id}',         [InventoryProductController::class, 'destroy'],  'admin:owner,store_keeper');

// Smart Inventory — Zones (static routes before {id})
$router->get('/admin/inventory/zones/active',             [InventoryZoneController::class, 'getActive'],   'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/zones/distribution',       [InventoryAllocationController::class, 'getZoneDistribution'], 'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/zones',                    [InventoryZoneController::class, 'index'],       'admin:owner,store_keeper,accountant');
$router->post('/admin/inventory/zones',                   [InventoryZoneController::class, 'store'],       'admin:owner,store_keeper');
$router->get('/admin/inventory/zones/{id}',               [InventoryZoneController::class, 'show'],        'admin:owner,store_keeper,accountant');
$router->put('/admin/inventory/zones/{id}',               [InventoryZoneController::class, 'update'],      'admin:owner,store_keeper');

// Smart Inventory — Stock (static routes before {productId})
$router->post('/admin/inventory/stock/receive',           [InventoryStockController::class, 'receiveStock'],  'admin:owner,store_keeper');
$router->post('/admin/inventory/stock/quality-check',     [InventoryStockController::class, 'qualityCheck'],  'admin:owner,store_keeper');
$router->post('/admin/inventory/stock/bulk-import',       [InventoryStockController::class, 'bulkImport'],    'admin:owner,store_keeper');
$router->get('/admin/inventory/stock/low-stock',          [InventoryStockController::class, 'getLowStock'],   'admin');
$router->get('/admin/inventory/stock/barcode',            [InventoryStockController::class, 'barcodeLookup'],         'admin');
$router->get('/admin/inventory/stock/tracked/{productId}',[InventoryStockController::class, 'getTrackedProductStock'],'admin');
$router->get('/admin/inventory/stock/{productId}',        [InventoryStockController::class, 'getProductStock'], 'admin');

// Smart Inventory — Allocation Engine (static routes before {productId})
$router->post('/admin/inventory/allocate',                [InventoryAllocationController::class, 'triggerAllocation'],   'admin:owner,store_keeper');
$router->post('/admin/inventory/allocate/manual',         [InventoryAllocationController::class, 'manualOverride'],      'admin:owner,store_keeper');
$router->get('/admin/inventory/allocate/pending',         [InventoryAllocationController::class, 'getPendingAllocations'], 'admin:owner,store_keeper');
$router->get('/admin/inventory/allocate/{productId}',     [InventoryAllocationController::class, 'getAllocationHistory'], 'admin:owner,store_keeper');

// Smart Inventory — Movement Engine
// (static + 2-segment routes registered before /movements/{id})
$router->get('/admin/inventory/movements',                       [InventoryMovementController::class, 'index'],            'admin');
$router->post('/admin/inventory/movements/employee-issue',       [InventoryMovementController::class, 'employeeIssue'],    'admin:owner,store_keeper,hr');
$router->post('/admin/inventory/movements/dealer-allocation',    [InventoryMovementController::class, 'dealerAllocation'], 'admin:owner,store_keeper,sales');
$router->post('/admin/inventory/movements/production-use',       [InventoryMovementController::class, 'productionUse'],    'admin:owner,store_keeper');
$router->post('/admin/inventory/movements/transfer',             [InventoryMovementController::class, 'zoneTransfer'],     'admin:owner,store_keeper');
$router->get('/admin/inventory/transfers',                       [InventoryMovementController::class, 'transferOrders'],      'admin');
$router->post('/admin/inventory/transfers',                      [InventoryMovementController::class, 'createTransferOrder'], 'admin');
$router->post('/admin/inventory/transfers/{id}/dispatch',        [InventoryMovementController::class, 'dispatchTransferOrder'],'admin');
$router->post('/admin/inventory/transfers/{id}/receive',         [InventoryMovementController::class, 'receiveTransferOrder'],'admin');
$router->get('/admin/inventory/transfers/{id}',                  [InventoryMovementController::class, 'showTransferOrder'],   'admin');
$router->post('/admin/inventory/movements/damaged',              [InventoryMovementController::class, 'markDamaged'],      'admin:owner,store_keeper');
$router->post('/admin/inventory/movements/return',               [InventoryMovementController::class, 'processReturn'],    'admin:owner,store_keeper');
$router->post('/admin/inventory/movements/emergency',            [InventoryMovementController::class, 'emergencyUse'],     'admin:owner');
$router->post('/admin/inventory/movements/adjustment',           [InventoryMovementController::class, 'adjustment'],       'admin:owner');
$router->get('/admin/inventory/movements/pending-approvals',     [InventoryMovementController::class, 'pendingApprovals'], 'admin');
$router->get('/admin/inventory/movements/product/{productId}',   [InventoryMovementController::class, 'byProduct'],        'admin');
$router->get('/admin/inventory/movements/{id}',                  [InventoryMovementController::class, 'show'],             'admin');

// Smart Inventory — Intelligence Hub (static routes before {productId})
$router->get('/admin/inventory/intelligence/health-scores',      [InventoryIntelligenceController::class, 'getAllHealthScores'],     'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/health/{productId}', [InventoryIntelligenceController::class, 'getProductHealth'],       'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/dead-stock/value',   [InventoryIntelligenceController::class, 'getDeadStockValue'],      'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/dead-stock',         [InventoryIntelligenceController::class, 'getDeadStock'],           'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/runout/{productId}', [InventoryIntelligenceController::class, 'getProductRunout'],       'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/runout',             [InventoryIntelligenceController::class, 'getAllRunouts'],          'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/abnormal',           [InventoryIntelligenceController::class, 'getAbnormalMovements'],   'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/intelligence/summary',            [InventoryIntelligenceController::class, 'getIntelligenceSummary'], 'admin:owner,store_keeper,accountant');

// Smart Inventory — Intelligence Hub Part 2 (Reorder / Dealer Demand / Consumption)
// (static + deeper-segment routes registered before single-{param} routes)
$router->post('/admin/inventory/reorder/generate',                    [ReorderIntelligenceController::class, 'generateSuggestions'],     'admin:owner,store_keeper');
$router->get('/admin/inventory/reorder/suggestions',                  [ReorderIntelligenceController::class, 'getAllSuggestions'],       'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/reorder/suggestions/{id}',             [ReorderIntelligenceController::class, 'getSuggestion'],           'admin:owner,store_keeper,accountant');
$router->put('/admin/inventory/reorder/suggestions/{id}',             [ReorderIntelligenceController::class, 'updateSuggestionStatus'],  'admin:owner,store_keeper');
$router->get('/admin/inventory/reorder/dealer-demand',                [ReorderIntelligenceController::class, 'getDealerDemandProfiles'], 'admin:owner,store_keeper,accountant');
$router->post('/admin/inventory/reorder/dealer/update',               [ReorderIntelligenceController::class, 'updateDealerDemand'],      'admin:owner,store_keeper');
$router->get('/admin/inventory/reorder/dealer/{dealerId}',            [ReorderIntelligenceController::class, 'getDealerDemand'],         'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/reorder/consumption/breakdown/{id}',   [ReorderIntelligenceController::class, 'getConsumptionBreakdown'], 'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/reorder/consumption/{id}',             [ReorderIntelligenceController::class, 'getConsumptionTrends'],    'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/reorder/top-dealers',                  [ReorderIntelligenceController::class, 'getTopDealers'],           'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/reorder/top-departments',              [ReorderIntelligenceController::class, 'getTopDepartments'],       'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/reorder/heatmap/{productId}',          [ReorderIntelligenceController::class, 'getHeatmap'],              'admin:owner,store_keeper,accountant');

// Smart Inventory — Approval Workflow (static routes + {id}/action before {id})
$router->get('/admin/inventory/approvals',                    [InventoryApprovalController::class, 'index'],     'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/approvals/pending',            [InventoryApprovalController::class, 'getPending'], 'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/approvals/stats',              [InventoryApprovalController::class, 'getStats'],  'admin:owner,store_keeper,accountant');
$router->get('/admin/inventory/approvals/history',            [InventoryApprovalController::class, 'getHistory'], 'admin:owner,store_keeper,accountant');
$router->post('/admin/inventory/approvals/escalate',          [InventoryApprovalController::class, 'escalate'],  'admin:owner,store_keeper');
$router->post('/admin/inventory/approvals/{id}/approve',      [InventoryApprovalController::class, 'approve'],   'admin:owner,store_keeper');
$router->post('/admin/inventory/approvals/{id}/reject',       [InventoryApprovalController::class, 'reject'],    'admin:owner,store_keeper');
$router->get('/admin/inventory/approvals/{id}',               [InventoryApprovalController::class, 'show'],      'admin:owner,store_keeper,accountant');

// Admin Invoices
$router->get('/admin/invoices',                [AdminInvoiceController::class, 'index'],    'admin');
$router->post('/admin/invoices',               [AdminInvoiceController::class, 'store'],    'admin');
$router->post('/admin/invoices/gst',           [AdminInvoiceController::class, 'storeGst'], 'admin');
$router->get('/admin/invoices/recurring',      [AdminInvoiceController::class, 'recurringIndex'],       'admin');
$router->post('/admin/invoices/recurring',     [AdminInvoiceController::class, 'recurringStore'],       'admin');
$router->post('/admin/invoices/recurring/generate-due', [AdminInvoiceController::class, 'recurringGenerateDue'], 'admin');
$router->put('/admin/invoices/recurring/{id}', [AdminInvoiceController::class, 'recurringUpdate'],      'admin');
$router->post('/admin/invoices/{id}/reminders',[AdminInvoiceController::class, 'sendPaymentReminder'],  'admin');
$router->get('/admin/invoices/{id}/download',  [AdminInvoiceController::class, 'download'], 'admin');
$router->get('/admin/invoices/{id}/payments',  [AdminPaymentController::class, 'invoicePayments'], 'admin');
$router->post('/admin/invoices/{id}/payments', [AdminPaymentController::class, 'storeForInvoice'], 'admin:owner,accountant');
$router->get('/admin/invoices/{id}',           [AdminInvoiceController::class, 'show'],     'admin');
$router->put('/admin/invoices/{id}',           [AdminInvoiceController::class, 'update'],   'admin');
$router->delete('/admin/invoices/{id}',        [AdminInvoiceController::class, 'destroy'],  'admin');

// Admin Credit Notes (correct/reduce a previously issued invoice)
$router->get('/admin/credit-notes',            [AdminInvoiceController::class, 'creditNoteIndex'],   'admin');
$router->post('/admin/credit-notes',           [AdminInvoiceController::class, 'creditNoteStore'],   'admin:owner,accountant');
$router->get('/admin/credit-notes/{id}',       [AdminInvoiceController::class, 'creditNoteShow'],    'admin');
$router->put('/admin/credit-notes/{id}',       [AdminInvoiceController::class, 'creditNoteUpdate'],  'admin:owner,accountant');
$router->delete('/admin/credit-notes/{id}',    [AdminInvoiceController::class, 'creditNoteDestroy'], 'admin:owner,accountant');

// Admin Sales Billing - Payments and Receivables
$router->get('/admin/payments',                [AdminPaymentController::class, 'index'],    'admin');
$router->post('/admin/payments',               [AdminPaymentController::class, 'store'],    'admin:owner,accountant');
$router->get('/admin/payments/{id}/receipt',   [AdminPaymentController::class, 'receipt'],  'admin');
$router->post('/admin/payments/{id}/void',     [AdminPaymentController::class, 'void'],     'admin:owner,accountant');
$router->get('/admin/payments/{id}',           [AdminPaymentController::class, 'show'],     'admin');
$router->get('/admin/receivables/ageing',      [AdminPaymentController::class, 'receivablesAgeing'], 'admin');

// Admin Sales Billing - Quotations and Proformas
$router->get('/admin/sales-documents',                 [AdminSalesDocumentController::class, 'index'],        'admin');
$router->post('/admin/sales-documents',                [AdminSalesDocumentController::class, 'store'],        'admin:owner,accountant,sales');
$router->get('/admin/sales-documents/{id}/document',   [AdminSalesDocumentController::class, 'documentData'], 'admin');
$router->post('/admin/sales-documents/{id}/send',      [AdminSalesDocumentController::class, 'send'],         'admin:owner,accountant,sales');
$router->post('/admin/sales-documents/{id}/accept',    [AdminSalesDocumentController::class, 'accept'],       'admin:owner,accountant,sales');
$router->post('/admin/sales-documents/{id}/reject',    [AdminSalesDocumentController::class, 'reject'],       'admin:owner,accountant,sales');
$router->post('/admin/sales-documents/{id}/cancel',    [AdminSalesDocumentController::class, 'cancel'],       'admin:owner,accountant,sales');
$router->post('/admin/sales-documents/{id}/convert',   [AdminSalesDocumentController::class, 'convert'],      'admin:owner,accountant,sales');
$router->get('/admin/sales-documents/{id}',            [AdminSalesDocumentController::class, 'show'],         'admin');
$router->put('/admin/sales-documents/{id}',            [AdminSalesDocumentController::class, 'update'],       'admin:owner,accountant,sales');

// Operations - Quotation Builder (pick-and-play quotations + branded PDF)
$router->get('/admin/quotations',          [AdminQuotationController::class, 'index'],   'admin');
$router->post('/admin/quotations',         [AdminQuotationController::class, 'store'],   'admin:owner,accountant,sales');
$router->get('/admin/quotations/{id}',     [AdminQuotationController::class, 'show'],    'admin');
$router->put('/admin/quotations/{id}',     [AdminQuotationController::class, 'update'],  'admin:owner,accountant,sales');
$router->delete('/admin/quotations/{id}',  [AdminQuotationController::class, 'destroy'], 'admin:owner,accountant,sales');

// Admin Quotation Builder - Component Library
$router->get('/admin/quotation-components',        [AdminQuotationComponentController::class, 'index'],    'admin');
$router->post('/admin/quotation-components',       [AdminQuotationComponentController::class, 'store'],    'admin:owner,accountant,sales');
$router->post('/admin/quotation-components/bulk',  [AdminQuotationComponentController::class, 'bulkStore'],'admin:owner,accountant,sales');
$router->delete('/admin/quotation-components/{id}',[AdminQuotationComponentController::class, 'destroy'],  'admin:owner,accountant,sales');

// Admin Sales Billing - Test Certificates
$router->get('/admin/test-certificates',                    [AdminTestCertificateController::class, 'index'],           'admin');
$router->post('/admin/test-certificates',                   [AdminTestCertificateController::class, 'store'],           'admin:owner,store_keeper,sales');
$router->get('/admin/test-certificates/{id}/document',      [AdminTestCertificateController::class, 'certificateData'], 'admin');
$router->post('/admin/test-certificates/{id}/document',     [AdminTestCertificateController::class, 'uploadDocument'],  'admin:owner,store_keeper,sales');
$router->get('/admin/test-certificates/{id}/download',      [AdminTestCertificateController::class, 'downloadDocument'],'admin');
$router->post('/admin/test-certificates/{id}/issue',        [AdminTestCertificateController::class, 'issue'],           'admin:owner,store_keeper,sales');
$router->post('/admin/test-certificates/{id}/void',         [AdminTestCertificateController::class, 'void'],            'admin:owner');
$router->get('/admin/test-certificates/{id}',               [AdminTestCertificateController::class, 'show'],            'admin');
$router->put('/admin/test-certificates/{id}',               [AdminTestCertificateController::class, 'update'],          'admin:owner,store_keeper,sales');

// Admin GST Compliance
$router->post('/admin/gst/invoices/{id}/irn',             [AdminGstComplianceController::class, 'generateIrn'], 'admin');
$router->get('/admin/gst-compliance',                       [AdminGstComplianceController::class, 'index'],     'admin:owner,accountant');
$router->get('/admin/gst-compliance/calculate',             [AdminGstComplianceController::class, 'calculate'], 'admin:owner,accountant');
$router->get('/admin/gst-compliance/{period}/export',       [AdminGstComplianceController::class, 'export'],    'admin:owner,accountant');
$router->post('/admin/gst-compliance/{period}/save',        [AdminGstComplianceController::class, 'save'],      'admin:owner,accountant');
$router->post('/admin/gst-compliance/{period}/review',      [AdminGstComplianceController::class, 'review'],    'admin:owner,accountant');
$router->post('/admin/gst-compliance/{period}/file',        [AdminGstComplianceController::class, 'file'],      'admin:owner,accountant');
$router->post('/admin/gst-compliance/{period}/lock',        [AdminGstComplianceController::class, 'lock'],      'admin:owner');
$router->get('/admin/gst-compliance/{period}',              [AdminGstComplianceController::class, 'show'],      'admin:owner,accountant');

$router->get('/admin/invoice-products',        [AdminInvoiceProductController::class, 'index'],   'admin');
$router->post('/admin/invoice-products',       [AdminInvoiceProductController::class, 'store'],   'admin');
$router->put('/admin/invoice-products/{id}',   [AdminInvoiceProductController::class, 'update'],  'admin');
$router->delete('/admin/invoice-products/{id}',[AdminInvoiceProductController::class, 'destroy'], 'admin');

// Admin Expenses
$router->get('/admin/expenses/analytics',       [AdminFinancePlanningController::class, 'expenseAnalytics'], 'admin:owner,accountant');
$router->get('/admin/expenses/claims/policies', [AdminExpenseController::class, 'claimPolicies'],  'admin');
$router->post('/admin/expenses/claims/{id}/approve',   [AdminExpenseController::class, 'claimApprove'],   'admin');
$router->post('/admin/expenses/claims/{id}/reject',    [AdminExpenseController::class, 'claimReject'],    'admin');
$router->post('/admin/expenses/claims/{id}/reimburse', [AdminExpenseController::class, 'claimReimburse'], 'admin');
$router->get('/admin/expenses/claims',          [AdminExpenseController::class, 'claimIndex'],     'admin');
$router->post('/admin/expenses/claims',         [AdminExpenseController::class, 'claimStore'],     'admin');
$router->get('/admin/expenses/claims/{id}',     [AdminExpenseController::class, 'claimShow'],      'admin');
$router->get('/admin/expenses',                [AdminExpenseController::class, 'index'],       'admin');
$router->get('/admin/expenses/categories',     [AdminExpenseController::class, 'categories'],  'admin');
$router->post('/admin/expenses/extract-bill',  [AdminExpenseController::class, 'extractBill'], 'admin');
$router->get('/admin/expenses/{id}',           [AdminExpenseController::class, 'show'],        'admin');
$router->post('/admin/expenses',               [AdminExpenseController::class, 'store'],       'admin');
$router->put('/admin/expenses/{id}',           [AdminExpenseController::class, 'update'],      'admin');
$router->delete('/admin/expenses/{id}',        [AdminExpenseController::class, 'destroy'],     'admin');

// Accounting — frontend calls /admin/accounting/*; reuse the existing
// AdminLedgerController (same double-entry feature, already at /admin/ledger/*).
$router->get('/admin/accounting/reports/trial-balance',[AdminLedgerController::class, 'trialBalance'],   'admin');
$router->get('/admin/accounting/reports/profit-loss',  [AdminLedgerController::class, 'profitLoss'],     'admin');
$router->get('/admin/accounting/reports/balance-sheet',[AdminLedgerController::class, 'balanceSheet'],   'admin');
$router->get('/admin/accounting/accounts',             [AdminLedgerController::class, 'accounts'],       'admin');
$router->post('/admin/accounting/accounts',            [AdminLedgerController::class, 'storeAccount'],   'admin');
$router->put('/admin/accounting/accounts/{id}',        [AdminLedgerController::class, 'updateAccount'],  'admin');
$router->delete('/admin/accounting/accounts/{id}',     [AdminLedgerController::class, 'destroyAccount'], 'admin');
$router->get('/admin/accounting/journals',             [AdminLedgerController::class, 'journals'],       'admin');
$router->post('/admin/accounting/journals',            [AdminLedgerController::class, 'storeJournal'],   'admin');
$router->post('/admin/accounting/journals/{id}/post',  [AdminLedgerController::class, 'postJournal'],    'admin');
$router->get('/admin/accounting/journals/{id}',        [AdminLedgerController::class, 'showJournal'],    'admin');

$router->get('/admin/ledger/reports/trial-balance', [AdminLedgerController::class, 'trialBalance'], 'admin');
$router->get('/admin/ledger/reports/pnl',           [AdminLedgerController::class, 'profitLoss'],   'admin');
$router->get('/admin/ledger/reports/balance-sheet', [AdminLedgerController::class, 'balanceSheet'], 'admin');
$router->get('/admin/ledger/accounts',              [AdminLedgerController::class, 'accounts'],       'admin');
$router->post('/admin/ledger/accounts',             [AdminLedgerController::class, 'storeAccount'],   'admin');
$router->get('/admin/ledger/accounts/{id}',         [AdminLedgerController::class, 'showAccount'],    'admin');
$router->put('/admin/ledger/accounts/{id}',         [AdminLedgerController::class, 'updateAccount'],  'admin');
$router->delete('/admin/ledger/accounts/{id}',      [AdminLedgerController::class, 'destroyAccount'], 'admin');
$router->get('/admin/ledger/journals',              [AdminLedgerController::class, 'journals'],       'admin');
$router->post('/admin/ledger/journals',             [AdminLedgerController::class, 'storeJournal'],   'admin');
$router->post('/admin/ledger/journals/{id}/post',   [AdminLedgerController::class, 'postJournal'],    'admin');
$router->get('/admin/ledger/journals/{id}',         [AdminLedgerController::class, 'showJournal'],    'admin');

$router->get('/admin/finance/overlay',          [AdminFinancePlanningController::class, 'overlay'],       'admin:owner,accountant');
$router->post('/admin/finance/ai-analysis',    [AdminFinanceController::class, 'aiAnalysis'],   'admin:owner,accountant');
$router->get('/admin/finance/pnl',             [AdminFinanceController::class, 'pnl'],          'admin');
$router->get('/admin/finance/ratios',          [AdminFinanceController::class, 'ratios'],       'admin');
$router->get('/admin/finance/config',          [AdminFinanceController::class, 'config'],       'admin');
$router->put('/admin/finance/config',          [AdminFinanceController::class, 'updateConfig'], 'admin');
$router->get('/admin/finance/inventory-valuation',      [AdminFinanceController::class, 'inventoryValuation'],     'admin:owner,accountant');
$router->get('/admin/finance/inventory-value-movement', [AdminFinanceController::class, 'inventoryValueMovement'], 'admin:owner,accountant');
$router->get('/admin/finance/damaged-stock-writeoff',   [AdminFinanceController::class, 'damagedStockWriteoff'],   'admin:owner,accountant');

// Admin Finance Planning - Budgets and Benchmarks
$router->get('/admin/budgets',                  [AdminFinancePlanningController::class, 'budgets'],        'admin:owner,accountant');
$router->post('/admin/budgets',                 [AdminFinancePlanningController::class, 'createBudget'],   'admin:owner,accountant');
$router->get('/admin/budgets/{id}/vs-actual',   [AdminFinancePlanningController::class, 'budgetVsActual'], 'admin:owner,accountant');
$router->get('/admin/budgets/{id}',             [AdminFinancePlanningController::class, 'showBudget'],     'admin:owner,accountant');
$router->put('/admin/budgets/{id}',             [AdminFinancePlanningController::class, 'updateBudget'],   'admin:owner,accountant');
$router->get('/admin/benchmarks/status',        [AdminFinancePlanningController::class, 'benchmarkStatus'], 'admin:owner,accountant');
$router->get('/admin/benchmarks',               [AdminFinancePlanningController::class, 'benchmarks'],      'admin:owner,accountant');
$router->post('/admin/benchmarks',              [AdminFinancePlanningController::class, 'saveBenchmark'],   'admin:owner,accountant');

// Notifications
$router->get('/admin/notifications',           [AdminNotificationController::class, 'index'],   'admin');

// GST Lookup
$router->get('/admin/gst-lookup',              [AdminGstLookupController::class,   'lookup'],   'admin');


// Admin Reports
$router->get('/admin/reports/analytics',        [AdminFinancePlanningController::class, 'reportsAnalytics'], 'admin:owner,accountant');
$router->get('/admin/reports',                 [AdminReportsController::class, 'index'],        'admin');
$router->get('/admin/reports/inventory/stock-summary',      [AdminReportsController::class, 'inventoryStockSummary'],     'admin:owner,store_keeper,accountant');
$router->get('/admin/reports/inventory/movement-report',    [AdminReportsController::class, 'inventoryMovementReport'],   'admin:owner,store_keeper,accountant');
$router->get('/admin/reports/inventory/valuation-report',   [AdminReportsController::class, 'inventoryValuationReport'],  'admin:owner,store_keeper,accountant');
$router->get('/admin/reports/inventory/dealer-consumption', [AdminReportsController::class, 'inventoryDealerConsumption'],'admin:owner,store_keeper,accountant');
$router->get('/admin/reports/inventory/zone-analysis',      [AdminReportsController::class, 'inventoryZoneAnalysis'],     'admin:owner,store_keeper,accountant');

// Admin Quote Requests
// (no admin "create" — quote requests are created via the public POST /quotes;
//  admins list/view/update/accept/decline/convert. The old POST route referenced
//  a non-existent AdminQuoteController::store and was removed.)
$router->get('/admin/quote-requests',       [AdminQuoteController::class,    'index'],        'admin');
$router->get('/admin/quote-requests/{id}',  [AdminQuoteController::class,    'show'],         'admin');
$router->put('/admin/quote-requests/{id}',  [AdminQuoteController::class,    'update'],       'admin');
$router->post('/admin/quote-requests/{id}/accept',          [AdminQuoteController::class, 'accept'],         'admin');
$router->post('/admin/quote-requests/{id}/decline',         [AdminQuoteController::class, 'decline'],        'admin');
$router->post('/admin/quote-requests/{id}/convert-to-order', [AdminQuoteController::class, 'convertToOrder'], 'admin');

// CRM — leads, deals/pipeline, activities (static segments registered before {id})
$router->get('/admin/crm/leads',                          [AdminCrmController::class, 'leadsIndex'],         'admin');
$router->post('/admin/crm/leads',                         [AdminCrmController::class, 'leadsStore'],         'admin');
$router->get('/admin/crm/leads/{id}',                     [AdminCrmController::class, 'leadsShow'],          'admin');
$router->put('/admin/crm/leads/{id}',                     [AdminCrmController::class, 'leadsUpdate'],        'admin');
$router->delete('/admin/crm/leads/{id}',                  [AdminCrmController::class, 'leadsDestroy'],       'admin');
$router->post('/admin/crm/leads/{id}/convert',            [AdminCrmController::class, 'leadsConvert'],       'admin');

$router->get('/admin/crm/deals/pipeline',                 [AdminCrmController::class, 'dealsPipeline'],      'admin');
$router->get('/admin/crm/deals',                          [AdminCrmController::class, 'dealsIndex'],         'admin');
$router->post('/admin/crm/deals',                         [AdminCrmController::class, 'dealsStore'],         'admin');
$router->get('/admin/crm/deals/{id}',                     [AdminCrmController::class, 'dealsShow'],          'admin');
$router->put('/admin/crm/deals/{id}',                     [AdminCrmController::class, 'dealsUpdate'],        'admin');
$router->put('/admin/crm/deals/{id}/stage',               [AdminCrmController::class, 'dealsChangeStage'],   'admin');
$router->delete('/admin/crm/deals/{id}',                  [AdminCrmController::class, 'dealsDestroy'],       'admin');

$router->get('/admin/crm/activities/timeline/{type}/{id}', [AdminCrmController::class, 'activitiesTimeline'], 'admin');
$router->get('/admin/crm/activities',                     [AdminCrmController::class, 'activitiesIndex'],    'admin');
$router->post('/admin/crm/activities',                    [AdminCrmController::class, 'activitiesStore'],    'admin');
$router->get('/admin/crm/activities/{id}',                [AdminCrmController::class, 'activitiesShow'],     'admin');
$router->put('/admin/crm/activities/{id}',                [AdminCrmController::class, 'activitiesUpdate'],   'admin');
$router->delete('/admin/crm/activities/{id}',             [AdminCrmController::class, 'activitiesDestroy'],  'admin');

// Admin Queries
$router->get('/admin/queries/staff',        [AdminQueryController::class,    'staff'],        'admin');
$router->get('/admin/queries',              [AdminQueryController::class,    'index'],        'admin');
$router->get('/admin/queries/{id}',         [AdminQueryController::class,    'show'],         'admin');
$router->put('/admin/queries/{id}/reply',   [AdminQueryController::class,    'reply'],        'admin');

// Admin FAQs (reorder must be before /{id} to avoid route collision)
$router->get('/admin/faqs',                 [AdminFaqController::class, 'index'],   'admin');
$router->post('/admin/faqs',                [AdminFaqController::class, 'store'],   'admin');
$router->put('/admin/faqs/reorder',         [AdminFaqController::class, 'reorder'], 'admin');
$router->put('/admin/faqs/{id}',            [AdminFaqController::class, 'update'],  'admin');
$router->delete('/admin/faqs/{id}',         [AdminFaqController::class, 'destroy'], 'admin');

// Admin Settings
$router->get('/admin/settings',             [AdminSettingsController::class, 'show'],         'admin');
$router->put('/admin/settings',             [AdminSettingsController::class, 'update'],       'admin');

// Admin Attachments
$router->get('/admin/attachments/{id}/download', [AdminAttachmentController::class, 'download'], 'admin');
$router->delete('/admin/attachments/{id}',        [AdminAttachmentController::class, 'destroy'],  'admin');

// Admin Import Engine
$router->get('/admin/import-jobs',              [AdminImportController::class, 'index'],  'admin:owner,accountant,hr');
$router->post('/admin/import-jobs',             [AdminImportController::class, 'store'],  'admin:owner,accountant,hr');
$router->get('/admin/import-jobs/{id}',         [AdminImportController::class, 'show'],   'admin:owner,accountant,hr');
$router->post('/admin/import-jobs/{id}/dry-run',[AdminImportController::class, 'dryRun'], 'admin:owner,accountant,hr');
$router->post('/admin/import-jobs/{id}/commit', [AdminImportController::class, 'commit'], 'admin:owner,accountant,hr');
$router->get('/admin/import-jobs/{id}/errors',  [AdminImportController::class, 'errors'], 'admin:owner,accountant,hr');

// Admin Data Interoperability - Guided imports, exports, backups
$router->get('/admin/import/modules',                 [AdminDataInteropController::class, 'modules'],     'admin:owner,accountant,hr');
$router->get('/admin/import/{module}/template',       [AdminDataInteropController::class, 'template'],    'admin:owner,accountant,hr');
$router->post('/admin/import/{module}/upload',        [AdminDataInteropController::class, 'upload'],      'admin:owner,accountant,hr');
$router->post('/admin/import/{module}/{job}/ai-map',  [AdminDataInteropController::class, 'aiMap'],       'admin:owner,accountant,hr');
$router->post('/admin/import/{module}/{job}/map',     [AdminDataInteropController::class, 'map'],         'admin:owner,accountant,hr');
$router->post('/admin/import/{module}/{job}/dry-run', [AdminDataInteropController::class, 'dryRun'],      'admin:owner,accountant,hr');
$router->post('/admin/import/{module}/{job}/commit',  [AdminDataInteropController::class, 'commit'],      'admin:owner,accountant,hr');
$router->get('/admin/import/{job}/errors',            [AdminDataInteropController::class, 'errors'],      'admin:owner,accountant,hr');
$router->get('/admin/import/{job}',                   [AdminDataInteropController::class, 'showImport'],  'admin:owner,accountant,hr');
$router->get('/admin/export/all',                     [AdminDataInteropController::class, 'exportAll'],   'admin:owner');
$router->get('/admin/export/{module}',                [AdminDataInteropController::class, 'exportModule'],'admin:owner,accountant,hr');
$router->get('/admin/backup/status',                  [AdminDataInteropController::class, 'backupStatus'],'admin:owner');
$router->post('/admin/backup/run',                    [AdminDataInteropController::class, 'runBackup'],  'admin:owner');

// Admin Insights (AI-powered)
$router->post('/admin/insights/generate',   [AdminInsightsController::class, 'generate'],     'admin');

// ─── Admin Tasks ─────────────────────────────────────────────────────────────
// NOTE: static paths (/performance, /statistics, /employee/{id}) MUST be registered
// BEFORE the dynamic /admin/tasks/{id} — router matches in registration order.
$router->get('/admin/tasks',                          [AdminTaskController::class, 'index'],        'admin');
$router->get('/admin/tasks/performance',              [AdminTaskController::class, 'performance'],  'admin');
$router->get('/admin/tasks/statistics',               [AdminTaskController::class, 'statistics'],   'admin');
$router->get('/admin/tasks/employee/{id}',            [AdminTaskController::class, 'byEmployee'],   'admin');
$router->get('/admin/tasks/{id}',                     [AdminTaskController::class, 'show'],         'admin');
$router->post('/admin/tasks',                         [AdminTaskController::class, 'store'],        'admin');
$router->post('/admin/tasks/{id}/comment',            [AdminTaskController::class, 'addComment'],   'admin');
$router->put('/admin/tasks/{id}/status',              [AdminTaskController::class, 'updateStatus'], 'admin');
$router->put('/admin/tasks/{id}/assign',              [AdminTaskController::class, 'assign'],       'admin');
$router->put('/admin/tasks/{id}/priority',            [AdminTaskController::class, 'updatePriority'],'admin');
$router->put('/admin/tasks/{id}',                     [AdminTaskController::class, 'update'],       'admin');
$router->patch('/admin/tasks/{id}',                   [AdminTaskController::class, 'update'],       'admin');
$router->delete('/admin/tasks/{id}',                  [AdminTaskController::class, 'destroy'],      'admin');

// ─── Admin Leave ─────────────────────────────────────────────────────────────
$router->get('/admin/leave/calendar',                 [AdminLeaveController::class, 'calendar'],   'admin');
$router->get('/admin/leave/register',                 [AdminLeaveController::class, 'register'],   'admin');
$router->get('/admin/leave/types',                    [AdminLeaveController::class, 'types'],      'admin');
$router->post('/admin/leave/types',                   [AdminLeaveController::class, 'storeType'],  'admin');
$router->put('/admin/leave/types/{id}',               [AdminLeaveController::class, 'updateType'], 'admin');
$router->get('/admin/leave/balances',                 [AdminLeaveController::class, 'balances'],   'admin');
$router->post('/admin/leave/balances/accrue',         [AdminLeaveController::class, 'accrue'],     'admin');
$router->post('/admin/leave/requests/{id}/approve',   [AdminLeaveController::class, 'approve'],    'admin');
$router->post('/admin/leave/requests/{id}/reject',    [AdminLeaveController::class, 'reject'],     'admin');
$router->get('/admin/leave/requests',                 [AdminLeaveController::class, 'index'],      'admin');
$router->post('/admin/leave/requests',                [AdminLeaveController::class, 'store'],      'admin');

// ─── Admin Employees — overridden by Krish Agencies AdminEmployeeController ─
// $router->get('/admin/employees',                      [AdminEmployeeController::class, 'index'],        'admin');
// $router->post('/admin/employees/import',              [AdminHrImportController::class, 'employeeImport'],'admin:owner,hr');
// $router->get('/admin/employees/import/{job}/errors',  [AdminHrImportController::class, 'employeeImportErrors'], 'admin:owner,hr');
// $router->get('/admin/employees/{key}/compliance',     [AdminComplianceController::class, 'employeeRecords'], 'admin:owner,hr');
// $router->post('/admin/employees/{key}/compliance',    [AdminComplianceController::class, 'storeForEmployee'], 'admin:owner,hr');
// $router->get('/admin/employees/{id}/qr',              [AdminEmployeeController::class, 'qr'],           'admin');
// $router->get('/admin/employees/{id}/profile',         [AdminEmployeeController::class, 'profile'],      'admin');
// $router->get('/admin/employees/{id}/photo',           [AdminEmployeeController::class, 'photo'],        'admin');
// $router->get('/admin/employees/{id}/insurance',       [AdminEmployeeController::class, 'insurance'],    'admin');
// $router->get('/admin/employees/{id}/inventory-consumption', [AdminEmployeeController::class, 'inventoryConsumption'], 'admin');
// $router->get('/admin/employees/{id}',                 [AdminEmployeeController::class, 'show'],         'admin');
// $router->post('/admin/employees',                     [AdminEmployeeController::class, 'store'],        'admin');
// $router->post('/admin/employees/{id}',                [AdminEmployeeController::class, 'update'],       'admin');
// $router->put('/admin/employees/{id}/status',          [AdminEmployeeController::class, 'updateStatus'], 'admin');
// $router->put('/admin/employees/{id}',                 [AdminEmployeeController::class, 'update'],       'admin');
// $router->patch('/admin/employees/{id}',               [AdminEmployeeController::class, 'update'],       'admin');
// $router->delete('/admin/employees/{id}',              [AdminEmployeeController::class, 'destroy'],      'admin');

// ─── Admin Attendance — overridden by Krish Agencies AdminAttendanceLogController ─
// $router->get('/admin/attendance/analytics',           [AdminAttendanceAnalyticsController::class, 'analytics'], 'admin:owner,hr');
// $router->get('/admin/attendance/anomalies',           [AdminAttendanceAnalyticsController::class, 'anomalies'], 'admin:owner,hr');
// $router->post('/admin/attendance/import',             [AdminHrImportController::class, 'attendanceImport'], 'admin:owner,hr');
// $router->get('/admin/attendance/import/{job}/errors', [AdminHrImportController::class, 'attendanceImportErrors'], 'admin:owner,hr');
// $router->get('/admin/attendance',                     [AdminAttendanceController::class, 'index'],      'admin');
// $router->get('/admin/attendance/cutoff', [AdminAttendanceController::class, 'cutoff'], 'admin');
// $router->get('/admin/attendance/shifts',              [AdminAttendanceController::class, 'shifts'],     'admin');
// $router->post('/admin/attendance/shifts',             [AdminAttendanceController::class, 'storeShift'], 'admin');
// $router->put('/admin/attendance/shifts/{id}',         [AdminAttendanceController::class, 'updateShift'], 'admin');
// $router->get('/admin/attendance/report',              [AdminAttendanceController::class, 'report'],     'admin');
// $router->get('/admin/attendance/summary',             [AdminAttendanceController::class, 'summary'],    'admin');
// $router->get('/admin/attendance/employee/{id}',       [AdminAttendanceController::class, 'byEmployee'], 'admin');
// $router->post('/admin/attendance/scan',               [AdminAttendanceController::class, 'scan'],       'admin');
// $router->post('/admin/attendance/manual',              [AdminAttendanceController::class, 'manual'],    'admin');
// $router->post('/admin/attendance/check-in',           [AdminAttendanceController::class, 'checkIn'],    'admin');
// $router->post('/admin/attendance/check-out',          [AdminAttendanceController::class, 'checkOut'],   'admin');
// $router->post('/admin/attendance/auto-mark-absent',   [AdminAttendanceController::class, 'autoMarkAbsent'], 'admin');
// $router->put('/admin/attendance/{id}',                [AdminAttendanceController::class, 'update'],     'admin');
// $router->delete('/admin/attendance/{id}',             [AdminAttendanceController::class, 'destroy'],    'admin');

// ─── Admin Payroll ───────────────────────────────────────────────────────────
$router->get('/admin/payroll',                        [AdminPayrollController::class, 'index'],    'admin');
$router->get('/admin/payroll/report',                 [AdminPayrollController::class, 'report'],   'admin');
$router->get('/admin/payroll/settings',               [AdminPayrollController::class, 'settingsShow'],   'admin');
$router->put('/admin/payroll/settings',                [AdminPayrollController::class, 'settingsUpdate'], 'admin:owner,accountant');
$router->get('/admin/payroll/run-status',             [AdminPayrollController::class, 'runStatus'], 'admin');
$router->get('/admin/payroll/bank-advice',            [AdminPayrollController::class, 'bankAdvice'], 'admin:owner,accountant');
$router->get('/admin/payroll/{id}/history',           [AdminPayrollController::class, 'history'],  'admin');
$router->get('/admin/payroll/{id}',                   [AdminPayrollController::class, 'show'],     'admin');
$router->post('/admin/payroll/ai-check',              [AdminPayrollController::class, 'aiCheck'],  'admin:owner,accountant,hr');
$router->post('/admin/payroll/run',                   [AdminPayrollController::class, 'run'],      'admin');
$router->post('/admin/payroll/calculate',             [AdminPayrollController::class, 'calculate'],'admin');
$router->post('/admin/payroll/review',                [AdminPayrollController::class, 'review'],   'admin');
$router->post('/admin/payroll/approve',               [AdminPayrollController::class, 'approve'],  'admin:owner,accountant');
$router->post('/admin/payroll/pay',                   [AdminPayrollController::class, 'pay'],      'admin:owner,accountant');
$router->post('/admin/payroll/lock',                  [AdminPayrollController::class, 'lock'],     'admin:owner');
$router->post('/admin/payroll/process',               [AdminPayrollController::class, 'process'],  'admin');

// ─── Admin Employee Advances ────────────────────────────────────────────────
$router->get('/admin/employee-advances',              [AdminEmployeeAdvanceController::class, 'index'],   'admin');
$router->post('/admin/employee-advances',             [AdminEmployeeAdvanceController::class, 'store'],   'admin');
$router->put('/admin/employee-advances/{id}',         [AdminEmployeeAdvanceController::class, 'update'],  'admin');
$router->delete('/admin/employee-advances/{id}',      [AdminEmployeeAdvanceController::class, 'destroy'], 'admin');

// ─── Admin Meetings ──────────────────────────────────────────────────────────
$router->get('/admin/meetings',                [AdminMeetingController::class, 'index'],            'admin');
$router->get('/admin/meetings/upcoming',       [AdminMeetingController::class, 'upcoming'],         'admin');
$router->get('/admin/meetings/general',        [AdminMeetingController::class, 'general'],          'admin');
$router->get('/admin/meetings/{id}/media',     [AdminMeetingMediaController::class, 'index'],       'admin:owner,hr');
$router->post('/admin/meetings/{id}/media',    [AdminMeetingMediaController::class, 'store'],       'admin:owner,hr');
$router->delete('/admin/meetings/{id}/media/{attachmentId}', [AdminMeetingMediaController::class, 'destroy'], 'admin:owner,hr');
$router->get('/admin/meetings/{id}',           [AdminMeetingController::class, 'show'],             'admin');
$router->post('/admin/meetings',               [AdminMeetingController::class, 'store'],            'admin');
$router->put('/admin/meetings/{id}',           [AdminMeetingController::class, 'update'],           'admin');
$router->delete('/admin/meetings/{id}',        [AdminMeetingController::class, 'destroy'],          'admin');
$router->put('/admin/meetings/{id}/attendees', [AdminMeetingController::class, 'updateAttendees'],  'admin');

// ─── Admin HR Compliance ─────────────────────────────────────────────────────
$router->get('/admin/compliance/expiring',      [AdminComplianceController::class, 'expiring'],      'admin:owner,hr');
$router->get('/admin/compliance',               [AdminComplianceController::class, 'index'],         'admin:owner,hr');
$router->get('/admin/compliance/{id}/download', [AdminComplianceController::class, 'download'],      'admin:owner,hr');
$router->put('/admin/compliance/{id}',          [AdminComplianceController::class, 'update'],        'admin:owner,hr');
$router->delete('/admin/compliance/{id}',       [AdminComplianceController::class, 'destroy'],       'admin:owner,hr');

// ─── Admin SOPs ───────────────────────────────────────────────────────────────
$router->get('/admin/sops',                    [AdminSopController::class, 'index'],                'admin');
$router->get('/admin/sops/categories',         [AdminSopController::class, 'categories'],           'admin');
$router->get('/admin/sops/{id}',               [AdminSopController::class, 'show'],                 'admin');
$router->post('/admin/sops',                   [AdminSopController::class, 'store'],                'admin');
$router->post('/admin/sops/{id}/versions',     [AdminSopController::class, 'uploadVersion'],        'admin');
$router->put('/admin/sops/{id}/versions/{versionId}/status', [AdminSopController::class, 'updateVersionStatus'], 'admin');
$router->get('/admin/sops/{id}/versions/{versionId}/download', [AdminSopController::class, 'downloadVersion'], 'admin');
$router->put('/admin/sops/{id}',               [AdminSopController::class, 'update'],               'admin');
$router->delete('/admin/sops/{id}',            [AdminSopController::class, 'destroy'],              'admin');
$router->post('/admin/sops/{id}/publish',      [AdminSopController::class, 'publish'],              'admin');

// ─── Admin Workflows ─────────────────────────────────────────────────────────
// NOTE: static sub-paths (meta, definitions...) MUST be registered before the
// /admin/workflows/{id} wildcard route, since the router is first-match-wins
// and {id} matches any single path segment (see Router::matchPath).
$router->get('/admin/workflows/meta',                       [AdminWorkflowController::class, 'meta'],              'admin');
$router->get('/admin/workflows/types',                      [AdminWorkflowController::class, 'types'],             'admin');
$router->get('/admin/workflows/stages',                     [AdminWorkflowController::class, 'stages'],            'admin');
$router->get('/admin/workflows/priorities',                 [AdminWorkflowController::class, 'priorities'],        'admin');
$router->get('/admin/workflows/definitions',                [AdminWorkflowController::class, 'definitionsIndex'],  'admin');
$router->post('/admin/workflows/definitions',                [AdminWorkflowController::class, 'definitionsStore'],  'admin');
$router->get('/admin/workflows/definitions/{id}',            [AdminWorkflowController::class, 'definitionsShow'],   'admin');
$router->put('/admin/workflows/definitions/{id}',             [AdminWorkflowController::class, 'definitionsUpdate'], 'admin');
$router->delete('/admin/workflows/definitions/{id}',          [AdminWorkflowController::class, 'definitionsDestroy'],'admin');
$router->get('/admin/workflows',                  [AdminWorkflowController::class, 'index'],      'admin');
$router->get('/admin/workflows/{id}',             [AdminWorkflowController::class, 'show'],       'admin');
$router->post('/admin/workflows',                 [AdminWorkflowController::class, 'store'],      'admin');
$router->put('/admin/workflows/{id}',             [AdminWorkflowController::class, 'update'],     'admin');
$router->post('/admin/workflows/{id}/transition', [AdminWorkflowController::class, 'transition'], 'admin');
$router->delete('/admin/workflows/{id}',          [AdminWorkflowController::class, 'destroy'],    'admin');

// ─── Invoice Processing Module Routes ────────────────────────────────────────
// Invoice Dashboard
$router->get('/admin/invoice-dashboard/summary',         [AdminInvoiceDashboardController::class, 'summary'],        true);
$router->get('/admin/invoice-dashboard/revenue-chart',   [AdminInvoiceDashboardController::class, 'revenueChart'],   true);
$router->get('/admin/invoice-dashboard/recent-activity', [AdminInvoiceDashboardController::class, 'recentActivity'], true);

// Scan Invoices — static sub-routes BEFORE {id}
$router->post('/admin/scan-invoices/upload',             [AdminScanInvoiceController::class, 'upload'],       true);
$router->post('/admin/scan-invoices/upload-page',        [AdminScanInvoiceController::class, 'uploadPage'],   true);
$router->post('/admin/scan-invoices/manual',             [AdminScanInvoiceController::class, 'storeManual'],  true);
$router->post('/admin/scan-invoices/auto-approve',       [AdminScanInvoiceController::class, 'autoApprove'],  true);
$router->get('/admin/scan-invoices',                     [AdminScanInvoiceController::class, 'index'],        true);
$router->get('/admin/scan-invoices/{id}/status',         [AdminScanInvoiceController::class, 'status'],       true);
$router->put('/admin/scan-invoices/{id}/approve',        [AdminScanInvoiceController::class, 'approve'],      true);
$router->get('/admin/scan-invoices/{id}/download',       [AdminScanInvoiceController::class, 'download'],     true);
$router->get('/admin/scan-invoices/{id}',                [AdminScanInvoiceController::class, 'show'],         true);
$router->put('/admin/scan-invoices/{id}',                [AdminScanInvoiceController::class, 'update'],       true);
$router->delete('/admin/scan-invoices/{id}',             [AdminScanInvoiceController::class, 'destroy'],      true);

// Invoice Products (catalog)
$router->get('/admin/invoice-product-catalog/low-stock', [AdminInvoiceProductCatalogController::class, 'lowStock'], true);
$router->get('/admin/invoice-product-catalog',           [AdminInvoiceProductCatalogController::class, 'index'],    true);
$router->post('/admin/invoice-product-catalog',          [AdminInvoiceProductCatalogController::class, 'store'],    true);
$router->get('/admin/invoice-product-catalog/{id}',      [AdminInvoiceProductCatalogController::class, 'show'],     true);
$router->put('/admin/invoice-product-catalog/{id}',      [AdminInvoiceProductCatalogController::class, 'update'],   true);
$router->patch('/admin/invoice-product-catalog/{id}',    [AdminInvoiceProductCatalogController::class, 'update'],   true);
$router->delete('/admin/invoice-product-catalog/{id}',   [AdminInvoiceProductCatalogController::class, 'destroy'],  true);

// Product Mappings (two-table combo support) — static /check before {id}
$router->post('/admin/product-mappings/check',   [AdminProductMappingController::class, 'check'],    true);
$router->get('/admin/product-mappings',          [AdminProductMappingController::class, 'index'],    true);
$router->post('/admin/product-mappings',         [AdminProductMappingController::class, 'store'],    true);
$router->get('/admin/product-mappings/{id}',     [AdminProductMappingController::class, 'show'],     true);
$router->put('/admin/product-mappings/{id}',     [AdminProductMappingController::class, 'update'],   true);
$router->delete('/admin/product-mappings/{id}',  [AdminProductMappingController::class, 'destroy'],  true);

// Invoice Product Mappings (legacy single-table — keep for backward compat)
$router->post('/admin/invoice-product-mappings/check',   [AdminInvoiceProductMappingController::class, 'check'],    true);
$router->get('/admin/invoice-product-mappings',          [AdminInvoiceProductMappingController::class, 'index'],    true);
$router->post('/admin/invoice-product-mappings',         [AdminInvoiceProductMappingController::class, 'store'],    true);
$router->delete('/admin/invoice-product-mappings/{id}',  [AdminInvoiceProductMappingController::class, 'destroy'],  true);

// Marketplace Sales — static sub-routes before {id}
$router->get('/admin/marketplace-sales/summary',         [AdminMarketplaceSalesController::class, 'summary'],         true);
$router->get('/admin/marketplace-sales/by-marketplace',  [AdminMarketplaceSalesController::class, 'byMarketplace'],   true);
$router->get('/admin/marketplace-sales',                 [AdminMarketplaceSalesController::class, 'index'],           true);
$router->get('/admin/marketplace-sales/{id}',            [AdminMarketplaceSalesController::class, 'show'],            true);

// Invoice Customers — static sub-routes before {id}
$router->get('/admin/invoice-customers',                 [AdminInvoiceCustomerController::class, 'index'],            true);
$router->post('/admin/invoice-customers',                [AdminInvoiceCustomerController::class, 'store'],            true);
$router->get('/admin/invoice-customers/{id}/purchases',  [AdminInvoiceCustomerController::class, 'purchases'],        true);
$router->get('/admin/invoice-customers/{id}',            [AdminInvoiceCustomerController::class, 'show'],             true);
$router->put('/admin/invoice-customers/{id}',            [AdminInvoiceCustomerController::class, 'update'],           true);
$router->delete('/admin/invoice-customers/{id}',         [AdminInvoiceCustomerController::class, 'destroy'],          true);

// GST
$router->get('/admin/gst-returns/summary',               [AdminGSTController::class, 'summary'],     true);
$router->get('/admin/gst-returns/hsn-summary',           [AdminGSTController::class, 'hsnSummary'],  true);
$router->get('/admin/gst-returns/monthly/{year}/{month}',[AdminGSTController::class, 'monthly'],     true);

// Invoice Accounting
$router->get('/admin/invoice-accounting/journal-entries',[AdminInvoiceAccountingController::class, 'journalEntries'], true);
$router->get('/admin/invoice-accounting/profit-loss',    [AdminInvoiceAccountingController::class, 'profitLoss'],     true);
$router->get('/admin/invoice-accounting/balance-sheet',  [AdminInvoiceAccountingController::class, 'balanceSheet'],  true);
$router->get('/admin/invoice-accounting/accounts',       [AdminInvoiceAccountingController::class, 'accounts'],      true);

// Marketplace Expenses — static before {id}
$router->get('/admin/marketplace-expenses/summary',      [AdminMarketplaceExpenseController::class, 'summary'],  true);
$router->get('/admin/marketplace-expenses',              [AdminMarketplaceExpenseController::class, 'index'],    true);
$router->post('/admin/marketplace-expenses',             [AdminMarketplaceExpenseController::class, 'store'],    true);
$router->put('/admin/marketplace-expenses/{id}',         [AdminMarketplaceExpenseController::class, 'update'],  true);
$router->delete('/admin/marketplace-expenses/{id}',      [AdminMarketplaceExpenseController::class, 'destroy'], true);

// Marketplace Analytics — static sub-routes before {platform}
$router->get('/admin/marketplace-analytics/analytics',           [AdminMarketplaceAnalyticsController::class, 'analytics'],       true);
$router->get('/admin/marketplace-analytics/settlements',         [AdminMarketplaceAnalyticsController::class, 'settlements'],     true);
$router->post('/admin/marketplace-analytics/settlements',        [AdminMarketplaceAnalyticsController::class, 'storeSettlement'], true);
$router->get('/admin/marketplace-analytics/{platform}/summary',  [AdminMarketplaceAnalyticsController::class, 'platformSummary'],true);

// Dropdown Options (creatable dropdowns — persisted per tenant)
$router->get('/admin/dropdown-options/{key}',          [AdminDropdownOptionsController::class, 'index'],   true);
$router->post('/admin/dropdown-options/{key}',         [AdminDropdownOptionsController::class, 'store'],   true);
$router->delete('/admin/dropdown-options/{key}/{value}',[AdminDropdownOptionsController::class, 'destroy'], true);

// Invoice Notifications — static read-all before {id}
$router->put('/admin/invoice-notifications/read-all',    [AdminInvoiceNotificationController::class, 'readAll'],   true);
$router->get('/admin/invoice-notifications',             [AdminInvoiceNotificationController::class, 'index'],     true);
$router->put('/admin/invoice-notifications/{id}/read',   [AdminInvoiceNotificationController::class, 'markRead'],  true);
$router->delete('/admin/invoice-notifications/{id}',     [AdminInvoiceNotificationController::class, 'destroy'],   true);

// Damaged Stock
$router->get('/admin/damaged-stock/summary',             [AdminDamagedStockController::class, 'summary'],  true);
$router->get('/admin/damaged-stock',                     [AdminDamagedStockController::class, 'index'],    true);
$router->post('/admin/damaged-stock/{id}/write-off',     [AdminDamagedStockController::class, 'writeOff'], true);

// Staff User Management (invoice module sub-users) — static routes before {id}
$router->get('/admin/staff-users/roles/list',  [AdminStaffController::class, 'rolesList'], true);
$router->post('/admin/staff-users/roles/add',  [AdminStaffController::class, 'rolesAdd'],  true);
$router->get('/admin/staff-users',             [AdminStaffController::class, 'index'],     true);
$router->post('/admin/staff-users',            [AdminStaffController::class, 'store'],     true);
$router->put('/admin/staff-users/{id}',        [AdminStaffController::class, 'update'],    true);
$router->delete('/admin/staff-users/{id}',     [AdminStaffController::class, 'destroy'],   true);

// Invoice Audit Log
$router->get('/admin/invoice-audit-log',                 [AdminInvoiceAuditLogController::class, 'index'], true);

// Invoice Payments
$router->get('/admin/invoice-payments',         [AdminInvoicePaymentsController::class, 'index'],   true);
$router->post('/admin/invoice-payments',        [AdminInvoicePaymentsController::class, 'store'],   true);
$router->get('/admin/invoice-payments/{id}',    [AdminInvoicePaymentsController::class, 'show'],    true);
$router->put('/admin/invoice-payments/{id}',    [AdminInvoicePaymentsController::class, 'update'],  true);
$router->delete('/admin/invoice-payments/{id}', [AdminInvoicePaymentsController::class, 'destroy'], true);

// PDF Splitter
$router->post('/admin/pdf-splitter/preview', [AdminPdfSplitterController::class, 'preview'], true);

// Outstanding (credit receivables & payables)
$router->get('/admin/outstanding/summary',               [AdminOutstandingController::class, 'summary'],        true);
$router->get('/admin/outstanding/receivables',           [AdminOutstandingController::class, 'receivables'],    true);
$router->get('/admin/outstanding/payables',              [AdminOutstandingController::class, 'payables'],       true);
$router->get('/admin/outstanding/{id}/payments',         [AdminOutstandingController::class, 'paymentHistory'], true);
$router->post('/admin/outstanding/{id}/payment',         [AdminOutstandingController::class, 'recordPayment'],  true);
// Bank Statements
$router->get('/admin/bank-statements/entries',           [AdminInvoiceBankStatementController::class, 'entries'],          true);
$router->post('/admin/bank-statements/reconcile/run',    [AdminInvoiceBankStatementController::class, 'runReconciliation'], true);
$router->post('/admin/bank-statements/entries/{id}/match', [AdminInvoiceBankStatementController::class, 'matchEntry'],     true);
$router->post('/admin/bank-statements/entries/{id}/accept', [AdminInvoiceBankStatementController::class, 'acceptEntry'],   true);
$router->get('/admin/bank-statements',                   [AdminInvoiceBankStatementController::class, 'index'],            true);
$router->post('/admin/bank-statements/upload',           [AdminInvoiceBankStatementController::class, 'upload'],           true);

// Invoice Reports (generate + download — static /generate before /{id})
$router->post('/admin/reports/generate',                 [AdminInvoiceReportsController::class, 'generate'],   true);
$router->get('/admin/reports/{id}/download',             [AdminInvoiceReportsController::class, 'download'],   true);

// ─── Chat (public — auth optional) ───────────────────────────────────────────
$router->post('/chat',              [ChatController::class, 'send']);
$router->get('/chat/history',       [ChatController::class, 'history']);
$router->get('/chat/briefing',      [ChatController::class, 'briefing'], true);
$router->get('/chat/suggestions',   [ChatController::class, 'suggestions'], true);
$router->get('/chat/debug',         [ChatController::class, 'debug']);
$router->get('/admin/chat/sessions',[ChatController::class, 'sessions'], 'admin');

// ─── Krish Agencies — require controllers ────────────────────────────────────
require_once ROOT_PATH . '/controllers/admin/AdminCustomerController.php';
require_once ROOT_PATH . '/controllers/admin/AdminMachineController.php';
require_once ROOT_PATH . '/controllers/admin/AdminTicketController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOrderController.php';
require_once ROOT_PATH . '/controllers/admin/AdminProductsController.php';
require_once ROOT_PATH . '/controllers/admin/AdminAttendanceLogController.php';
require_once ROOT_PATH . '/controllers/admin/AdminDashboardController.php';
require_once ROOT_PATH . '/controllers/admin/AdminEmployeeController.php'; // AdminKrishEmployeeController
require_once ROOT_PATH . '/controllers/customer/CustomerPortalController.php';
require_once ROOT_PATH . '/controllers/employee/EmployeePortalController.php';

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

// ─── Kynetropo Ops — require controllers ─────────────────────────────────────
require_once ROOT_PATH . '/controllers/admin/AdminOpsDashboardController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsClientController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsProjectController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsBugController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsMeetingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsFinanceController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsAmcController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsPitchController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsHiringController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsEmployeeController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsSopController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsProcessController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsMeetingFollowupController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsDocumentTemplateController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsCredentialController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsAiCommandController.php';
require_once ROOT_PATH . '/controllers/admin/AdminOpsAiChatController.php';

// ─── Kynetropo Sales Module ───────────────────────────────────────────────────
require_once ROOT_PATH . '/helpers/SalesPermissions.php';
require_once ROOT_PATH . '/models/SalesActivity.php';
require_once ROOT_PATH . '/models/SalesLead.php';
require_once ROOT_PATH . '/models/SalesCall.php';
require_once ROOT_PATH . '/models/SalesFollowup.php';
require_once ROOT_PATH . '/models/SalesMeeting.php';
require_once ROOT_PATH . '/models/SalesChallenge.php';
require_once ROOT_PATH . '/models/SalesComment.php';
require_once ROOT_PATH . '/models/SalesTask.php';
require_once ROOT_PATH . '/models/SalesLockout.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesDashboardController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesLeadController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesCallController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesFollowupController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesMeetingController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesChallengeController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesTaskController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesAccessController.php';
require_once ROOT_PATH . '/controllers/admin/AdminSalesCommentController.php';
require_once ROOT_PATH . '/controllers/admin/AdminGlobalSearchController.php';

// ─── Kynetropo Ops — Dashboard ────────────────────────────────────────────────
$router->get('/admin/ops/dashboard-stats',                   [AdminOpsDashboardController::class, 'stats'],          'admin');

// ─── Kynetropo Ops — Clients ──────────────────────────────────────────────────
$router->get('/admin/ops/clients',                           [AdminOpsClientController::class, 'index'],             'admin');
$router->post('/admin/ops/clients',                          [AdminOpsClientController::class, 'store'],             'admin');
$router->get('/admin/ops/clients/{id}',                      [AdminOpsClientController::class, 'show'],              'admin');
$router->put('/admin/ops/clients/{id}',                      [AdminOpsClientController::class, 'update'],            'admin');
$router->post('/admin/ops/clients/{id}/stage',               [AdminOpsClientController::class, 'advanceStage'],      'admin');
$router->put('/admin/ops/clients/{id}/checklist/{item_id}',               [AdminOpsClientController::class, 'checklistUpdate'],      'admin');
$router->get('/admin/ops/clients/{id}/checklist/{item_id}/files',         [AdminOpsClientController::class, 'checklistFiles'],        'admin');
$router->post('/admin/ops/clients/{id}/checklist/{item_id}/files',        [AdminOpsClientController::class, 'checklistUpload'],       'admin');
$router->delete('/admin/ops/clients/{id}/checklist/{item_id}/files/{file_id}', [AdminOpsClientController::class, 'checklistDeleteFile'], 'admin');
$router->delete('/admin/ops/clients/{id}',                   [AdminOpsClientController::class, 'destroy'],           'admin');

// ─── Kynetropo Ops — Projects ─────────────────────────────────────────────────
$router->get('/admin/ops/projects',                          [AdminOpsProjectController::class, 'index'],            'admin');
$router->post('/admin/ops/projects',                         [AdminOpsProjectController::class, 'store'],            'admin');
$router->get('/admin/ops/projects/{id}',                     [AdminOpsProjectController::class, 'show'],             'admin');
$router->put('/admin/ops/projects/{id}',                     [AdminOpsProjectController::class, 'update'],           'admin');
$router->delete('/admin/ops/projects/{id}',                  [AdminOpsProjectController::class, 'destroy'],          'admin');

// ─── Kynetropo Ops — Project Credentials ─────────────────────────────────────
$router->get('/admin/ops/projects/{id}/credentials',               [AdminOpsCredentialController::class, 'index'],   'admin');
$router->post('/admin/ops/projects/{id}/credentials',              [AdminOpsCredentialController::class, 'store'],   'admin');
$router->put('/admin/ops/projects/{id}/credentials/{cid}',         [AdminOpsCredentialController::class, 'update'],  'admin');
$router->delete('/admin/ops/projects/{id}/credentials/{cid}',      [AdminOpsCredentialController::class, 'destroy'], 'admin');

// ─── Kynetropo Ops — Bugs ─────────────────────────────────────────────────────
$router->get('/admin/ops/bugs',                              [AdminOpsBugController::class, 'index'],                'admin');
$router->post('/admin/ops/bugs',                             [AdminOpsBugController::class, 'store'],                'admin');
$router->get('/admin/ops/bugs/{id}',                         [AdminOpsBugController::class, 'show'],                 'admin');
$router->put('/admin/ops/bugs/{id}',                         [AdminOpsBugController::class, 'update'],               'admin');
$router->post('/admin/ops/bugs/{id}/comments',               [AdminOpsBugController::class, 'addComment'],           'admin');
$router->put('/admin/ops/bug-comments/{cid}',                [AdminOpsBugController::class, 'updateComment'],        'admin');
$router->delete('/admin/ops/bugs/{id}',                      [AdminOpsBugController::class, 'destroy'],              'admin');

// ─── Kynetropo Ops — Meetings ─────────────────────────────────────────────────
$router->get('/admin/ops/meetings',                          [AdminOpsMeetingController::class, 'index'],            'admin');
$router->post('/admin/ops/meetings',                         [AdminOpsMeetingController::class, 'store'],            'admin');
$router->get('/admin/ops/meetings/{id}',                     [AdminOpsMeetingController::class, 'show'],             'admin');
$router->put('/admin/ops/meetings/{id}',                     [AdminOpsMeetingController::class, 'update'],           'admin');
$router->delete('/admin/ops/meetings/{id}',                  [AdminOpsMeetingController::class, 'destroy'],          'admin');
$router->get('/admin/ops/meetings/{id}/files',               [AdminOpsMeetingController::class, 'listMeetingFiles'], 'admin');
$router->post('/admin/ops/meetings/{id}/files',              [AdminOpsMeetingController::class, 'uploadMeetingFile'],'admin');
$router->delete('/admin/ops/meetings/{id}/files/{file_id}',  [AdminOpsMeetingController::class, 'deleteMeetingFile'],'admin');

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

// ─── Kynetropo Ops — SOP ─────────────────────────────────────────────────────
$router->get('/admin/ops/sop/modules',                       [AdminOpsSopController::class, 'listModules'],          'admin');
$router->post('/admin/ops/sop/modules',                      [AdminOpsSopController::class, 'createModule'],         'admin');
$router->put('/admin/ops/sop/modules/{id}',                  [AdminOpsSopController::class, 'updateModule'],         'admin');
$router->delete('/admin/ops/sop/modules/{id}',               [AdminOpsSopController::class, 'deleteModule'],         'admin');
$router->get('/admin/ops/sop/modules/{module_id}/sops',      [AdminOpsSopController::class, 'listSops'],             'admin');
$router->post('/admin/ops/sop/modules/{module_id}/sops',     [AdminOpsSopController::class, 'createSop'],            'admin');
$router->get('/admin/ops/sop/sops/{id}/versions',            [AdminOpsSopController::class, 'sopVersions'],          'admin');
$router->get('/admin/ops/sop/sops/{id}/files',               [AdminOpsSopController::class, 'listSopFiles'],         'admin');
$router->post('/admin/ops/sop/sops/{id}/files',              [AdminOpsSopController::class, 'uploadSopFile'],        'admin');
$router->delete('/admin/ops/sop/sops/{id}/files/{file_id}',  [AdminOpsSopController::class, 'deleteSopFile'],        'admin');
$router->get('/admin/ops/sop/sops/{id}',                     [AdminOpsSopController::class, 'showSop'],              'admin');
$router->put('/admin/ops/sop/sops/{id}',                     [AdminOpsSopController::class, 'updateSop'],            'admin');
$router->delete('/admin/ops/sop/sops/{id}',                  [AdminOpsSopController::class, 'deleteSop'],            'admin');

// ─── Kynetropo Ops — Process ──────────────────────────────────────────────────
$router->get('/admin/ops/process/steps',                     [AdminOpsProcessController::class, 'index'],            'admin');
$router->post('/admin/ops/process/steps',                    [AdminOpsProcessController::class, 'store'],            'admin');
$router->put('/admin/ops/process/steps/{id}',                [AdminOpsProcessController::class, 'update'],           'admin');
$router->delete('/admin/ops/process/steps/{id}',             [AdminOpsProcessController::class, 'destroy'],          'admin');
$router->post('/admin/ops/process/steps/{step_id}/substeps', [AdminOpsProcessController::class, 'addSubstep'],       'admin');
$router->put('/admin/ops/process/substeps/{id}',             [AdminOpsProcessController::class, 'updateSubstep'],    'admin');
$router->delete('/admin/ops/process/substeps/{id}',          [AdminOpsProcessController::class, 'deleteSubstep'],    'admin');

// ─── Kynetropo Ops — Meeting Follow-ups ──────────────────────────────────────
$router->get('/admin/ops/meetings/{meeting_id}/followups',         [AdminOpsMeetingFollowupController::class, 'index'],       'admin');
$router->post('/admin/ops/meetings/{meeting_id}/followups',        [AdminOpsMeetingFollowupController::class, 'store'],       'admin');
$router->put('/admin/ops/meetings/followups/{id}',                 [AdminOpsMeetingFollowupController::class, 'update'],      'admin');
$router->delete('/admin/ops/meetings/followups/{id}',              [AdminOpsMeetingFollowupController::class, 'destroy'],     'admin');
$router->get('/admin/ops/meetings/followups/{id}/files',           [AdminOpsMeetingController::class, 'listFollowupFiles'],   'admin');
$router->post('/admin/ops/meetings/followups/{id}/files',          [AdminOpsMeetingController::class, 'uploadFollowupFile'],  'admin');
$router->delete('/admin/ops/meetings/followups/{id}/files/{file_id}', [AdminOpsMeetingController::class, 'deleteFollowupFile'], 'admin');

// ─── Kynetropo Ops — Document Templates ──────────────────────────────────────
$router->get('/admin/ops/document-templates',                [AdminOpsDocumentTemplateController::class, 'index'],   'admin');
$router->post('/admin/ops/document-templates',               [AdminOpsDocumentTemplateController::class, 'store'],   'admin');
$router->post('/admin/ops/document-templates/seed',          [AdminOpsDocumentTemplateController::class, 'seed'],    'admin');
$router->get('/admin/ops/document-templates/{id}',           [AdminOpsDocumentTemplateController::class, 'show'],    'admin');
$router->put('/admin/ops/document-templates/{id}',           [AdminOpsDocumentTemplateController::class, 'update'],  'admin');
$router->delete('/admin/ops/document-templates/{id}',        [AdminOpsDocumentTemplateController::class, 'destroy'], 'admin');

// ─── Kynetropo Ops — AI Command Bar ──────────────────────────────────────────
$router->post('/admin/ops/ai-command/parse',                 [AdminOpsAiCommandController::class, 'parse'],          'admin');
$router->post('/admin/ops/ai-command/execute',               [AdminOpsAiCommandController::class, 'execute'],        'admin');
$router->get('/admin/ops/ai-command/log',                    [AdminOpsAiCommandController::class, 'log'],            'admin');

// ─── Kynetropo Ops — AI Chat ──────────────────────────────────────────────────
$router->post('/admin/ops/ai-chat/message',                  [AdminOpsAiChatController::class, 'message'],           'admin');
$router->get('/admin/ops/ai-chat/entities',                  [AdminOpsAiChatController::class, 'entities'],          'admin');

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

// Dashboard + activity
$router->get('/admin/sales/dashboard',                   [AdminSalesDashboardController::class, 'index'],        'admin');
$router->get('/admin/sales/activity',                    [AdminSalesDashboardController::class, 'activity'],     'admin');
$router->get('/admin/sales/feed',                        [AdminSalesDashboardController::class, 'feed'],         'admin');
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
$router->get('/admin/sales/calls',                       [AdminSalesCallController::class, 'index'],             'admin');
$router->post('/admin/sales/calls',                      [AdminSalesCallController::class, 'store'],             'admin');

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
$router->get('/admin/sales/comments',                    [AdminSalesCommentController::class, 'index'],          'admin');
$router->post('/admin/sales/comments',                   [AdminSalesCommentController::class, 'store'],          'admin');
$router->post('/admin/sales/comments/{id}/restore',      [AdminSalesCommentController::class, 'restore'],        'admin');
$router->put('/admin/sales/comments/{id}',               [AdminSalesCommentController::class, 'update'],         'admin');
$router->delete('/admin/sales/comments/{id}',            [AdminSalesCommentController::class, 'destroy'],        'admin');

// ─── Global search (the header Ctrl-K palette) ───────────────────────────────
$router->get('/admin/search',                            [AdminGlobalSearchController::class, 'index'],          'admin');

// Dispatch
$router->dispatch();
