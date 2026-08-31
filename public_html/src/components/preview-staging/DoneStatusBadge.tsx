import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface DoneStatusBadgeProps {
  done: boolean;
}

export function DoneStatusBadge({ done }: DoneStatusBadgeProps) {
  if (done) {
    return (
      <Badge className="bg-emerald-500 text-white border-emerald-500">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Done
      </Badge>
    );
  }

  return <Badge variant="outline">Pending</Badge>;
}
