import type React from "react";
import { ChevronDown, ChevronUp, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReportField {
  key: string;
  label: string;
}

export interface ReportCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  fields: ReportField[];
  fieldMap: Record<string, boolean>;
  expanded: boolean;
  dlExcel: boolean;
  dlPdf: boolean;
  onToggleExpand: () => void;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onResetDefault: () => void;
  onDownload: (format: "excel" | "pdf") => void;
}

export function ReportCard({
  icon: Icon,
  title,
  description,
  fields,
  fieldMap,
  expanded,
  dlExcel,
  dlPdf,
  onToggleExpand,
  onToggle,
  onSelectAll,
  onResetDefault,
  onDownload,
}: ReportCardProps) {
  const selectedCount = Object.values(fieldMap).filter(Boolean).length;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-card-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {selectedCount}/{fields.length} fields
          </span>

          <Button
            size="sm"
            variant="outline"
            disabled={dlExcel}
            onClick={() => onDownload("excel")}
            className="gap-1"
          >
            {dlExcel ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3 w-3" />
            )}
            Excel
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={dlPdf}
            onClick={() => onDownload("pdf")}
            className="gap-1"
          >
            {dlPdf ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            PDF
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onToggleExpand}
            aria-label={expanded ? "Collapse field selector" : "Expand field selector"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-card-foreground">Select Fields</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={onSelectAll}
            >
              Select All
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={onResetDefault}
            >
              Reset Default
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {fields.map((field) => (
              <label
                key={field.key}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm",
                  fieldMap[field.key]
                    ? "bg-primary/5 border-primary/30 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={!!fieldMap[field.key]}
                  onChange={() => onToggle(field.key)}
                  className="rounded"
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
