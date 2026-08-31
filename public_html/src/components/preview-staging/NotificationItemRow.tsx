import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCheck, Trash2 } from "lucide-react";

interface NotificationItemRowProps {
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  typeColors: Record<string, string>;
  onMarkRead?: () => void;
  onDelete: () => void;
}

export function NotificationItemRow({
  type,
  title,
  message,
  createdAt,
  isRead,
  typeColors,
  onMarkRead,
  onDelete,
}: NotificationItemRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-3 border-b last:border-0 transition-colors",
        !isRead && "bg-primary/5"
      )}
    >
      <Badge
        className={cn(
          "border text-xs capitalize shrink-0 mt-0.5",
          typeColors[type] ?? "bg-muted text-muted-foreground"
        )}
      >
        {type.replace(/_/g, " ")}
      </Badge>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm",
            isRead ? "text-card-foreground" : "font-semibold text-foreground"
          )}
        >
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(createdAt).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="flex gap-1 shrink-0">
        {!isRead && (
          <Button variant="ghost" size="icon" onClick={onMarkRead}>
            <CheckCheck className="h-4 w-4 text-primary" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
