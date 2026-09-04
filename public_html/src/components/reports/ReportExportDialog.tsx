import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ReportColumn } from "@/lib/api/reports";

/** Row caps offered in the dropdown. */
const ROW_LIMITS = [100, 500, 1000, 5000];

/**
 * Chooses what goes into a file, then writes it.
 *
 * The columns are the report's own, so what you tick here is exactly what the
 * file contains and in the order the table shows it. Both formats are written
 * in the browser from rows that are already on screen -- there is no second
 * fetch, so what you export is what you were looking at.
 */
export function ReportExportDialog({
  open,
  onOpenChange,
  title,
  columns,
  rows,
  hasDates,
  from,
  to,
  onRangeChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  hasDates: boolean;
  from: string;
  to: string;
  onRangeChange: (next: { from: string; to: string }) => void;
}) {
  const [picked, setPicked] = useState<string[]>(() => columns.map((c) => c.key));
  const [limit, setLimit] = useState(500);

  // Re-tick everything whenever the report changes underneath the dialog.
  const allKeys = useMemo(() => columns.map((c) => c.key).join("|"), [columns]);
  const [seenKeys, setSeenKeys] = useState(allKeys);
  if (seenKeys !== allKeys) {
    setSeenKeys(allKeys);
    setPicked(columns.map((c) => c.key));
  }

  const chosen = columns.filter((c) => picked.includes(c.key));
  const exportRows = rows.slice(0, limit);

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  /** The grid both formats are built from: a header row, then the values. */
  const buildMatrix = (): (string | number | null)[][] => [
    chosen.map((c) => c.label),
    ...exportRows.map((r) =>
      chosen.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined) return null;
        // Numbers stay numbers so a spreadsheet can total a column.
        if (c.type === "money" || c.type === "number") {
          const n = Number(v);
          return Number.isFinite(n) ? n : String(v);
        }
        return String(v);
      }),
    ),
  ];

  const fileName = (ext: string) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    return `${slug}-${stamp}.${ext}`;
  };

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!chosen.length) { toast.error("Pick at least one column"); return; }
    const esc = (v: string | number | null) => {
      if (v === null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = buildMatrix().map((row) => row.map(esc).join(",")).join("\r\n");
    // The BOM is what makes Excel read a UTF-8 CSV as UTF-8 rather than as the
    // local codepage, which is why names with accents arrive intact.
    save(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), fileName("csv"));
    toast.success(`${exportRows.length} rows exported`);
    onOpenChange(false);
  };

  // xlsx is a large library and most visits never export, so it is fetched the
  // first time someone actually asks for a workbook rather than shipped with
  // the report page.
  const exportExcel = async () => {
    if (!chosen.length) { toast.error("Pick at least one column"); return; }
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet(buildMatrix());
    // Column widths from the longest value, so nothing opens as ####.
    sheet["!cols"] = chosen.map((c, i) => {
      const longest = buildMatrix().reduce((m, row) => Math.max(m, String(row[i] ?? "").length), 0);
      return { wch: Math.min(46, Math.max(c.label.length + 2, longest + 2)) };
    });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, title.slice(0, 28) || "Report");
    const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
    save(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      fileName("xlsx"),
    );
    toast.success(`${exportRows.length} rows exported`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export {title}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Choose the columns and range to export.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Columns</Label>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setPicked(picked.length === columns.length ? [] : columns.map((c) => c.key))}
            >
              {picked.length === columns.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="grid max-h-52 grid-cols-1 gap-y-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
            {columns.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={picked.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {hasDates && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ex-from">From</Label>
                <Input
                  id="ex-from"
                  type="date"
                  value={from}
                  onChange={(e) => onRangeChange({ from: e.target.value, to })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-to">To</Label>
                <Input
                  id="ex-to"
                  type="date"
                  value={to}
                  onChange={(e) => onRangeChange({ from, to: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Row limit</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROW_LIMITS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n.toLocaleString()} rows</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {exportRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows will be
          exported · {chosen.length} column{chosen.length === 1 ? "" : "s"}.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">CSV</strong> is plain text that opens anywhere.{" "}
          <strong className="text-foreground">Excel</strong> is an .xlsx workbook with typed cells,
          so dates and long numbers survive intact.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" onClick={exportCsv}>
            <FileText className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button onClick={() => void exportExcel()}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReportExportDialog;
