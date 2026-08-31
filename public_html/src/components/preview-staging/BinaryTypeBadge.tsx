import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BinaryTypeBadgeProps {
  value: string;
  positiveValue: string;
  positiveStyle?: string;
  negativeStyle?: string;
}

const DEFAULT_POSITIVE = "bg-blue-50 text-blue-600 border-blue-200";
const DEFAULT_NEGATIVE = "bg-gray-100 text-gray-500 border-gray-200";

export function BinaryTypeBadge({
  value,
  positiveValue,
  positiveStyle = DEFAULT_POSITIVE,
  negativeStyle = DEFAULT_NEGATIVE,
}: BinaryTypeBadgeProps) {
  return (
    <Badge
      className={cn(
        "border uppercase text-xs",
        value === positiveValue ? positiveStyle : negativeStyle
      )}
    >
      {value}
    </Badge>
  );
}
