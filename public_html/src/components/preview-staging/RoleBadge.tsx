import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: string;
}

const roleStyles: Record<string, string> = {
  admin:         "bg-purple-50 text-purple-600 border-purple-200",
  manager:       "bg-blue-50 text-blue-600 border-blue-200",
  agent:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  accountant:    "bg-amber-50 text-amber-600 border-amber-200",
  support_staff: "bg-gray-100 text-gray-500 border-gray-200",
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <Badge
      className={cn(
        "border capitalize",
        roleStyles[role] ?? "bg-muted text-muted-foreground"
      )}
    >
      {role.replace(/_/g, " ")}
    </Badge>
  );
}

export default RoleBadge;
