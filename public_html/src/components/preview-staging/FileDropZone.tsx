import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  icon?: React.ReactNode;
  label?: string;
  hint?: string;
  className?: string;
}

export function FileDropZone({
  onFiles,
  accept,
  multiple = false,
  icon,
  label = "Drag & drop or click to select",
  hint,
  className,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        className
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        {icon ?? <Upload className="h-10 w-10 opacity-50" />}
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs">{hint}</p>}
      </div>
    </div>
  );
}
