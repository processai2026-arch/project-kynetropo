import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewTileProps {
  file: File;
  preview: string | null;
}

export function FilePreviewTile({ file, preview }: FilePreviewTileProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 flex items-center gap-3">
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-16 w-16 rounded object-cover shrink-0"
        />
      ) : (
        <div className="h-16 w-16 rounded bg-muted flex items-center justify-center shrink-0">
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
    </div>
  );
}
