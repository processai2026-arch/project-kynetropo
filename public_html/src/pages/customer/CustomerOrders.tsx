import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { customerPortalApi } from "@/lib/api/krish";
import type { Order, Product } from "@/types/krish";
import { ArrowLeft, Plus, Loader2, Cpu, Minus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const orderStatusStyles: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-600 border-amber-200",
  confirmed:  "bg-blue-50 text-blue-600 border-blue-200",
  processing: "bg-purple-50 text-purple-600 border-purple-200",
  dispatched: "bg-sky-50 text-sky-600 border-sky-200",
  delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:  "bg-red-50 text-red-600 border-red-200",
};

interface CartItem extends Product {
  qty: number;
}

const EMPTY_FORM = { notes: "", delivery_address: "" };

export default function CustomerOrders() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerPortalApi.orders();
      setOrders((res as any).data ?? []);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openOrderForm = async () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    if (products.length === 0) {
      setProductsLoading(true);
      try {
        const res = await customerPortalApi.products();
        const prods = (res as any).data ?? [];
        setProducts(prods);
        setCart(prods.map((p: Product) => ({ ...p, qty: 0 })));
      } catch {
        toast.error("Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    } else {
      setCart(products.map(p => ({ ...p, qty: 0 })));
    }
  };

  const setQty = (id: number, qty: number) => {
    setCart(c => c.map(item => item.id === id ? { ...item, qty: Math.max(0, qty) } : item));
  };

  const runningTotal = cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = cart.filter(i => i.qty > 0).map(i => ({ product_id: i.id, quantity: i.qty }));
    if (items.length === 0) {
      toast.error("Add at least one product to your order");
      return;
    }
    setSaving(true);
    try {
      await customerPortalApi.placeOrder({
        items,
        notes: form.notes || undefined,
        delivery_address: form.delivery_address || undefined,
      });
      toast.success("Order placed successfully");
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSaving(false);
    }
  };

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="bg-card border-b shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-base">Krish Agencies</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          </div>
          <Button onClick={openOrderForm}>
            <Plus className="h-4 w-4 mr-1" />Place Order
          </Button>
        </div>

        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Order #", "Total (₹)", "Status", "Date", "Expected Delivery"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No orders yet — place your first order</td>
                    </tr>
                  )}
                  {!loading && orders.map(o => (
                    <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{o.order_number}</td>
                      <td className="py-3 px-4 text-card-foreground">₹{Number(o.total_amount).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", orderStatusStyles[o.status] ?? "bg-muted text-muted-foreground")}>
                          {o.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(o.order_date).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {o.expected_delivery ? new Date(o.expected_delivery).toLocaleDateString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Place an Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePlaceOrder} className="space-y-4">
            {/* Product catalog */}
            <div className="space-y-2">
              <Label>Products</Label>
              {productsLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              )}
              {!productsLoading && cart.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No products available</p>
              )}
              {!productsLoading && cart.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">₹{Number(item.unit_price).toLocaleString("en-IN")} / {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQty(item.id, item.qty - 1)}
                      disabled={item.qty === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium text-card-foreground">{item.qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQty(item.id, item.qty + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Running total */}
            {runningTotal > 0 && (
              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-sm font-semibold text-card-foreground">Order Total</span>
                <span className="text-base font-bold text-primary">₹{runningTotal.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Delivery Address</Label>
              <Input
                value={form.delivery_address}
                onChange={e => setField("delivery_address", e.target.value)}
                placeholder="Delivery address"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                placeholder="Any special instructions…"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || productsLoading}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Placing…</> : "Place Order"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
