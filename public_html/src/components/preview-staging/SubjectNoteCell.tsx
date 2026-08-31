import { cn } from "@/lib/utils";

interface SubjectNoteCellProps {
  subject: string;
  notes?: string | null;
}

export function SubjectNoteCell({ subject, notes }: SubjectNoteCellProps) {
  return (
    <td className="px-4 py-3">
      <div className={cn("font-medium text-card-foreground")}>{subject}</div>
      {notes && (
        <div className="text-xs text-muted-foreground max-w-xs truncate">
          {notes}
        </div>
      )}
    </td>
  );
}
