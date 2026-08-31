import { cn } from "@/lib/utils";

interface RejectionReasonHintProps {
  /** The current record status. The hint renders only when this equals "rejected". */
  status: string;
  /** Full rejection-reason text. Nothing renders when this is empty or nullish. */
  rejectionReason?: string | null;
  /** Optional extra Tailwind classes merged onto the container element. */
  className?: string;
}

export function RejectionReasonHint({
  status,
  rejectionReason,
  className,
}: RejectionReasonHintProps) {
  if (status !== "rejected" || !rejectionReason) return null;

  return (
    <div
      className={cn(
        "mt-1 max-w-[180px] truncate text-xs text-red-600",
        className
      )}
      title={rejectionReason}
    >
      {rejectionReason}
    </div>
  );
}

export default RejectionReasonHint;
