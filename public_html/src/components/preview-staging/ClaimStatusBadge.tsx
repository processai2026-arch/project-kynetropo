import { Badge } from "@/components/ui/badge";

export type ExpenseClaimStatus = "pending" | "approved" | "rejected" | "reimbursed";

export interface ClaimStatusBadgeProps {
  claimStatus: ExpenseClaimStatus;
}

export function ClaimStatusBadge({ claimStatus }: ClaimStatusBadgeProps) {
  if (claimStatus === "approved") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white border-transparent">
        Approved
      </Badge>
    );
  }

  if (claimStatus === "rejected") {
    return <Badge variant="destructive">Rejected</Badge>;
  }

  if (claimStatus === "reimbursed") {
    return (
      <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-transparent">
        Reimbursed
      </Badge>
    );
  }

  return <Badge variant="secondary">Pending</Badge>;
}
