import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConditionallyDisabledActionButtonsProps {
  onEdit: () => void;
  onDelete: () => void;
  locked?: boolean;
}

export function ConditionallyDisabledActionButtons({
  onEdit,
  onDelete,
  locked = false,
}: ConditionallyDisabledActionButtonsProps) {
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        disabled={locked}
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={locked}
        aria-label="Delete"
      >
        <Trash2 className={cn("h-4 w-4", !locked && "text-destructive")} />
      </Button>
    </div>
  );
}
