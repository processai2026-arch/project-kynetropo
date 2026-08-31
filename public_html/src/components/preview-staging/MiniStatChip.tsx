import { cn } from "@/lib/utils";

export interface MiniStatChipProps {
  /** Category label shown beneath the count (e.g. "Active", "Sold") */
  label: string;
  /** Count or value displayed prominently at the top */
  value: string | number;
  /** Tailwind utility classes controlling background, border, and text color.
   *  The wrapper div inherits these, so both the value and label take the color. */
  colorClass?: string;
}

export function MiniStatChip({ label, value, colorClass }: MiniStatChipProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-1.5 text-center min-w-16",
        colorClass
      )}
    >
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-xs mt-0.5 opacity-75">{label}</p>
    </div>
  );
}

export default MiniStatChip;
