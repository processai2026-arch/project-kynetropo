import { cn } from "@/lib/utils";

interface AnalyticsMiniCardProps {
  /** Short muted label displayed above the value */
  label: string;
  /** The metric value — string or number */
  value: string | number;
  /** Tailwind color class applied to the value (e.g. "text-emerald-600").
   *  Defaults to text-card-foreground when omitted. */
  valueClass?: string;
  /** Optional caption line rendered below the value */
  subtitle?: string;
}

export function AnalyticsMiniCard({
  label,
  value,
  valueClass,
  subtitle,
}: AnalyticsMiniCardProps) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1 text-card-foreground", valueClass)}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

export default AnalyticsMiniCard;
