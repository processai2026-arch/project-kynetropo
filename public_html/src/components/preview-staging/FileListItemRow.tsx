import { Loader2 } from "lucide-react";
import { FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FileStatus = "idle" | "uploading" | "parsing" | "done" | "error";

interface FileListItem {
  id: string;
  name: string;
  size: number;
  status: FileStatus;
  errorMessage?: string;
}

interface FileListItemRowProps {
  item: FileListItem;
  onRemove?: (id: string) => void;
}

export function FileListItemRow({ item, onRemove }: FileListItemRowProps) {
  const sizeMb = (item.size / 1024 / 1024).toFixed(1);
  return (
    <div className="flex items-center gap-3 bg-muted/20 border border-border rounded-lg px-3 py-2">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm text-card-foreground truncate">{item.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{sizeMb} MB</span>
      <StatusIcon status={item.status} onRemove={item.status === "idle" && onRemove ? () => onRemove(item.id) : undefined} />
    </div>
  );
}

function StatusIcon({ status, onRemove }: { status: FileStatus; onRemove?: () => void }) {
  if (status === "idle" && onRemove) {
    return (
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    );
  }
  if (status === "uploading" || status === "parsing") {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (status === "done") {
    return <CheckCircle className={cn("h-4 w-4 text-emerald-500")} />;
  }
  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  return null;
}
