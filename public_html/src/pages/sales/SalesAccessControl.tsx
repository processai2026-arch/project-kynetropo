import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesAccessApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import type { SalesAccessUser } from "@/types/sales";

/**
 * Admin → Access Control → Sales.
 *
 * Grants are written into the platform's existing RBAC tables, so this screen
 * configures the same roles/permissions the rest of the application uses rather
 * than inventing a parallel system. The server re-checks every change: a
 * non-administrator calling this API directly is rejected.
 */
export default function SalesAccessControl() {
  const { isSalesAdmin, can, loading: accessLoading } = useSalesAccess();
  const allowed = isSalesAdmin || can("sales.challenges.manage");

  const [users, setUsers] = useState<SalesAccessUser[]>([]);
  const [catalog, setCatalog] = useState<Record<string, string[]>>({});
  const [adminOnly, setAdminOnly] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<SalesAccessUser | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (accessLoading || !allowed) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([salesAccessApi.users(), salesAccessApi.permissionCatalog()])
      .then(([u, c]) => {
        if (cancelled) return;
        setUsers(u);
        setCatalog(c.catalog);
        setAdminOnly(c.admin_only);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Could not load access control";
        setError(message);
        toast.error(message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessLoading, allowed]);

  const groups = useMemo(() => Object.entries(catalog), [catalog]);

  const openEditor = (user: SalesAccessUser) => {
    setEditing(user);
    setSelected(user.granted);
  };

  const toggle = (permission: string) =>
    setSelected((s) => (s.includes(permission) ? s.filter((p) => p !== permission) : [...s, permission]));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await salesAccessApi.setPermissions(editing.user_id, selected);
      setUsers((list) =>
        list.map((u) =>
          u.user_id === editing.user_id ? { ...u, granted: res.granted, permissions: res.permissions } : u,
        ),
      );
      toast.success("Sales permissions updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save permissions");
    } finally {
      setSaving(false);
    }
  };

  if (!accessLoading && !allowed) {
    return (
      <SalesLayout>
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Access Control</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only a sales administrator can manage sales permissions.
          </p>
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales Access Control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant sales permissions per user. Owners always hold every sales permission.
        </p>
      </div>

      {loading || accessLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {users.map((u) => (
            <div key={u.user_id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-card-foreground">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {u.staff_role ?? "owner"}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {u.is_admin
                  ? "Full sales access (owner)"
                  : `${u.permissions.length} effective · ${u.granted.length} granted here`}
              </p>

              {!u.is_active && <p className="mt-1 text-xs text-destructive">Account inactive</p>}

              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-9 w-full"
                disabled={u.is_admin}
                title={u.is_admin ? "Owners always hold every sales permission" : undefined}
                onClick={() => openEditor(u)}
              >
                {u.is_admin ? "Owner — all permissions" : "Edit permissions"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.name} — Sales Permissions</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {groups.map(([group, permissions]) => (
              <div key={group} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                <div className="space-y-2">
                  {permissions.map((p) => (
                    <div key={p} className="flex items-start gap-3">
                      <Checkbox
                        id={`perm-${p}`}
                        checked={selected.includes(p)}
                        onCheckedChange={() => toggle(p)}
                        className="mt-0.5"
                      />
                      <Label htmlFor={`perm-${p}`} className="cursor-pointer text-sm font-normal leading-snug">
                        <span className="font-mono text-xs">{p}</span>
                        {adminOnly.includes(p) && (
                          <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            admin
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SalesLayout>
  );
}
