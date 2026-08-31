import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { opsPitchesApi } from "@/lib/api/ops";
import type { OpsPitch, OpsClient } from "@/types/ops";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const stageStyles: Record<string, string> = {
  "Advance Paid": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Development":  "bg-blue-50 text-blue-600 border-blue-200",
  "Delivered":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Closed":       "bg-gray-100 text-gray-500 border-gray-200",
};

export default function PitchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData]     = useState<OpsPitch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    opsPitchesApi.get(Number(id))
      .then(res => setData((res as any).data))
      .catch(() => toast.error("Failed to load pitch"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!data) return <div className="p-8 text-muted-foreground">Pitch not found</div>;

  const typeLabels: Record<string, string> = {
    yes_meeting: "YES Meeting", business_forum: "Business Forum",
    cold_outreach: "Cold Outreach", referral_event: "Referral Event",
    online: "Online", other: "Other",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pitches")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {data.date} · {data.city ?? "—"} · {typeLabels[data.type] ?? data.type}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">{typeLabels[data.type] ?? data.type}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ROI Summary */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-card-foreground">ROI Summary</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "Total Spend",   value: "₹" + Number(data.spend).toLocaleString("en-IN"),   color: "text-red-600" },
                { label: "Leads Generated", value: String(data.leads_count),                          color: "text-card-foreground" },
                { label: "Converted",     value: String(data.converted),                              color: "text-emerald-700" },
                { label: "Conversion %",  value: data.conversion_pct + "%",                           color: "text-card-foreground" },
                { label: "Revenue",       value: "₹" + Number(data.revenue).toLocaleString("en-IN"),  color: "text-emerald-700 font-bold" },
                { label: "ROI",           value: data.roi != null ? (data.roi >= 0 ? "+" : "") + data.roi + "%" : "—",
                  color: data.roi != null && data.roi >= 0 ? "text-emerald-700 font-bold text-lg" : "text-red-600 font-bold text-lg" },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center border-b last:border-0 pb-2 last:pb-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn("text-sm", row.color)}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {data.description && (
            <div className="bg-card rounded-xl border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-card-foreground mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.description}</p>
            </div>
          )}
        </div>

        {/* Leads table */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="p-4 border-b">
              <h2 className="text-base font-semibold text-card-foreground">
                Leads from this Pitch ({(data.leads as OpsClient[] ?? []).length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">All clients who listed this event as their source</p>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto eco-float-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {["Client","Stage","Project","Quoted","Received","Status"].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.leads as any[] ?? []).length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">No leads from this pitch yet</td></tr>
                    )}
                    {(data.leads as any[] ?? []).map((lead: any) => (
                      <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <Link to={`/clients/${lead.id}`} className="font-medium text-primary hover:underline">{lead.name}</Link>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={cn("border text-xs capitalize", stageStyles[lead.stage] ?? "bg-muted text-muted-foreground border-border")}>
                            {lead.stage}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-card-foreground">{lead.project_name ?? "—"}</td>
                        <td className="py-3 px-4 text-card-foreground">
                          {lead.quoted != null ? "₹" + Number(lead.quoted).toLocaleString("en-IN") : "—"}
                        </td>
                        <td className="py-3 px-4 text-emerald-700">
                          {lead.received != null ? "₹" + Number(lead.received).toLocaleString("en-IN") : "—"}
                        </td>
                        <td className="py-3 px-4">
                          {lead.payment_status
                            ? <Badge variant="outline" className="capitalize text-xs">{lead.payment_status}</Badge>
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
