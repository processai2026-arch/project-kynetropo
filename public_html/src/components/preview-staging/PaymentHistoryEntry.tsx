import { cn } from "@/lib/utils";

export interface PaymentHistoryEntryProps {
  amount: string;
  date: string;
  method: string;
  notes?: string;
  className?: string;
}

export function PaymentHistoryEntry({
  amount,
  date,
  method,
  notes,
  className,
}: PaymentHistoryEntryProps) {
  return (
    <div className={cn("flex items-center gap-4 text-xs text-muted-foreground", className)}>
      <span className="font-mono font-semibold text-emerald-600">+{amount}</span>
      <span>{date}</span>
      <span className="capitalize">{method}</span>
      {notes && <span className="italic">"{notes}"</span>}
    </div>
  );
}
