import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionButtonsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewTitle?: string;
  editTitle?: string;
  deleteTitle?: string;
}

export function ActionButtons({ onView, onEdit, onDelete, viewTitle = "View", editTitle = "Edit", deleteTitle = "Delete" }: ActionButtonsProps) {
  return (
    <div className="flex gap-1 justify-end">
      {onView && (
        <Button variant="ghost" size="icon" onClick={onView} title={viewTitle}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="icon" onClick={onEdit} title={editTitle}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="icon" onClick={onDelete} title={deleteTitle}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
