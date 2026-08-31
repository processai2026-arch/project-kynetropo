import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, PackageCheck, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, qty } from "@/lib/inventoryFormat";
import {
  createTransferOrder, dispatchTransferOrder, getInventoryProducts, getInventoryZones,
  getTransferOrders, receiveTransferOrder, type TransferOrder,
} from "@/lib/api/inventory";

type Line = { product_id: string; quantity: string; batch_number: string; serial_number: string; barcode: string };
const emptyLine = (): Line => ({ product_id: "", quantity: "", batch_number: "", serial_number: "", barcode: "" });

export default function TransferOrders() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [fromZone, setFromZone] = useState("");
  const [toZone, setToZone] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const orders = useQuery({ queryKey: ["inv", "transfers"], queryFn: () => getTransferOrders() });
  const zones = useQuery({ queryKey: ["inv", "zones"], queryFn: getInventoryZones });
  const products = useQuery({ queryKey: ["inv", "products"], queryFn: () => getInventoryProducts({ limit: 500 }) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inv", "transfers"] });
    qc.invalidateQueries({ queryKey: ["inv", "products"] });
    qc.invalidateQueries({ queryKey: ["inv", "movements"] });
  };

  const create = useMutation({
    mutationFn: () => {
      if (!fromZone || !toZone || fromZone === toZone) throw new Error("Choose different source and destination zones");
      if (lines.some((l) => !l.product_id || Number(l.quantity) <= 0)) throw new Error("Each line needs a product and positive quantity");
      return createTransferOrder({
        from_zone_id: Number(fromZone), to_zone_id: Number(toZone), remarks: remarks.trim() || null,
        idempotency_key: crypto.randomUUID(),
        items: lines.map((l) => ({
          product_id: Number(l.product_id), quantity: Number(l.quantity),
          batch_number: l.batch_number.trim() || null, serial_number: l.serial_number.trim() || null,
          barcode: l.barcode.trim() || null,
        })),
      });
    },
    onSuccess: () => {
      toast.success("Transfer order created");
      setCreateOpen(false); setFromZone(""); setToZone(""); setRemarks(""); setLines([emptyLine()]); refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create transfer order"),
  });

  const transition = useMutation({
    mutationFn: ({ order, action }: { order: TransferOrder; action: "dispatch" | "receive" }) =>
      action === "dispatch" ? dispatchTransferOrder(order.transfer_order_id) : receiveTransferOrder(order.transfer_order_id),
    onSuccess: (_, vars) => { toast.success(`Transfer ${vars.action === "dispatch" ? "dispatched" : "received"}`); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transfer action failed"),
  });

  const updateLine = (index: number, field: keyof Line, value: string) =>
    setLines((current) => current.map((line, i) => i === index ? { ...line, [field]: value } : line));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transfer Orders</h1>
          <p className="text-muted-foreground">Create, dispatch, and receive stock between inventory zones.</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Transfer</Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Transfer</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Action</th></tr>
            </thead>
            <tbody>
              {orders.isLoading ? <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
                : (orders.data ?? []).length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No transfer orders yet.</td></tr>
                : (orders.data ?? []).map((order) => (
                  <tr key={order.transfer_order_id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{order.transfer_number}</td>
                    <td className="px-3 py-2"><span>{order.from_zone_name}</span><ArrowRight className="mx-2 inline h-3.5 w-3.5 text-muted-foreground" /><span>{order.to_zone_name}</span></td>
                    <td className="px-3 py-2">{order.item_count ?? "—"} · {qty(order.total_quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(order.created_at)}</td>
                    <td className="px-3 py-2"><Status status={order.status} /></td>
                    <td className="px-3 py-2 text-right">
                      {order.status === "CREATED" && <Button size="sm" className="gap-1" disabled={transition.isPending} onClick={() => transition.mutate({ order, action: "dispatch" })}><Send className="h-3.5 w-3.5" /> Dispatch</Button>}
                      {order.status === "DISPATCHED" && <Button size="sm" className="gap-1" disabled={transition.isPending} onClick={() => transition.mutate({ order, action: "receive" })}><PackageCheck className="h-3.5 w-3.5" /> Receive</Button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Transfer Order</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Zone *"><Select value={fromZone} onValueChange={setFromZone}><SelectTrigger><SelectValue placeholder="Source zone" /></SelectTrigger><SelectContent>{(zones.data ?? []).map((z) => <SelectItem key={z.zone_id} value={String(z.zone_id)}>{z.zone_name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="To Zone *"><Select value={toZone} onValueChange={setToZone}><SelectTrigger><SelectValue placeholder="Destination zone" /></SelectTrigger><SelectContent>{(zones.data ?? []).filter((z) => String(z.zone_id) !== fromZone).map((z) => <SelectItem key={z.zone_id} value={String(z.zone_id)}>{z.zone_name}</SelectItem>)}</SelectContent></Select></Field>
          </div>
          <div className="space-y-3">
            {lines.map((line, index) => {
              const product = (products.data ?? []).find((p) => String(p.inv_product_id) === line.product_id);
              return (
                <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border p-3">
                  <Field label="Product *" className="col-span-5"><Select value={line.product_id} onValueChange={(v) => updateLine(index, "product_id", v)}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{(products.data ?? []).map((p) => <SelectItem key={p.inv_product_id} value={String(p.inv_product_id)}>{p.name} ({p.sku})</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="Quantity *" className="col-span-2"><Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} /></Field>
                  {product?.tracking_type === "BATCH" && <Field label="Batch / Lot" className="col-span-2"><Input value={line.batch_number} onChange={(e) => updateLine(index, "batch_number", e.target.value)} /></Field>}
                  {product?.tracking_type === "SERIAL" && <Field label="Serial" className="col-span-2"><Input value={line.serial_number} onChange={(e) => updateLine(index, "serial_number", e.target.value)} /></Field>}
                  {product?.tracking_type !== "NONE" && <Field label="Barcode" className="col-span-2"><Input value={line.barcode} onChange={(e) => updateLine(index, "barcode", e.target.value)} /></Field>}
                  <div className="col-span-1 flex items-end justify-end"><Button size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((v) => v.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setLines((v) => [...v, emptyLine()])}><Plus className="mr-1 h-4 w-4" /> Add line</Button>
          </div>
          <Field label="Remarks"><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create Transfer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1">{children}</div></div>;
}

function Status({ status }: { status: TransferOrder["status"] }) {
  const style = status === "RECEIVED" ? "bg-emerald-100 text-emerald-700" : status === "DISPATCHED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
  return <Badge className={`border-transparent ${style}`}>{status}</Badge>;
}
