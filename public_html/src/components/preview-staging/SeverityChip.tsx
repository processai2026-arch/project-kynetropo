import { cn } from "@/lib/utils";

interface SeverityChipProps {
  severity: "high" | "medium" | "low";
}

export function SeverityChip({ severity }: SeverityChipProps) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        severity === "high"
          ? "bg-red-100 text-red-700"
          : severity === "medium"
          ? "bg-amber-100 text-amber-700"
          : "bg-slate-100 text-slate-600"
      )}
    >
      {severity}
    </span>
  );
}
