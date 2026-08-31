import { cn } from "@/lib/utils";

interface ApprovalNoteDisplayProps {
  approvalNote?: string;
  rejectionReason?: string;
  reimbursementDate?: string;
  reimbursementReference?: string;
  className?: string;
}

export function ApprovalNoteDisplay({
  approvalNote,
  rejectionReason,
  reimbursementDate,
  reimbursementReference,
  className,
}: ApprovalNoteDisplayProps) {
  const hasContent = approvalNote || rejectionReason || reimbursementReference;

  if (!hasContent) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {approvalNote && (
        <p className="text-sm">
          <strong>Approval note:</strong> {approvalNote}
        </p>
      )}
      {rejectionReason && (
        <p className="text-sm text-destructive">
          <strong>Rejection reason:</strong> {rejectionReason}
        </p>
      )}
      {reimbursementReference && (
        <p className="text-sm">
          <strong>Reimbursement:</strong> {reimbursementDate} · {reimbursementReference}
        </p>
      )}
    </div>
  );
}
