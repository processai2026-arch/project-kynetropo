import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import { customersApi, employeesApi } from "@/lib/api/krish";
import type { Customer, Employee } from "@/types/krish";
import { Users, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = { name: "", email: "", phone: "", password: "" };

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<"customers" | "employees">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [targetType, setTargetType] = useState<"customer" | "employee">("customer");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([
        customersApi.list(),
        employeesApi.list(),
      ]);
      setCustomers((cRes as any).data ?? []);
      setEmployees((eRes as any).data ?? []);
    } catch {
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreateLogin = (person: Customer | Employee, type: "customer" | "employee") => {
    setTargetId(person.id);
    setTargetType(type);
    setForm({ name: person.name, email: person.email, phone: person.phone, password: "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.password || form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ data: { id: number } }>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          user_type: targetType,
        }),
      });
      const newUserId = (res as any).data?.id ?? (res as any).id;
      if (targetType === "customer" && targetId) {
        await customersApi.update(targetId, { user_id: newUserId });
      } else if (targetType === "employee" && targetId) {
        await employeesApi.update(targetId, { user_id: newUserId } as any);
      }
      toast.success("Login account created successfully");
      setFormOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create login");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: "customers" as const, label: "Customers" },
    { key: "employees" as const, label: "Employees" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create portal login accounts for customers and employees.</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "customers" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Customer Accounts ({customers.length})</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Name", "Email", "Phone", "Status", "Portal Login", "Action"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && customers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No customers found</td>
                    </tr>
                  )}
                  {!loading && customers.map(c => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{c.name}</td>
                      <td className="py-3 px-4 text-card-foreground">{c.email}</td>
                      <td className="py-3 px-4 text-card-foreground">{c.phone}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", c.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {c.user_id
                          ? <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                          : <Badge className="border bg-gray-100 text-gray-500 border-gray-200">No Login</Badge>
                        }
                      </td>
                      <td className="py-3 px-4">
                        {!c.user_id && (
                          <Button variant="outline" size="sm" onClick={() => openCreateLogin(c, "customer")}>
                            <UserPlus className="h-4 w-4 mr-1" />Create Login
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "employees" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Employee Accounts ({employees.length})</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Name", "Email", "Phone", "Designation", "Status", "Portal Login", "Action"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      ))}
                    </tr>
                  ))}
                  {!loading && employees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No employees found</td>
                    </tr>
                  )}
                  {!loading && employees.map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{emp.name}</td>
                      <td className="py-3 px-4 text-card-foreground">{emp.email}</td>
                      <td className="py-3 px-4 text-card-foreground">{emp.phone}</td>
                      <td className="py-3 px-4 text-card-foreground">{emp.designation ?? "—"}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", emp.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                          {emp.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {emp.user_id
                          ? <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                          : <Badge className="border bg-gray-100 text-gray-500 border-gray-200">No Login</Badge>
                        }
                      </td>
                      <td className="py-3 px-4">
                        {!emp.user_id && (
                          <Button variant="outline" size="sm" onClick={() => openCreateLogin(emp, "employee")}>
                            <UserPlus className="h-4 w-4 mr-1" />Create Login
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Create Portal Login</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} readOnly className="bg-muted cursor-not-allowed" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Min 8 characters"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Creating…</> : "Create Login"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
