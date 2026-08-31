import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadPreviewProps {
  /** The File object selected by the user. */
  file: File;
  /** Data URL or object URL for the file. Omit or pass null/undefined to show the icon placeholder. */
  preview?: string | null;
  /** Extra Tailwind classes applied to the outer container. */
  className?: string;
}

export function FileUploadPreview({ file, preview, className }: FileUploadPreviewProps) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 p-2 flex items-center gap-3", className)}>
      {preview ? (
        <img
          src={preview}
          alt="File preview"
          className="h-16 w-16 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded bg-muted flex items-center justify-center">
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate text-card-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
    </div>
  );
}

export default FileUploadPreview;
