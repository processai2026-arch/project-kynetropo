import { cn } from "@/lib/utils";

interface CustomerTypeChipProps {
  type: "Customer" | "Dealer";
  className?: string;
}

export function CustomerTypeChip({ type, className }: CustomerTypeChipProps) {
  return (
    <span
      className={cn(
        "ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium leading-none",
        type === "Dealer"
          ? "bg-indigo-500/15 text-indigo-400"
          : "bg-primary/10 text-primary",
        className
      )}
    >
      {type}
    </span>
  );
}
