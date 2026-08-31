import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { vendorCreditsApi, type VendorCredit } from "@/lib/api/vendorCredits";

const STATUS_STYLE: Record<string, string> = {
  draft: "text-muted-foreground",
  applied: "text-emerald-600 font-medium",
  void: "text-destructive line-through",
};

export default function VendorCredits() {
  const qc = useQueryClient();
  const creditsQ = useQuery({ queryKey: ["vendor-credits"], queryFn: () => vendorCreditsApi.list() });
  const vendorsQ = useQuery({ queryKey: ["vendors-lite"], queryFn: vendorCreditsApi.vendors });

  const [open, setOpen] = useState(false);
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
  const [form, setForm] = useState({ vendor_id: "", amount: "", credit_date: new Date().toISOString().slice(0, 10), reason: "" });

  const create = useMutation({
    mutationFn: () => vendorCreditsApi.create({
      vendor_id: Number(form.vendor_id),
      amount: Number(form.amount),
      credit_date: form.credit_date,
      reason: form.reason || undefined,
    }),
    onSuccess: () => { toast.success("Vendor credit created"); setOpen(false); setForm({ vendor_id: "", amount: "", credit_date: new Date().toISOString().slice(0, 10), reason: "" }); qc.invalidateQueries({ queryKey: ["vendor-credits"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create"),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "applied" | "void" }) => vendorCreditsApi.setStatus(id, status),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["vendor-credits"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const credits = creditsQ.data?.data ?? [];
  const totalApplied = credits.filter((c) => c.status === "applied").reduce((s, c) => s + Number(c.amount), 0);

  const sortedCredits = [...credits].sort((a, b) => {
    const av = (a as any)[sortKey] ?? "";
    const bv = (b as any)[sortKey] ?? "";
    const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount"];
    const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor Credits</h1>
          <p className="text-sm text-muted-foreground">Supplier credit notes that reduce what you owe. Applied total: ₹{totalApplied.toLocaleString("en-IN")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            {(sortKey !== "created_at" || sortDir !== "desc") && (
              <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
              </Button>
            )}
            <DialogTrigger asChild><Button>New credit</Button></DialogTrigger>
          </div>
          <DialogContent>
            <DialogHeader><DialogTitle>New vendor credit</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Vendor</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {(vendorsQ.data ?? []).map((v) => <SelectItem key={v.vendor_id} value={String(v.vendor_id)}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount (₹)</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Credit date</Label><Input type="date" value={form.credit_date} onChange={(e) => setForm({ ...form, credit_date: e.target.value })} /></div>
              <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. returned goods, price adjustment" /></div>
            </div>
            <DialogFooter>
              <Button disabled={!form.vendor_id || !Number(form.amount) || create.isPending} onClick={() => create.mutate()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="p-2 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("credit_number")}>Credit #<SortIcon col="credit_number" /></th>
              <th className="p-2 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("vendor_name")}>Vendor<SortIcon col="vendor_name" /></th>
              <th className="p-2 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("credit_date")}>Date<SortIcon col="credit_date" /></th>
              <th className="p-2 text-right cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("amount")}>Amount<SortIcon col="amount" /></th>
              <th className="p-2 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></th>
              <th className="p-2">Actions</th>
            </tr></thead>
            <tbody>
              {sortedCredits.map((c: VendorCredit) => (
                <tr key={c.credit_id} className="border-b">
                  <td className="p-2 font-mono text-xs">{c.credit_number}</td>
                  <td className="p-2">{c.vendor_name ?? c.vendor_id}</td>
                  <td className="p-2">{c.credit_date}</td>
                  <td className="p-2 text-right">₹{Number(c.amount).toLocaleString("en-IN")}</td>
                  <td className={`p-2 ${STATUS_STYLE[c.status] ?? ""}`}>{c.status}</td>
                  <td className="p-2 space-x-2">
                    {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: c.credit_id, status: "applied" })}>Apply</Button>}
                    {c.status !== "void" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus.mutate({ id: c.credit_id, status: "void" })}>Void</Button>}
                  </td>
                </tr>
              ))}
              {credits.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No vendor credits yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
