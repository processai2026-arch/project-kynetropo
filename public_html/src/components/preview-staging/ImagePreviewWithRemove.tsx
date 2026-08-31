import { X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImagePreviewWithRemoveProps {
  src: string;
  onRemove: () => void;
}

export function ImagePreviewWithRemove({ src, onRemove }: ImagePreviewWithRemoveProps) {
  const isImage = src.startsWith("data:image");

  return (
    <div className={cn("relative bg-background rounded-lg border overflow-hidden")}>
      {isImage ? (
        <img
          src={src}
          alt="Attachment preview"
          className="w-full max-h-48 object-contain bg-muted/40"
        />
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Upload className="h-4 w-4" />
          PDF attached
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute top-2 right-2 h-7 w-7"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
