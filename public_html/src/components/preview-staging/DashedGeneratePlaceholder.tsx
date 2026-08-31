import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashedGeneratePlaceholderProps {
  categoryLabel: string;
  actionLabel?: string;
  className?: string;
}

export function DashedGeneratePlaceholder({
  categoryLabel,
  actionLabel = "Generate Insights",
  className,
}: DashedGeneratePlaceholderProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground",
        className
      )}
    >
      <Sparkles className="mx-auto mb-3 h-8 w-8 opacity-40" />
      <p className="text-sm">
        Click <strong className="font-semibold text-foreground">{actionLabel}</strong> to analyse your{" "}
        <span className="font-medium">{categoryLabel}</span> data.
      </p>
    </div>
  );
}
