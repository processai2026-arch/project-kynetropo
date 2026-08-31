import { Search, Eye, Calculator, CheckCircle2, XCircle, ArrowRightCircle, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { quoteRequestsApi, type QuoteRequest, type QuoteStatus } from "@/lib/api/quoteRequests";
import { ScrollableX } from "@/components/ui/scrollable-x";

const statusColors: Record<string, string> = {
  "New":       "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Contacted": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Quoted":    "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  "Closed":    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const decisionColors: Record<string, string> = {
  pending:  "bg-muted text-muted-foreground border-border",
  accepted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  declined: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function QuoteRequests() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("created_at"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [viewQuote, setViewQuote] = useState<QuoteRequest | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<QuoteStatus>("New");
  const [editQuotedPrice, setEditQuotedPrice] = useState("");
  const [editValidUntil, setEditValidUntil] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [converting, setConverting] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  useEffect(() => {
    quoteRequestsApi.list()
      .then(setQuotes)
      .catch(() => toast.error("Failed to load quote requests"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = [...quotes.filter(q => {
    const matchSearch = q.customerName.toLowerCase().includes(search.toLowerCase()) ||
      q.id.toLowerCase().includes(search.toLowerCase()) ||
      q.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || q.status === filterStatus;
    return matchSearch && matchStatus;
  })].sort((a, b) => {
    const av = (a as any)[sortKey] ?? "";
    const bv = (b as any)[sortKey] ?? "";
    const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount","quantityPerMonth"];
    const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const openView = (q: QuoteRequest) => {
    setViewQuote(q);
    setEditNotes(q.adminNotes);
    setEditStatus(q.status);
    setEditQuotedPrice(q.quotedPrice);
    setEditValidUntil(q.validUntil);
    setShowDeclineForm(false);
    setDeclineReason("");
  };

  const refreshQuote = (updated: QuoteRequest) => {
    setQuotes(prev => prev.map(q => (q._quoteId === updated._quoteId ? updated : q)));
    setViewQuote(updated);
  };

  const handleUpdate = async () => {
    if (!viewQuote) return;
    setSaving(true);
    try {
      const res = await quoteRequestsApi.update(viewQuote._quoteId, {
        status:      editStatus,
        adminNotes:  editNotes,
        quotedPrice: editQuotedPrice,
        validUntil:  editValidUntil,
      });
      setQuotes(prev => prev.map(q =>
        q.id === viewQuote.id
          ? { ...q, adminNotes: editNotes, status: editStatus, quotedPrice: editQuotedPrice, validUntil: res.valid_until || editValidUntil }
          : q
      ));
      if (editStatus === "Quoted" && editQuotedPrice) {
        toast.success(res.email_sent
          ? `Quote emailed to ${viewQuote.email}`
          : `Quote saved — email delivery failed`
        );
      } else {
        toast.success(`Quote ${viewQuote.id} updated`);
      }
      setViewQuote(null);
    } catch {
      toast.error("Failed to update quote");
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    if (!viewQuote) return;
    setDeciding(true);
    try {
      const updated = await quoteRequestsApi.accept(viewQuote._quoteId);
      refreshQuote(updated);
      toast.success(`Quote ${viewQuote.id} marked as accepted by customer`);
    } catch {
      toast.error("Failed to record acceptance");
    } finally {
      setDeciding(false);
    }
  };

  const handleDecline = async () => {
    if (!viewQuote) return;
    setDeciding(true);
    try {
      const updated = await quoteRequestsApi.decline(viewQuote._quoteId, declineReason);
      refreshQuote(updated);
      setShowDeclineForm(false);
      setDeclineReason("");
      toast.success(`Quote ${viewQuote.id} marked as declined by customer`);
    } catch {
      toast.error("Failed to record decline");
    } finally {
      setDeciding(false);
    }
  };

  const handleConvert = async () => {
    if (!viewQuote) return;
    setConverting(true);
    try {
      const { orderId } = await quoteRequestsApi.convertToOrder(viewQuote._quoteId);
      setQuotes(prev => prev.map(q => (q._quoteId === viewQuote._quoteId ? { ...q, convertedOrderId: orderId } : q)));
      setViewQuote(prev => (prev ? { ...prev, convertedOrderId: orderId } : prev));
      toast.success(`Quote ${viewQuote.id} converted to order #${orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to convert quote to order");
    } finally {
      setConverting(false);
    }
  };

  const counts = {
    All:       quotes.length,
    New:       quotes.filter(q => q.status === "New").length,
    Contacted: quotes.filter(q => q.status === "Contacted").length,
    Quoted:    quotes.filter(q => q.status === "Quoted").length,
    Closed:    quotes.filter(q => q.status === "Closed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-card-foreground">Quote Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">Custom quotes requested from the Savings Calculator in the mobile app</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["All", "New", "Contacted", "Quoted", "Closed"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 text-sm rounded-full border transition-colors ${
              filterStatus === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, ID, or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(sortKey !== "created_at" || sortDir !== "desc") && (
          <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <ScrollableX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("id")}>Quote ID<SortIcon col="id" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("customerName")}>Customer<SortIcon col="customerName" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("product")}>Product<SortIcon col="product" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("quantityPerMonth")}>Qty/Month<SortIcon col="quantityPerMonth" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("monthlySavings")}>Monthly Savings<SortIcon col="monthlySavings" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("date")}>Date<SortIcon col="date" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("decision")}>Decision<SortIcon col="decision" /></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.map(q => (
                <tr key={q.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-mono text-xs text-primary">{q.id}</td>
                  <td className="p-3">
                    <div className="font-medium text-card-foreground">{q.customerName}</div>
                    <div className="text-xs text-muted-foreground">{q.phone}</div>
                  </td>
                  <td className="p-3 text-card-foreground">{q.product}</td>
                  <td className="p-3 text-card-foreground">{q.quantityPerMonth}</td>
                  <td className="p-3 font-medium text-emerald-400">{q.monthlySavings}</td>
                  <td className="p-3 text-muted-foreground">{q.date}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={statusColors[q.status]}>{q.status}</Badge>
                  </td>
                  <td className="p-3">
                    {q.convertedOrderId ? (
                      <Badge variant="outline" className="bg-sky-500/15 text-sky-400 border-sky-500/30">Order #{q.convertedOrderId}</Badge>
                    ) : (
                      <Badge variant="outline" className={decisionColors[q.decision]}>{q.decision}</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openView(q)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No quote requests found</td></tr>
              )}
            </tbody>
          </table>
        </ScrollableX>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewQuote} onOpenChange={open => !open && setViewQuote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> {viewQuote?.id}
            </DialogTitle>
            <DialogDescription>Quote request from Savings Calculator</DialogDescription>
          </DialogHeader>
          {viewQuote && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Customer info */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="text-card-foreground font-medium">{viewQuote.customerName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="text-card-foreground">{viewQuote.phone}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-card-foreground">{viewQuote.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="text-card-foreground">{viewQuote.date}</span></div>
              </div>

              {/* Savings breakdown */}
              <div className="border border-border rounded-lg p-4 space-y-2 text-sm">
                <h4 className="font-semibold text-card-foreground mb-2">Savings Calculator Results</h4>
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="text-card-foreground">{viewQuote.product}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="text-card-foreground">{viewQuote.quantityPerMonth}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Current Fuel</span><span className="text-card-foreground">{viewQuote.currentFuel}</span></div>
                <div className="border-t border-border my-2" />
                <div className="flex justify-between"><span className="text-muted-foreground">Current ({viewQuote.currentFuel}) Cost</span><span className="text-card-foreground">{viewQuote.currentCost}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">With Biomass Pellets</span><span className="text-card-foreground">{viewQuote.biomassCost}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly Savings</span><span className="text-emerald-400 font-semibold">{viewQuote.monthlySavings}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Annual Savings</span><span className="text-emerald-400 font-semibold">{viewQuote.annualSavings}</span></div>
              </div>

              {/* Admin actions */}
              <div>
                <label className="text-sm font-medium text-card-foreground">Quoted Price</label>
                <Input value={editQuotedPrice} onChange={e => setEditQuotedPrice(e.target.value)} placeholder="e.g. ₹13.50/kg" className="mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground">Valid Until</label>
                <Input type="date" value={editValidUntil} onChange={e => setEditValidUntil(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Defaults to 30 days from when the quote is sent if left blank.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground">Admin Notes</label>
                <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Add notes about this quote..." className="mt-1" rows={3} />
              </div>

              <div>
                <label className="text-sm font-medium text-card-foreground">Update Status</label>
                <Select value={editStatus} onValueChange={v => setEditStatus(v as QuoteStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Contacted">Contacted</SelectItem>
                    <SelectItem value="Quoted">Quoted</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {viewQuote.emailSentAt && (
                <p className="text-xs text-muted-foreground">
                  Email delivery: <span className={viewQuote.emailDeliveryStatus === "sent" ? "text-emerald-400" : "text-rose-400"}>
                    {viewQuote.emailDeliveryStatus || "unknown"}
                  </span> at {new Date(viewQuote.emailSentAt).toLocaleString()}
                </p>
              )}

              {/* Customer decision — accept / decline / convert to order */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-card-foreground flex items-center justify-between">
                  Customer Decision
                  <Badge variant="outline" className={decisionColors[viewQuote.decision]}>{viewQuote.decision}</Badge>
                </h4>

                {viewQuote.decision === "accepted" && viewQuote.acceptedAt && (
                  <p className="text-xs text-muted-foreground">Accepted {viewQuote.decidedByName ? `by ${viewQuote.decidedByName} ` : ""}on {new Date(viewQuote.acceptedAt).toLocaleString()}</p>
                )}
                {viewQuote.decision === "declined" && viewQuote.declinedAt && (
                  <p className="text-xs text-muted-foreground">
                    Declined {viewQuote.decidedByName ? `by ${viewQuote.decidedByName} ` : ""}on {new Date(viewQuote.declinedAt).toLocaleString()}
                    {viewQuote.declineReason ? ` — ${viewQuote.declineReason}` : ""}
                  </p>
                )}

                {viewQuote.convertedOrderId ? (
                  <p className="text-sm text-sky-400 font-medium">Converted to order #{viewQuote.convertedOrderId}</p>
                ) : viewQuote.decision === "pending" ? (
                  !showDeclineForm ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-primary/30 text-primary" onClick={handleAccept} disabled={deciding}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> {deciding ? "Saving…" : "Mark Accepted"}
                      </Button>
                      <Button variant="outline" size="sm" className="text-rose-400 border-rose-500/30" onClick={() => setShowDeclineForm(true)} disabled={deciding}>
                        <XCircle className="h-4 w-4 mr-1" /> Mark Declined
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="Reason for decline (optional)" rows={2} />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-rose-400 border-rose-500/30" onClick={handleDecline} disabled={deciding}>
                          {deciding ? "Saving…" : "Confirm Decline"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowDeclineForm(false)} disabled={deciding}>Cancel</Button>
                      </div>
                    </div>
                  )
                ) : viewQuote.decision === "accepted" ? (
                  <Button size="sm" onClick={handleConvert} disabled={converting}>
                    <ArrowRightCircle className="h-4 w-4 mr-1" /> {converting ? "Converting…" : "Convert to Order"}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewQuote(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving…" : "Save & Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
