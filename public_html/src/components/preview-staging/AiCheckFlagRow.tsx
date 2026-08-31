import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiCheckFlag {
  severity: "high" | "medium" | "low";
  employee_name?: string;
  employee_key: string;
  issue?: string;
  detail?: string;
}

interface AiCheckFlagRowProps {
  flag: AiCheckFlag;
}

const severityTone: Record<AiCheckFlag["severity"], string> = {
  high:   "border-red-300 bg-red-50",
  medium: "border-amber-300 bg-amber-50",
  low:    "border-slate-200 bg-slate-50",
};

const severityIconColor: Record<AiCheckFlag["severity"], string> = {
  high:   "text-red-600",
  medium: "text-amber-600",
  low:    "text-slate-500",
};

const severityChipColor: Record<AiCheckFlag["severity"], string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-slate-100 text-slate-600",
};

function SeverityChip({ severity }: { severity: AiCheckFlag["severity"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        severityChipColor[severity]
      )}
    >
      {severity}
    </span>
  );
}

export function AiCheckFlagRow({ flag }: AiCheckFlagRowProps) {
  const { severity, employee_name, employee_key, issue, detail } = flag;

  return (
    <div className={cn("flex gap-3 rounded-lg border p-3", severityTone[severity])}>
      <AlertTriangle
        className={cn("mt-0.5 h-4 w-4 shrink-0", severityIconColor[severity])}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{employee_name || employee_key}</span>
          <span className="font-mono text-xs text-muted-foreground">{employee_key}</span>
          <SeverityChip severity={severity} />
          {issue && (
            <span className="text-xs font-medium text-foreground">{issue}</span>
          )}
        </div>
        {detail && (
          <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
        )}
      </div>
    </div>
  );
}
