import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ReceiptMetaSpreadProps {
  /** Document reference code — rendered in monospace */
  code: string;
  /** Formatted date string */
  date: string;
  /** Status label text (e.g. "paid", "pending") */
  status: string;
  /** Tailwind class string applied to the Badge */
  statusStyle: string;
  /** Label above the code field. Defaults to "Receipt No." */
  codeLabel?: string;
}

export function ReceiptMetaSpread({
  code,
  date,
  status,
  statusStyle,
  codeLabel = "Receipt No.",
}: ReceiptMetaSpreadProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{codeLabel}</p>
        <p className="text-base font-mono font-semibold text-card-foreground mt-0.5">
          {code}
        </p>
      </div>

      <div className="text-right">
        <p className="text-xs text-muted-foreground">Date</p>
        <p className="text-sm text-card-foreground mt-0.5">{date}</p>
      </div>

      <div className="text-right">
        <p className="text-xs text-muted-foreground">Status</p>
        <Badge className={cn("border capitalize mt-0.5", statusStyle)}>
          {status.replace(/_/g, " ")}
        </Badge>
      </div>
    </div>
  );
}

export default ReceiptMetaSpread;
