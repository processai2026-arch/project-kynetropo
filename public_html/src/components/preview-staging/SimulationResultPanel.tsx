import { cn } from "@/lib/utils";

interface SimulationResultPanelProps {
  result: Record<string, unknown> | null;
  label?: string;
  className?: string;
}

export function SimulationResultPanel({
  result,
  label = "Simulation Result",
  className,
}: SimulationResultPanelProps) {
  if (!result) return null;

  return (
    <div className={cn("rounded-xl border bg-card p-4 text-sm", className)}>
      <span className="font-medium text-card-foreground">{label}:</span>{" "}
      <span className="break-all text-muted-foreground">
        {JSON.stringify(result)}
      </span>
    </div>
  );
}
