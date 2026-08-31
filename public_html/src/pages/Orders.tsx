import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ordersApi, customersApi, productsApi } from "@/lib/api/krish";
import type { Order, Customer, Product } from "@/types/krish";
import { ShoppingCart, Plus, Eye, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-600 border-amber-200",
  confirmed:  "bg-blue-50 text-blue-600 border-blue-200",
  processing: "bg-sky-50 text-sky-600 border-sky-200",
  dispatched: "bg-purple-50 text-purple-600 border-purple-200",
  delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:  "bg-gray-100 text-gray-500 border-gray-200",
};

interface CartItem { product_id: number; quantity: number; product_name: string; unit_price: number; }

export default function Orders() {
  const [items, setItems]         = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<Order | null>(null);
  const [saving, setSaving]       = useState(false);

  const [customerId, setCustomerId]     = useState(0);
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [notes, setNotes]               = useState("");
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [editStatus, setEditStatus]     = useState("");
  const [editNotes, setEditNotes]       = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;
      const res = await ordersApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  useEffect(() => {
    customersApi.list({ status: "active" }).then(r => setCustomers((r as any).data ?? [])).catch(() => {});
    productsApi.list({ active: "1" }).then(r => setProducts((r as any).data ?? [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCustomerId(0); setDeliveryAddr(""); setNotes(""); setCart([]);
    setFormOpen(true);
  };

  const openEdit = (o: Order) => {
    setEditing(o);
    setEditStatus(o.status);
    setEditNotes(o.notes ?? "");
    setFormOpen(true);
  };

  const handleCustomerChange = (id: number) => {
    setCustomerId(id);
    const c = customers.find(c => c.id === id);
    setDeliveryAddr(c?.address ?? "");
  };

  const addItem = () => setCart(c => [...c, { product_id: 0, quantity: 1, product_name: "", unit_price: 0 }]);

  const updateCart = (idx: number, field: string, value: unknown) => {
    setCart(c => c.map((item, i) => {
      if (i !== idx) return item;
      if (field === "product_id") {
        const p = products.find(p => p.id === Number(value));
        return { ...item, product_id: Number(value), product_name: p?.name ?? "", unit_price: p?.unit_price ?? 0 };
      }
      return { ...item, [field]: value };
    }));
  };

  const removeItem = (idx: number) => setCart(c => c.filter((_, i) => i !== idx));

  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await ordersApi.update(editing.id, { status: editStatus as Order["status"], notes: editNotes });
        toast.success("Order updated");
      } else {
        if (!customerId) { toast.error("Customer is required"); setSaving(false); return; }
        const validItems = cart.filter(i => i.product_id > 0 && i.quantity > 0);
        if (!validItems.length) { toast.error("Add at least one item"); setSaving(false); return; }
        await ordersApi.create({ customer_id: customerId, items: validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })), notes, delivery_address: deliveryAddr });
        toast.success("Order created");
      }
      setFormOpen(false);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const filtered = search ? items.filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
  ) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Order</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Orders ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Order #","Customer","Total","Status","Order Date","Expected Delivery",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                  ))}</tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No orders found</td></tr>
                )}
                {!loading && filtered.map(o => (
                  <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{o.order_number}</td>
                    <td className="py-3 px-4 text-card-foreground">{o.customer_name ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{Number(o.total_amount).toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[o.status] ?? "bg-muted text-muted-foreground")}>{o.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{o.expected_delivery ? new Date(o.expected_delivery).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Eye className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editing ? `Update Order — ${editing.order_number}` : "New Order"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending","confirmed","processing","dispatched","delivered","cancelled"].map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Customer *</Label>
                  <Select value={customerId ? String(customerId) : ""} onValueChange={v => handleCustomerChange(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Address</Label>
                  <Input value={deliveryAddr} onChange={e => setDeliveryAddr(e.target.value)} placeholder="Delivery address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Special instructions?" />
                </div>
                <section className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Order Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
                  </div>
                  {cart.length === 0 && <p className="text-sm text-muted-foreground">No items added yet.</p>}
                  {cart.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
                      <Select value={item.product_id ? String(item.product_id) : ""} onValueChange={v => updateCart(idx, "product_id", parseInt(v))}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{p.unit_price}/{p.unit}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateCart(idx, "quantity", parseInt(e.target.value) || 1)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  {cart.length > 0 && (
                    <div className="flex justify-end pt-2 border-t">
                      <span className="text-sm font-semibold text-card-foreground">Total: ₹{cartTotal.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </section>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Place Order"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
