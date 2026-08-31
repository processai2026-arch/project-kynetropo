import type { ChangeEvent, RefObject } from "react";
import { Paperclip } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FilePickerProps {
  selectedFile: File | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  label?: string;
  required?: boolean;
  id?: string;
}

export function FilePicker({
  selectedFile,
  fileInputRef,
  onFileChange,
  accept,
  label = "File",
  required = false,
  id = "file",
}: FilePickerProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && " *"}
      </Label>

      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className={cn(
            "flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md",
            "border border-input bg-background text-sm",
            "hover:bg-muted/50 transition-colors select-none",
            selectedFile ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate max-w-[220px]">
            {selectedFile ? selectedFile.name : "Choose file…"}
          </span>
        </label>

        <input
          ref={fileInputRef}
          id={id}
          type="file"
          className="hidden"
          accept={accept}
          onChange={onFileChange}
        />
      </div>

      {selectedFile && (
        <p className="text-xs text-muted-foreground">
          {(selectedFile.size / 1024).toFixed(1)} KB &mdash;{" "}
          {selectedFile.type || "unknown type"}
        </p>
      )}
    </div>
  );
}

export default FilePicker;
