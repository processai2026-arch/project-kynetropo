import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Link, Loader2 } from "lucide-react";

export interface BankEntry {
  entry_id: number;
  transaction_date: string;
  description: string;
  credit_amount: number;
  debit_amount: number;
  amount: number;
  type: "credit" | "debit";
  reconcile_status: "matched" | "partial" | "unmatched";
  reference?: string | null;
}

interface BankStatementEntryRowProps {
  entry: BankEntry;
  acceptingId: number | null;
  onSelect: (entry: BankEntry) => void;
  onMatch: (id: number, amount: number) => void;
  onAccept: (id: number) => void;
  fmt: (n: number) => string;
  statusBadge: Record<string, string>;
}

export function BankStatementEntryRow({
  entry,
  acceptingId,
  onSelect,
  onMatch,
  onAccept,
  fmt,
  statusBadge,
}: BankStatementEntryRowProps) {
  const credit = Number(entry.credit_amount);
  const debit = Number(entry.debit_amount);
  const isAccepting = acceptingId === entry.entry_id;

  return (
    <tr
      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onSelect(entry)}
    >
      <td className="py-3 px-4 text-card-foreground whitespace-nowrap">
        {entry.transaction_date}
      </td>
      <td className="py-3 px-4 text-card-foreground max-w-xs truncate">
        {entry.description}
      </td>
      <td className="py-3 px-4 text-right font-medium whitespace-nowrap text-emerald-600">
        {credit > 0 ? fmt(credit) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-3 px-4 text-right font-medium whitespace-nowrap text-red-600">
        {debit > 0 ? fmt(debit) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-3 px-4">
        <Badge
          className={cn(
            "border capitalize",
            statusBadge[entry.reconcile_status] ?? "bg-muted text-muted-foreground"
          )}
        >
          {entry.reconcile_status}
        </Badge>
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[120px] truncate">
        {entry.reference ?? <span className="opacity-40">—</span>}
      </td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        {entry.reconcile_status !== "matched" && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onMatch(entry.entry_id, entry.amount)}
            >
              <Link className="h-3 w-3 mr-1" />
              Match
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              disabled={isAccepting}
              onClick={() => onAccept(entry.entry_id)}
            >
              {isAccepting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Accept
                </>
              )}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
