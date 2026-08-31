import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TypeBadgeProps {
  type: string;
}

const typeStyles: Record<string, string> = {
  call:     "bg-blue-50 text-blue-600 border-blue-200",
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
  email:    "bg-purple-50 text-purple-600 border-purple-200",
  visit:    "bg-amber-50 text-amber-600 border-amber-200",
  sms:      "bg-gray-100 text-gray-600 border-gray-200",
};

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <Badge
      className={cn(
        "border capitalize",
        typeStyles[type] ?? "bg-muted text-muted-foreground"
      )}
    >
      {type}
    </Badge>
  );
}

export default TypeBadge;
