import { useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface HiddenFileInputTriggerProps {
  accept?: string;
  uploading: boolean;
  onFile: (file: File) => void;
}

export function HiddenFileInputTrigger({
  accept = "image/*,video/*",
  uploading,
  onFile,
}: HiddenFileInputTriggerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <label className="inline-flex">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={uploading}
        onChange={handleChange}
      />
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border cursor-pointer transition-colors",
          uploading
            ? "opacity-60 pointer-events-none"
            : "hover:bg-muted"
        )}
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : "Upload"}
      </span>
    </label>
  );
}
