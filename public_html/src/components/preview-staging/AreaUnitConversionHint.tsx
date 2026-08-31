import { cn } from "@/lib/utils";

interface AreaUnitConversionHintProps {
  /** Lower bound of the plot size requirement, in acres. */
  minAcres: number;
  /** Upper bound of the plot size requirement, in acres. */
  maxAcres: number;
  /** Extra Tailwind classes — use to override or extend the default col-span-2. */
  className?: string;
}

const ACRES_TO_CENTS = 100;
const ACRES_TO_SQFT  = 43_560;

function fmtNum(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function buildRange(lo: number, hi: number, multiplier: number, unit: string): string {
  const loStr = fmtNum(lo * multiplier);
  const hiStr = fmtNum(hi * multiplier);
  return lo === hi ? `${loStr} ${unit}` : `${loStr} – ${hiStr} ${unit}`;
}

export function AreaUnitConversionHint({
  minAcres,
  maxAcres,
  className,
}: AreaUnitConversionHintProps) {
  const lo = Math.min(minAcres, maxAcres);
  const hi = Math.max(minAcres, maxAcres);

  if (!lo && !hi) return null;

  return (
    <div
      className={cn(
        "col-span-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      Same area in other units:{" "}
      <span className="font-medium text-card-foreground">
        {buildRange(lo, hi, ACRES_TO_CENTS, "cents")}
      </span>
      {" · "}
      <span className="font-medium text-card-foreground">
        {buildRange(lo, hi, ACRES_TO_SQFT, "sq.ft")}
      </span>
    </div>
  );
}

export default AreaUnitConversionHint;
