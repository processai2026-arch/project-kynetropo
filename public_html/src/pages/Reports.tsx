import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { reportsApi, type ReportSummary } from "@/lib/api/reports";
import { cn } from "@/lib/utils";

/**
 * The report catalogue: everything the system can tell you about itself, in one
 * place, grouped by the part of the business it answers for.
 *
 * The list comes from the server rather than being written out here, so a report
 * added to the registry appears on this page without anyone remembering to add
 * a card for it.
 */
export default function Reports() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    reportsApi
      .catalogue()
      .then((r) => !cancelled && setReports(r.data?.reports ?? []))
      .catch(() => !cancelled && toast.error("Could not load the report list"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? reports.filter((r) =>
          `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(q),
        )
      : reports;
    // Insertion order is the registry's order, which groups by area already.
    const out = new Map<string, ReportSummary[]>();
    for (const r of matched) {
      if (!out.has(r.category)) out.set(r.category, []);
      out.get(r.category)!.push(r);
    }
    return [...out.entries()];
  }, [reports, query]);

  const total = reports.length;

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${total} report${total === 1 ? "" : "s"} across the pipeline, your clients and the money.`}
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Find a report…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border bg-muted/40" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No report matches “{query}”.
          </p>
        </div>
      ) : (
        grouped.map(([category, items]) => (
          <section key={category} className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{category}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => (
                <Link
                  key={r.id}
                  to={`/reports/${r.id}`}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border bg-card p-5",
                    "transition-colors hover:border-primary/40 hover:bg-muted/40",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BarChart3 className="h-5 w-5" />
                  </span>
                  <ArrowRight className="absolute right-5 top-5 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="space-y-1.5">
                    <h3 className="font-semibold leading-tight text-card-foreground">{r.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{r.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
