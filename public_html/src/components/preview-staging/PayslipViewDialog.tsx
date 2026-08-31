import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

export interface EarningsItem {
  label: string;
  amount: number;
}

export interface DeductionItem {
  label: string;
  amount: number;
}

export interface Payslip {
  id: string | number;
  month: string;
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  bankAccount?: string;
  pfNumber?: string;
  earnings: EarningsItem[];
  grossEarnings: number;
  deductions: DeductionItem[];
  totalDeductions: number;
  netPay: number;
}

export interface PayslipViewDialogProps {
  slip: Payslip | null;
  onClose: () => void;
  onDownload: (slip: Payslip) => void;
}

function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-card-foreground">{value}</p>
    </div>
  );
}

function EarningsLineItemRow({ label, amount }: EarningsItem) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground">{inr(amount)}</span>
    </div>
  );
}

interface DeductionsSectionBlockProps {
  items: DeductionItem[];
  total: number;
}

function DeductionsSectionBlock({ items, total }: DeductionsSectionBlockProps) {
  return (
    <div className="border-t pt-3 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Deductions
      </p>
      {items.map((item) => (
        <div key={item.label} className="flex justify-between items-center py-0.5">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-medium text-destructive">- {inr(item.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between items-center border-t pt-2 mt-1">
        <span className="text-sm font-semibold text-card-foreground">Total Deductions</span>
        <span className="text-sm font-semibold text-destructive">- {inr(total)}</span>
      </div>
    </div>
  );
}

function DialogNetPaySummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
      <span className="text-base font-bold text-foreground">{label}</span>
      <span className="text-base font-bold text-primary">{value}</span>
    </div>
  );
}

export function PayslipViewDialog({ slip, onClose, onDownload }: PayslipViewDialogProps) {
  return (
    <Dialog open={!!slip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payslip — {slip?.month}</DialogTitle>
        </DialogHeader>

        {slip && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <InfoRow label="Employee Name" value={slip.employeeName} />
              <InfoRow label="Employee ID" value={slip.employeeId} />
              <InfoRow label="Department" value={slip.department} />
              <InfoRow label="Designation" value={slip.designation} />
              {slip.bankAccount && (
                <InfoRow label="Bank Account" value={slip.bankAccount} />
              )}
              {slip.pfNumber && (
                <InfoRow label="PF Number" value={slip.pfNumber} />
              )}
            </div>

            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Earnings
              </p>
              {slip.earnings.map((item) => (
                <EarningsLineItemRow key={item.label} label={item.label} amount={item.amount} />
              ))}
              <div className="flex justify-between items-center border-t pt-2 mt-1">
                <span className="text-sm font-semibold text-card-foreground">Gross Earnings</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {inr(slip.grossEarnings)}
                </span>
              </div>
            </div>

            <DeductionsSectionBlock items={slip.deductions} total={slip.totalDeductions} />

            <DialogNetPaySummaryRow label="Net Pay" value={inr(slip.netPay)} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => slip && onDownload(slip)}>
            <FileDown className="h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
