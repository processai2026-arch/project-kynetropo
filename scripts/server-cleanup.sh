#!/usr/bin/env bash
# Run from public_html/ on the server after deploying the latest release.
# These 130 PHP files were removed from the repository in commit a4f0795
# but will still exist on the server until deleted by hand.
#
# Usage (from public_html/):
#   bash scripts/server-cleanup.sh          dry-run — lists files that exist
#   bash scripts/server-cleanup.sh --delete  actually removes them
#
# Always back up first:
#   mysqldump -u DB_USER -p'DB_PASS' DB_NAME > ~/backup_$(date +%Y%m%d_%H%M).sql

set -euo pipefail
cd "$(dirname "$0")/.."   # resolve to public_html/

DELETE=false
[[ "${1:-}" == "--delete" ]] && DELETE=true

FILES=(
  api/controllers/AdminAttachmentController.php
  api/controllers/AdminAttendanceAnalyticsController.php
  api/controllers/AdminAttendanceController.php
  api/controllers/AdminBillingController.php
  api/controllers/AdminComplianceController.php
  api/controllers/AdminDamagedStockController.php
  api/controllers/AdminDataInteropController.php
  api/controllers/AdminDropdownOptionsController.php
  api/controllers/AdminEmployeeAdvanceController.php
  api/controllers/AdminExpenseController.php
  api/controllers/AdminFaqController.php
  api/controllers/AdminFinanceController.php
  api/controllers/AdminFinancePlanningController.php
  api/controllers/AdminGSTController.php
  api/controllers/AdminGoodsReceiptController.php
  api/controllers/AdminGstComplianceController.php
  api/controllers/AdminGstLookupController.php
  api/controllers/AdminHrImportController.php
  api/controllers/AdminImportController.php
  api/controllers/AdminInsightsController.php
  api/controllers/AdminInventoryController.php
  api/controllers/AdminInvoiceAccountingController.php
  api/controllers/AdminInvoiceAuditLogController.php
  api/controllers/AdminInvoiceBankStatementController.php
  api/controllers/AdminInvoiceCustomerController.php
  api/controllers/AdminInvoiceDashboardController.php
  api/controllers/AdminInvoiceNotificationController.php
  api/controllers/AdminInvoicePaymentsController.php
  api/controllers/AdminInvoiceProductCatalogController.php
  api/controllers/AdminInvoiceProductController.php
  api/controllers/AdminInvoiceProductMappingController.php
  api/controllers/AdminInvoiceReportsController.php
  api/controllers/AdminKnowledgeController.php
  api/controllers/AdminLeaveController.php
  api/controllers/AdminLedgerController.php
  api/controllers/AdminMarketplaceAnalyticsController.php
  api/controllers/AdminMarketplaceExpenseController.php
  api/controllers/AdminMarketplaceSalesController.php
  api/controllers/AdminMeetingController.php
  api/controllers/AdminMeetingMediaController.php
  api/controllers/AdminOpsAiChatController.php
  api/controllers/AdminOpsAiCommandController.php
  api/controllers/AdminOpsCredentialController.php
  api/controllers/AdminOpsDocumentTemplateController.php
  api/controllers/AdminOpsMeetingFollowupController.php
  api/controllers/AdminOpsProcessController.php
  api/controllers/AdminOpsSopController.php
  api/controllers/AdminOutstandingController.php
  api/controllers/AdminPayrollController.php
  api/controllers/AdminPdfSplitterController.php
  api/controllers/AdminPricingController.php
  api/controllers/AdminProcurementController.php
  api/controllers/AdminProductController.php
  api/controllers/AdminProductMappingController.php
  api/controllers/AdminPurchaseOrderController.php
  api/controllers/AdminPurchaseRequestController.php
  api/controllers/AdminQueryController.php
  api/controllers/AdminQuotationComponentController.php
  api/controllers/AdminQuotationController.php
  api/controllers/AdminQuoteController.php
  api/controllers/AdminRoleController.php
  api/controllers/AdminSalesDocumentController.php
  api/controllers/AdminScanInvoiceController.php
  api/controllers/AdminSecurityController.php
  api/controllers/AdminSopController.php
  api/controllers/AdminStaffController.php
  api/controllers/AdminTaskController.php
  api/controllers/AdminTestCertificateController.php
  api/controllers/AdminVendorController.php
  api/controllers/AdminWorkflowController.php
  api/controllers/InventoryAllocationController.php
  api/controllers/InventoryApprovalController.php
  api/controllers/InventoryIntelligenceController.php
  api/controllers/InventoryMovementController.php
  api/controllers/InventoryProductController.php
  api/controllers/InventoryStockController.php
  api/controllers/InventoryZoneController.php
  api/controllers/ReorderIntelligenceController.php
  api/helpers/GroqAPI.php
  api/helpers/InventoryPermissions.php
  api/models/Account.php
  api/models/AttendanceAnalytics.php
  api/models/AttendanceShift.php
  api/models/BackupService.php
  api/models/DataExportService.php
  api/models/DataImportMapper.php
  api/models/Employee.php
  api/models/EmployeeAdvance.php
  api/models/EmployeeCompliance.php
  api/models/FinanceAnalytics.php
  api/models/GstCompliance.php
  api/models/HrImport.php
  api/models/Insights.php
  api/models/Inventory.php
  api/models/InventoryAllocation.php
  api/models/InventoryMovement.php
  api/models/InventoryProduct.php
  api/models/InventoryStock.php
  api/models/InventoryZone.php
  api/models/JournalEntry.php
  api/models/JournalLine.php
  api/models/KnowledgeBase.php
  api/models/LeaveBalance.php
  api/models/LeaveRequest.php
  api/models/LeaveType.php
  api/models/Meeting.php
  api/models/MeetingMedia.php
  api/models/Order.php
  api/models/Payroll.php
  api/models/PayrollRun.php
  api/models/Product.php
  api/models/PurchaseOrder.php
  api/models/PurchaseRequest.php
  api/models/QueryThread.php
  api/models/SalesDocument.php
  api/models/Sop.php
  api/models/Task.php
  api/models/TestCertificate.php
  api/models/Vendor.php
  api/models/VendorBill.php
  api/models/VendorCredit.php
  api/models/Workflow.php
  api/services/ApprovalWorkflow.php
  api/services/GstinLookupService.php
  api/services/ImportEngine.php
  api/services/InventoryIntelligence.php
  api/services/InvoiceProcessingService.php
  api/services/MovementEngine.php
  api/services/ReorderIntelligence.php
  api/services/SmartAllocationEngine.php
)

found=0
missing=0
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    found=$((found + 1))
    if $DELETE; then
      rm "$f"
      echo "removed: $f"
    else
      echo "exists:  $f"
    fi
  else
    missing=$((missing + 1))
  fi
done

echo ""
if $DELETE; then
  echo "Removed $found file(s). $missing were already gone."
else
  echo "Dry run: $found file(s) to remove, $missing already gone."
  echo "Re-run with --delete to remove them."
fi
