import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TemperatureBadgeProps {
  temperature?: string;
}

const temperatureStyles: Record<string, string> = {
  hot:  "bg-red-50 text-red-600 border-red-200",
  warm: "bg-amber-50 text-amber-600 border-amber-200",
  cold: "bg-blue-50 text-blue-600 border-blue-200",
};

const FALLBACK_STYLE = "bg-amber-50 text-amber-600 border-amber-200";

export function TemperatureBadge({ temperature }: TemperatureBadgeProps) {
  const value = temperature ?? "warm";
  return (
    <Badge className={cn("border capitalize", temperatureStyles[value] ?? FALLBACK_STYLE)}>
      {value}
    </Badge>
  );
}

export default TemperatureBadge;
