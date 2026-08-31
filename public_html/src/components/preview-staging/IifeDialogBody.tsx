import { Receipt, IndianRupee, Percent, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IifeDialogLineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  unitPrice: number;
  gstRate: number;
}

export interface IifeDialogPreviewRecord {
  id: string;
  date: string;
  status: string;
  customer: {
    name: string;
    gstin?: string | null;
    state: string;
    address: string;
  };
  lines: IifeDialogLineItem[];
}

export interface IifeDialogTotals {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  isInterState: boolean;
}

export interface IifeDialogBodyProps {
  /** Nullable record closed over from parent state. When null the IIFE short-circuits and renders nothing. */
  preview: IifeDialogPreviewRecord | null;
  /** Pure function that derives GST totals from the record's line items. */
  calcTotals: (record: IifeDialogPreviewRecord) => IifeDialogTotals;
  /** Whether line items are still being fetched after the dialog opened. */
  isLoading?: boolean;
  /** Called when the Close button is clicked. */
  onClose: () => void;
  /** Called when the Download PDF button is clicked. */
  onDownload?: (record: IifeDialogPreviewRecord) => void;
  /** Optional formatter for currency values. Defaults to INR locale string. */
  formatCurrency?: (value: number) => string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultFormatCurrency = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  Draft:     "bg-gray-100 text-gray-500 border-gray-200",
  Sent:      "bg-blue-50 text-blue-600 border-blue-200",
  Paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  Overdue:   "bg-red-50 text-red-600 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * IifeDialogBody
 *
 * Renders the full interior of an invoice-preview Dialog using an IIFE to
 * derive computed totals from a nullable `preview` state variable without
 * extracting a sub-component. The IIFE acts as both a null guard and a
 * computed-value scope: `preview && (() => { const t = calcTotals(preview); return <JSX> })()`.
 */
export function IifeDialogBody({
  preview,
  calcTotals,
  isLoading = false,
  onClose,
  onDownload,
  formatCurrency = defaultFormatCurrency,
}: IifeDialogBodyProps) {
  return (
    <>
      {preview && (() => {
        const t = calcTotals(preview);
        return (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-base font-semibold text-card-foreground">
                    Tax Invoice {preview.id}
                  </DialogTitle>
                  <DialogDescription>
                    {preview.customer.name} · {preview.date}
                  </DialogDescription>
                </div>
                <Badge
                  className={cn(
                    "border capitalize shrink-0",
                    STATUS_STYLES[preview.status] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {preview.status}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-sm mt-2">
              <div className="text-muted-foreground leading-relaxed">
                {preview.customer.address && (
                  <span>{preview.customer.address} · </span>
                )}
                <span>{preview.customer.state}</span>
                {preview.customer.gstin && (
                  <span> · GSTIN {preview.customer.gstin}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="font-semibold text-card-foreground">
                      {formatCurrency(t.subtotal)}
                    </p>
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.isInterState ? "IGST" : "CGST+SGST"}
                    </p>
                    <p className="font-semibold text-card-foreground">
                      {formatCurrency(t.totalTax)}
                    </p>
                  </div>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Grand Total</p>
                    <p className="font-bold text-card-foreground">
                      {formatCurrency(t.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading line items…</span>
                </div>
              ) : (
                <div className="overflow-x-auto eco-float-scroll rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Description
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          HSN
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Qty
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Rate
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          GST%
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lines.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-6 text-center text-muted-foreground text-sm"
                          >
                            No line items
                          </td>
                        </tr>
                      )}
                      {preview.lines.map((line) => (
                        <tr
                          key={line.id}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2 px-3 text-card-foreground">
                            {line.description}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {line.hsn || "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-card-foreground">
                            {line.qty}
                          </td>
                          <td className="py-2 px-3 text-right text-card-foreground">
                            {formatCurrency(line.unitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {line.gstRate}%
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-card-foreground">
                            {formatCurrency(line.qty * line.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(t.subtotal)}</span>
                  </div>
                  {t.isInterState ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGST</span>
                      <span>{formatCurrency(t.igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST</span>
                        <span>{formatCurrency(t.cgst)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>SGST</span>
                        <span>{formatCurrency(t.sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2 mt-2 text-base text-card-foreground">
                    <span>Grand Total</span>
                    <span>{formatCurrency(t.grandTotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    {t.isInterState
                      ? "Inter-state supply (IGST)"
                      : "Intra-state supply (CGST+SGST)"}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {onDownload && (
                <Button onClick={() => onDownload(preview)}>
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </Button>
              )}
            </DialogFooter>
          </>
        );
      })()}
    </>
  );
}
