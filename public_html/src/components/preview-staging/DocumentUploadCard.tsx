import { FileDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentFile {
  file_name: string;
}

interface DocumentUploadCardProps {
  /** Card heading — also used in button labels and empty-state copy */
  title: string;
  /** Uploaded document. Pass null/undefined to show the empty state */
  document?: DocumentFile | null;
  /** When true the upload button shows a spinner and is disabled */
  uploading?: boolean;
  /** Called when the View button is clicked (only rendered when document exists) */
  onViewClick?: () => void;
  /** Called when the Upload / Replace button is clicked */
  onUploadClick: () => void;
}

export function DocumentUploadCard({
  title,
  document,
  uploading = false,
  onViewClick,
  onUploadClick,
}: DocumentUploadCardProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <h2 className="text-base font-semibold text-card-foreground mb-3">{title}</h2>

      {document ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileDown className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{document.file_name}</span>
          </div>
          <Button variant="outline" className="w-full" onClick={onViewClick}>
            <FileDown className="h-4 w-4 mr-2" />
            View {title}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">
          No {title.toLowerCase()} uploaded yet.
        </p>
      )}

      <Button
        variant="outline"
        className="w-full mt-3"
        disabled={uploading}
        onClick={onUploadClick}
      >
        {uploading ? (
          <>
            <span className="h-4 w-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full inline-block" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {document ? "Replace" : "Upload"} {title}
          </>
        )}
      </Button>
    </div>
  );
}

export default DocumentUploadCard;
