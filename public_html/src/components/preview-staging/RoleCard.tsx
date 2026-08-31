import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RoleCardProps {
  name: string;
  subtitle: string;
  isSystem?: boolean;
  onDelete?: () => void;
}

export function RoleCard({ name, subtitle, isSystem = false, onDelete }: RoleCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border shadow-sm p-4 flex items-start justify-between"
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-card-foreground">{name}</span>
          {isSystem && (
            <Badge className="border bg-muted text-muted-foreground text-xs">
              System
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {!isSystem && (
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
