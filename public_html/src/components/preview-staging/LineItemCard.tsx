import { cn } from "@/lib/utils";

interface LineItemCardProps {
  isCharge?: boolean;
  children: React.ReactNode;
}

export function LineItemCard({ isCharge = false, children }: LineItemCardProps) {
  return (
    <div
      className={cn(
        "border rounded-xl p-4 space-y-3",
        isCharge ? "bg-amber-50/40 border-amber-200" : "bg-muted/10"
      )}
    >
      {children}
    </div>
  );
}
