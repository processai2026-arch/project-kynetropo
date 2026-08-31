import { RefObject } from "react";
import { Camera, FileText, ImageIcon, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface BillUploadZoneProps {
  billUrl: string | undefined;
  dragOver: boolean;
  extracting: boolean;
  cameraRef: RefObject<HTMLInputElement>;
  galleryRef: RefObject<HTMLInputElement>;
  onFile: (file?: File) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onAutoFill: () => void;
  onRemove: () => void;
}

export function BillUploadZone({
  billUrl,
  dragOver,
  extracting,
  cameraRef,
  galleryRef,
  onFile,
  onDrop,
  onDragOver,
  onDragLeave,
  onAutoFill,
  onRemove,
}: BillUploadZoneProps) {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDragOver();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDrop(e);
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed bg-muted/30 p-4 space-y-3 transition-colors",
        dragOver && "border-primary bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Bill / Receipt</Label>
        <span className="text-xs text-muted-foreground">Image or PDF · max 5 MB</span>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {!billUrl && (
        <>
          {dragOver ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 pointer-events-none">
              <Upload className="h-8 w-8 text-primary animate-bounce" />
              <span className="text-sm font-medium text-primary">Drop file here</span>
            </div>
          ) : (
            <>
              <div
                className="flex flex-col items-center justify-center py-4 gap-1 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => galleryRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Drag &amp; drop a file here, or click to browse
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => galleryRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4" />
                  Upload from Gallery
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {billUrl && (
        <div className="space-y-2">
          <div className="relative bg-background rounded-lg border overflow-hidden">
            {billUrl.startsWith("data:image") ? (
              <img
                src={billUrl}
                alt="Bill preview"
                className="w-full max-h-48 object-contain bg-muted/40"
              />
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <FileText className="h-4 w-4" />
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
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => galleryRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={extracting}
              onClick={onAutoFill}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Auto-fill from photo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
