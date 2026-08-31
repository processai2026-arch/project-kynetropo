import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SourceBadgeProps {
  linkedId: number | undefined;
  className?: string;
}

export function sourceBadgeClasses(linkedId: number | undefined): string {
  return linkedId
    ? "bg-blue-50 text-blue-600 border-blue-200"
    : "bg-gray-100 text-gray-500 border-gray-200";
}

export function SourceBadge({ linkedId, className }: SourceBadgeProps) {
  return (
    <Badge className={cn("border text-xs", sourceBadgeClasses(linkedId), className)}>
      {linkedId ? "Auto" : "Manual"}
    </Badge>
  );
}
