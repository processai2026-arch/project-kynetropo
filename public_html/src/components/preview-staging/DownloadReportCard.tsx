import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DownloadReportCardProps {
  title: string;
  description: string;
  reportType: string;
  downloadingType: string | null;
  onDownload: (type: string) => void;
  buttonLabel?: string;
}

export function DownloadReportCard({
  title,
  description,
  reportType,
  downloadingType,
  onDownload,
  buttonLabel = "Download Excel",
}: DownloadReportCardProps) {
  const isDownloading = downloadingType === reportType;

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-card-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{description}</p>
      <Button
        variant="outline"
        size="sm"
        className={cn("w-full")}
        onClick={() => onDownload(reportType)}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5 mr-1.5" />
        )}
        {buttonLabel}
      </Button>
    </div>
  );
}
