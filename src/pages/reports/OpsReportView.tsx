import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { opsReportsApi, type ReportColumn, type ReportResult } from "@/lib/api/opsReports";
import { ReportExportDialog } from "@/components/reports/ReportExportDialog";

/** Formats one cell according to the type the report declared for its column. */
function cell(value: unknown, type: ReportColumn["type"]) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  switch (type) {
    case "money": {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return (
        <span className="tabular-nums">
          {n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
        </span>
      );
    }
    case "number": {
      const n = Number(value);
      return <span className="tabular-nums">{Number.isFinite(n) ? n.toLocaleString("en-IN") : String(value)}</span>;
    }
    case "date":
    case "datetime": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      return (
        <span className="whitespace-nowrap">
          {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          {type === "datetime" && (
            <span className="ml-1.5 text-muted-foreground">
              {" "}
              {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </span>
      );
    }
    case "badge":
      return (
        <Badge variant="secondary" className="whitespace-nowrap font-normal capitalize">
          {String(value).replace(/_/g, " ")}
        </Badge>
      );
    default:
      return <span className="whitespace-pre-line">{String(value)}</span>;
  }
}

/**
 * One report: its rows, the range they cover, and the way out to a file.
 *
 * The table is driven entirely by the columns the server sent with the report,
 * so this screen never needs to know which report it is showing.
 */
export default function OpsReportView() {
  const { id = "" } = useParams();
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    (r: { from: string; to: string }) => {
      setLoading(true);
      opsReportsApi
        .run(id, { from: r.from || undefined, to: r.to || undefined, limit: 5000 })
        .then((res) => setResult(res.data))
        .catch((e) => toast.error(e?.message || "Could not run this report"))
        .finally(() => setLoading(false));
    },
    [id],
  );

  useEffect(() => { load(range); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const report = result?.report;
  const rows = result?.rows ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All reports
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{report?.title ?? "Report"}</h1>
          {report && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{report.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {report?.has_dates && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rv-from" className="text-xs">From</Label>
                <Input
                  id="rv-from"
                  type="date"
                  className="h-10 w-[9.5rem]"
                  value={range.from}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-to" className="text-xs">To</Label>
                <Input
                  id="rv-to"
                  type="date"
                  className="h-10 w-[9.5rem]"
                  value={range.to}
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                />
              </div>
              <Button variant="outline" className="h-10" onClick={() => load(range)} disabled={loading}>
                <RefreshCcw className="mr-1.5 h-4 w-4" /> Apply
              </Button>
            </>
          )}
          <Button className="h-10" onClick={() => setExporting(true)} disabled={loading || !rows.length}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {loading ? "Running…" : `${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"}`}
        </span>
        {result?.truncated && (
          <Badge variant="outline" className="font-normal">
            Cut off at the row limit — narrow the dates to see the rest
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {report?.columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-4 py-3 text-left font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={report?.columns.length || 1} className="px-4 py-14 text-center text-muted-foreground">
                  Running the report…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={report?.columns.length || 1} className="px-4 py-14 text-center text-muted-foreground">
                  Nothing to show for this range.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                  {report?.columns.map((c) => (
                    <td key={c.key} className="max-w-[22rem] truncate px-4 py-3 align-top">
                      {cell(row[c.key], c.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {report && (
        <ReportExportDialog
          open={exporting}
          onOpenChange={setExporting}
          title={report.title}
          columns={report.columns}
          rows={rows}
          hasDates={report.has_dates}
          from={range.from}
          to={range.to}
          onRangeChange={(next) => { setRange(next); load(next); }}
        />
      )}
    </div>
  );
}
