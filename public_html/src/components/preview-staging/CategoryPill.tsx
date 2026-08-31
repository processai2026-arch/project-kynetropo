import { cn } from "@/lib/utils";

interface CategoryPillProps {
  /** Text label rendered inside the pill */
  label: string;
  /** Tailwind color classes applied to the pill (background, text, border, etc.) */
  className?: string;
}

export function CategoryPill({ label, className }: CategoryPillProps) {
  return (
    <span
      className={cn(
        "inline-block text-[10px] font-medium px-2 py-0.5 rounded-full",
        className
      )}
    >
      {label}
    </span>
  );
}

export default CategoryPill;
