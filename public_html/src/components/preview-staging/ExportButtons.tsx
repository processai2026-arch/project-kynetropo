import { Loader2, FileSpreadsheet, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  onExcelClick?: () => void;
  onPdfClick?: () => void;
  excelLoading?: boolean;
  pdfLoading?: boolean;
  excelLabel?: string;
  pdfLabel?: string;
  className?: string;
}

export function ExportButtons({
  onExcelClick,
  onPdfClick,
  excelLoading = false,
  pdfLoading = false,
  excelLabel = "Export Excel",
  pdfLabel = "Export PDF",
  className,
}: ExportButtonsProps) {
  return (
    <div className={`flex gap-2${className ? ` ${className}` : ""}`}>
      {onExcelClick && (
        <Button variant="outline" size="sm" disabled={excelLoading} onClick={onExcelClick} className="gap-1.5">
          {excelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          {excelLabel}
        </Button>
      )}
      {onPdfClick && (
        <Button variant="outline" size="sm" disabled={pdfLoading} onClick={onPdfClick} className="gap-1.5">
          {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          {pdfLabel}
        </Button>
      )}
    </div>
  );
}
