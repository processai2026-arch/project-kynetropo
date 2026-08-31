import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InlineDownloadButtonProps {
  label: string;
  icon: React.ElementType;
  isDownloading: boolean;
  onDownload: () => void;
  className?: string;
}

export function InlineDownloadButton({
  label,
  icon: Icon,
  isDownloading,
  onDownload,
  className,
}: InlineDownloadButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isDownloading}
      onClick={onDownload}
      className={cn("gap-1", className)}
    >
      {isDownloading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {label}
    </Button>
  );
}
