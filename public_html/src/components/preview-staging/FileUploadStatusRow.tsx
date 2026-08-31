import { FileText, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileUploadStatus = "idle" | "uploading" | "done" | "error";

export interface FileUploadStatusRowProps {
  id: string;
  fileName: string;
  status: FileUploadStatus;
  onRemove: (id: string) => void;
}

export function FileUploadStatusRow({
  id,
  fileName,
  status,
  onRemove,
}: FileUploadStatusRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-muted/20 border rounded-lg px-3 py-2",
        status === "error" && "border-destructive/40 bg-destructive/5"
      )}
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

      <span className="flex-1 text-sm text-card-foreground truncate">
        {fileName}
      </span>

      {status === "idle" && (
        <button
          type="button"
          aria-label={`Remove ${fileName}`}
          onClick={() => onRemove(id)}
          className="shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {status === "uploading" && (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      )}

      {status === "done" && (
        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
      )}

      {status === "error" && (
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
      )}
    </div>
  );
}
