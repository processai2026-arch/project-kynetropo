import { cn } from "@/lib/utils";

interface InlineRejectionReasonProps {
  reason: string | null | undefined;
  maxWidth?: string;
}

export function InlineRejectionReason({
  reason,
  maxWidth = "max-w-[180px]",
}: InlineRejectionReasonProps) {
  if (!reason) return null;

  return (
    <div
      className={cn("mt-1 truncate text-xs text-red-600", maxWidth)}
      title={reason}
    >
      {reason}
    </div>
  );
}
