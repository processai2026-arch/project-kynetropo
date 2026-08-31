import { useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AvatarUploadFieldProps {
  previewSrc: string | null;
  onFile: (file: File | undefined) => void;
  onRemove: () => void;
  label?: string;
  hint?: string;
  accept?: string;
}

export function AvatarUploadField({
  previewSrc,
  onFile,
  onRemove,
  label = "Photo",
  hint = "JPG or PNG, max 2 MB",
  accept = "image/jpeg,image/png,image/webp",
}: AvatarUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <Label className="text-sm text-muted-foreground">{label}</Label>
      )}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Avatar preview"
              className="h-20 w-20 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div
              className={cn(
                "h-20 w-20 rounded-full bg-muted flex items-center justify-center",
                "border-2 border-dashed border-border"
              )}
            >
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {previewSrc && (
            <button
              type="button"
              onClick={onRemove}
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full",
                "bg-destructive text-white flex items-center justify-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              )}
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {previewSrc ? "Change photo" : "Upload photo"}
          </Button>
          {hint && (
            <p className="text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
