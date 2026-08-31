import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplyTypeToggleButtonProps {
  value: "interstate" | "intrastate";
  onToggle: () => void;
}

export function SupplyTypeToggleButton({ value, onToggle }: SupplyTypeToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap",
        value === "interstate"
          ? "bg-blue-50 text-blue-700 border-blue-300"
          : "bg-orange-50 text-orange-700 border-orange-300"
      )}
    >
      {value === "interstate" ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}
