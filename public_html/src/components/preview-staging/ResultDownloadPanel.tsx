import { Download, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ColoredDownloadCardItem {
  blob: Blob;
  filename: string;
  title: string;
  subtitle: string;
  colorScheme: "blue" | "amber";
}

interface ColoredDownloadCardProps extends ColoredDownloadCardItem {}

const colorSchemeStyles: Record<
  ColoredDownloadCardItem["colorScheme"],
  { card: string; title: string; subtitle: string; icon: string; button: string }
> = {
  blue: {
    card: "bg-blue-50 border-blue-200",
    title: "text-blue-800",
    subtitle: "text-blue-600",
    icon: "text-blue-500",
    button:
      "border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400 bg-white",
  },
  amber: {
    card: "bg-amber-50 border-amber-200",
    title: "text-amber-800",
    subtitle: "text-amber-600",
    icon: "text-amber-500",
    button:
      "border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400 bg-white",
  },
};

export function ColoredDownloadCard({
  blob,
  filename,
  title,
  subtitle,
  colorScheme,
}: ColoredDownloadCardProps) {
  const styles = colorSchemeStyles[colorScheme];

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border p-3",
        styles.card
      )}
    >
      <div className="flex items-start gap-2">
        <FileDown className={cn("h-4 w-4 mt-0.5 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold truncate", styles.title)}>
            {title}
          </p>
          <p className={cn("text-xs mt-0.5 truncate", styles.subtitle)}>
            {subtitle}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        className={cn("w-full h-8 text-xs font-medium border", styles.button)}
      >
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Download
      </Button>
    </div>
  );
}

export interface ResultDownloadPanelProps {
  fileCount: number;
  pageCount: number;
  downloads: ColoredDownloadCardItem[];
}

export function ResultDownloadPanel({
  fileCount,
  pageCount,
  downloads,
}: ResultDownloadPanelProps) {
  return (
    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-emerald-800">
        ✓ {fileCount} file{fileCount > 1 ? "s" : ""} processed — {pageCount}{" "}
        page{pageCount > 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {downloads.map((d) => (
          <ColoredDownloadCard key={d.filename} {...d} />
        ))}
      </div>
    </div>
  );
}
