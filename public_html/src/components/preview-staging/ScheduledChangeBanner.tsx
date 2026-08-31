import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledChangeBannerProps {
  action: string;
  planName?: string | null;
  effectiveAt: string;
  reason?: string;
}

export function ScheduledChangeBanner({
  action,
  planName,
  effectiveAt,
  reason = "Not specified",
}: ScheduledChangeBannerProps) {
  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
      <p className="leading-snug">
        <span className="font-semibold">Scheduled:</span>{" "}
        {action}
        {planName ? ` to ${planName}` : ""}
        {" on "}
        <span className="font-semibold">{effectiveAt}</span>.{" "}
        <span className="text-blue-700">Reason: {reason}</span>
      </p>
    </div>
  );
}
