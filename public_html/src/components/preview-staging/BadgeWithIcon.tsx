import { CheckCircle2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BadgeWithIconProps {
  passed: boolean;
  passLabel?: string;
  failLabel?: string;
  icon?: LucideIcon;
}

export function BadgeWithIcon({
  passed,
  passLabel = "Passed",
  failLabel = "Failed",
  icon: Icon = CheckCircle2,
}: BadgeWithIconProps) {
  if (passed) {
    return (
      <Badge className={cn("bg-emerald-500 text-white border-transparent")}>
        <Icon className="h-3 w-3 mr-1" />
        {passLabel}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("text-amber-600 border-amber-300")}>
      {failLabel}
    </Badge>
  );
}
