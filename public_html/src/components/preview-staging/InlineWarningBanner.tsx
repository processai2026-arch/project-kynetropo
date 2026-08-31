import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineWarningBannerProps {
  /** Bold heading summarising the warning */
  title: string;
  /** Supporting detail shown below the title */
  message: string;
  /** Optional extra Tailwind classes merged onto the root element */
  className?: string;
}

export function InlineWarningBanner({ title, message, className }: InlineWarningBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-amber-800">{title}</p>
        <p className="mt-0.5 text-xs text-amber-700">{message}</p>
      </div>
    </div>
  );
}

export default InlineWarningBanner;
