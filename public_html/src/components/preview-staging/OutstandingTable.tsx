import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  History,
} from "lucide-react";

export interface OutstandingEntry {
  id: number;
  party_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  balance_amount: number;
  aging_bucket: string;
}

interface PaymentRecord {
  payment_id: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string;
}

export interface OutstandingTableProps {
  data: OutstandingEntry[];
  loading: boolean;
  type: "receivable" | "payable";
  onPayment?: (entry: OutstandingEntry) => void;
}

const agingBadge: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "1-30": "bg-blue-50 text-blue-600 border-blue-200",
  "31-60": "bg-amber-50 text-amber-600 border-amber-200",
  "61-90": "bg-orange-50 text-orange-600 border-orange-200",
  "90+": "bg-red-50 text-red-600 border-red-200",
};

const NUMERIC_SORT_KEYS = new Set(["total_amount", "balance_amount"]);
const COL_COUNT = 8;

function fmt(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OutstandingTable({ data, loading, type, onPayment }: OutstandingTableProps) {
  const [sortKey, setSortKey] = useState<string>("invoice_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<number, PaymentRecord[]>>({});

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
      : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  const sorted = [...data].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey] ?? "";
    const bv = (b as Record<string, unknown>)[sortKey] ?? "";
    const cmp = NUMERIC_SORT_KEYS.has(sortKey)
      ? Number(av) - Number(bv)
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const loadPaymentHistory = async (entryId: number) => {
    if (expandedId === entryId) { setExpandedId(null); return; }
    setExpandedId(entryId);
    if (paymentHistory[entryId] !== undefined) return;
    try {
      const res = await apiFetch<{ data: { payments: PaymentRecord[] } }>(
        `/admin/outstanding/${entryId}/payments`
      );
      setPaymentHistory((prev) => ({ ...prev, [entryId]: res.data?.payments ?? [] }));
    } catch (err) {
      setPaymentHistory((prev) => ({ ...prev, [entryId]: [] }));
      toast.error(err instanceof Error ? err.message : "Failed to load payment history");
    }
  };

  const thClass =
    "text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none";

  return (
    <div className="overflow-x-auto eco-float-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th onClick={() => handleSort("party_name")} className={thClass}>
              {type === "receivable" ? "Customer" : "Vendor"}
              <SortIcon col="party_name" />
            </th>
            <th onClick={() => handleSort("invoice_number")} className={thClass}>
              Invoice #<SortIcon col="invoice_number" />
            </th>
            <th onClick={() => handleSort("invoice_date")} className={thClass}>
              Date<SortIcon col="invoice_date" />
            </th>
            <th onClick={() => handleSort("due_date")} className={thClass}>
              Due Date<SortIcon col="due_date" />
            </th>
            <th onClick={() => handleSort("total_amount")} className={thClass}>
              Total<SortIcon col="total_amount" />
            </th>
            <th onClick={() => handleSort("balance_amount")} className={thClass}>
              Balance<SortIcon col="balance_amount" />
            </th>
            <th onClick={() => handleSort("aging_bucket")} className={thClass}>
              Status<SortIcon col="aging_bucket" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap" />
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b">
                {Array.from({ length: COL_COUNT }).map((__, j) => (
                  <td key={j} className="py-3 px-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={COL_COUNT} className="px-6 py-8 text-center text-muted-foreground text-sm">
                No {type === "receivable" ? "receivables" : "payables"} found
              </td>
            </tr>
          )}

          {!loading &&
            sorted.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 text-card-foreground font-medium">{entry.party_name}</td>
                  <td className="py-3 px-4 text-card-foreground font-mono text-xs">{entry.invoice_number}</td>
                  <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{entry.invoice_date}</td>
                  <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{entry.due_date}</td>
                  <td className="py-3 px-4 text-card-foreground text-right">{fmt(Number(entry.total_amount))}</td>
                  <td className="py-3 px-4 text-card-foreground text-right font-medium">
                    {fmt(Number(entry.balance_amount))}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      className={cn(
                        "border capitalize",
                        agingBadge[entry.aging_bucket] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {entry.aging_bucket === "current" ? "Current" : `${entry.aging_bucket} days`}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {Number(entry.balance_amount) > 0 && onPayment && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2"
                          onClick={() => onPayment(entry)}
                        >
                          + Payment
                        </Button>
                      )}
                      <button
                        onClick={() => loadPaymentHistory(entry.id)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Payment history"
                      >
                        {expandedId === entry.id ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <History className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>

                {expandedId === entry.id && (
                  <tr className="bg-muted/20">
                    <td colSpan={COL_COUNT} className="px-6 py-3 border-b">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Payment History
                      </p>
                      {paymentHistory[entry.id] === undefined ? (
                        <p className="text-xs text-muted-foreground italic">Loading...</p>
                      ) : paymentHistory[entry.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No payments recorded yet</p>
                      ) : (
                        <div className="space-y-1">
                          {paymentHistory[entry.id].map((p) => (
                            <div
                              key={p.payment_id}
                              className="flex items-center gap-4 text-xs text-muted-foreground"
                            >
                              <span className="font-mono font-semibold text-emerald-600">
                                +{fmt(p.amount)}
                              </span>
                              <span>{p.payment_date}</span>
                              <span className="capitalize">{p.payment_method.replace(/_/g, " ")}</span>
                              {p.notes && <span className="italic">"{p.notes}"</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
        </tbody>
      </table>
    </div>
  );
}
