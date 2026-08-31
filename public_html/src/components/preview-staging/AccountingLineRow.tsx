import { cn } from "@/lib/utils";

interface AccountingLineRowProps {
  label: string;
  value?: number;
  bold?: boolean;
  indent?: boolean;
}

export function AccountingLineRow({
  label,
  value,
  bold = false,
  indent = false,
}: AccountingLineRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between py-2 border-b",
        bold ? "font-semibold text-foreground" : "text-card-foreground"
      )}
    >
      <span className={cn(indent && "pl-4 text-muted-foreground")}>{label}</span>
      <span>
        ₹{(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}
