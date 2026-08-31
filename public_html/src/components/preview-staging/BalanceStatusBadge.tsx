import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface BalanceStatusBadgeProps {
  isBalanced: boolean;
}

export function BalanceStatusBadge({ isBalanced }: BalanceStatusBadgeProps) {
  return (
    <Badge
      variant={isBalanced ? "default" : "destructive"}
      className={cn("inline-flex items-center")}
    >
      {isBalanced ? (
        <Check className="mr-1 h-3 w-3" />
      ) : (
        <X className="mr-1 h-3 w-3" />
      )}
      {isBalanced ? "Balanced" : "Out of balance"}
    </Badge>
  );
}
