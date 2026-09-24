import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesAccessApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import type { SalesAccessUser } from "@/types/sales";

const STAFF_ROLES = ["sales", "owner", "accountant", "hr", "store_keeper"] as const;

/** A sensible starting set for a new salesperson — no admin-only permissions. */
const SALES_DEFAULT_PERMISSIONS = [
  "sales.dashboard.view",
  "sales.leads.view",
  "sales.leads.create",
  "sales.leads.edit",
  "sales.calls.view",
  "sales.calls.create",
  "sales.followups.view",
  "sales.followups.create",
  "sales.followups.complete",
  "sales.meetings.view",
  "sales.meetings.create",
  "sales.meetings.edit",
  "sales.challenges.view",
  "sales.challenges.accept",
  "sales.challenges.complete",
];

const EMPTY_NEW_USER = { name: "", email: "", phone: "", password: "", staff_role: "sales" };

/**
 * Admin → Access Control → Sales.
 *
 * Grants are written into the platform's existing RBAC tables, so this screen
 * configures the same roles/permissions the rest of the application uses rather
 * than inventing a parallel system. The server re-checks every change: a
 * non-administrator calling this API directly is rejected.
 */
export default function SalesAccessControl() {
  const { me, isSalesAdmin, can, loading: accessLoading } = useSalesAccess();
  const allowed = isSalesAdmin || can("sales.challenges.manage");

  const [users, setUsers] = useState<SalesAccessUser[]>([]);
  const [catalog, setCatalog] = useState<Record<string, string[]>>({});
  const [adminOnly, setAdminOnly] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<SalesAccessUser | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<SalesAccessUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);

  const reload = () =>
    salesAccessApi
      .users()
      .then(setUsers)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not reload users"));

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salesAccessApi.createUser({
        ...newUser,
        // A new salesperson starts with the standard set; an owner needs none,
        // because owners hold every sales permission implicitly.
        permissions: newUser.staff_role === "sales" ? SALES_DEFAULT_PERMISSIONS : [],
      });
      toast.success(`${newUser.name} can now sign in`);
      setCreateOpen(false);
      setNewUser(EMPTY_NEW_USER);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the user");
    } finally {
      setSaving(false);
    }
  };

  const handleRole = async (user: SalesAccessUser, role: string) => {
    try {
      await salesAccessApi.setRole(user.user_id, role);
      toast.success(`${user.name} is now ${role}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the role");
    }
  };

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

  const handleRestoreAccess = async (u: SalesAccessUser) => {
    setSaving(true);
    try {
      await salesAccessApi.restoreAccess(u.user_id);
      toast.success(`${u.name} can use the app again`);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore access");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await salesAccessApi.setPassword(resetUser.user_id, resetPassword);
      toast.success(`New password set for ${resetUser.name} — share it with them`);
      setResetUser(null);
      setResetPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the password");
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Access Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the logins your team uses to sign in to the Kynetropo app — on a phone or on
            the desktop — and grant their permissions. Owners always hold every sales permission.
          </p>
        </div>
        <Button className="h-10 shrink-0" onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Add Sales User
        </Button>
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

              {/* An admin with no staff_role is treated as an owner for
                  backwards compatibility — surface that, it is easy to miss. */}
              {u.staff_role === null && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  No role set, so this account is treated as an owner and holds every sales
                  permission. Set a role below to restrict it.
                </p>
              )}

              {!u.is_active && <p className="mt-1 text-xs text-destructive">Account inactive</p>}

              {/* A missed challenge destroyed this user's app access. Only an
                  administrator can give it back, which is this button. */}
              {u.lockout && (
                <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                  <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    App destroyed — missed challenge
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {u.lockout.challenge_title ?? u.lockout.reason}
                    {u.lockout.locked_at ? ` · ${u.lockout.locked_at}` : ""}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 w-full"
                    disabled={saving}
                    onClick={() => void handleRestoreAccess(u)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Restore app access
                  </Button>
                </div>
              )}

              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="shrink-0 text-xs text-muted-foreground">Role</Label>
                  <Select
                    value={u.staff_role ?? ""}
                    onValueChange={(v) => void handleRole(u, v)}
                    disabled={u.user_id === me?.user_id}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Not set (owner)" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {u.user_id === me?.user_id && (
                  <p className="text-[11px] text-muted-foreground">
                    You cannot change your own role.
                  </p>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full"
                  disabled={u.is_admin}
                  title={u.is_admin ? "Owners always hold every sales permission" : undefined}
                  onClick={() => openEditor(u)}
                >
                  {u.is_admin ? "Owner — all permissions" : "Edit permissions"}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-full text-muted-foreground"
                  disabled={u.user_id === me?.user_id}
                  title={
                    u.user_id === me?.user_id
                      ? "Change your own password from account settings"
                      : "Issue a new app password for this user"
                  }
                  onClick={() => {
                    setResetUser(u);
                    setResetPassword("");
                  }}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Reset app password
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Re-issue an app login when someone is locked out. */}
      <Dialog open={resetUser !== null} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset App Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A new password for <span className="font-medium text-foreground">{resetUser?.name}</span>{" "}
              ({resetUser?.email}). They sign in with it on the phone app and the desktop — share it
              directly and ask them to change it.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="rp-pass">New password *</Label>
              <Input
                id="rp-pass"
                type="text"
                autoComplete="new-password"
                minLength={8}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetUser(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={() => void handleResetPassword()}>
                {saving ? "Saving…" : "Set password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create a login for a sales employee. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sales User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nu-name">Full name *</Label>
              <Input
                id="nu-name"
                value={newUser.name}
                onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">Email *</Label>
              <Input
                id="nu-email"
                type="email"
                autoComplete="off"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                required
              />
              <p className="text-[11px] text-muted-foreground">They sign in with this email.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-phone">Phone *</Label>
              <Input
                id="nu-phone"
                type="tel"
                inputMode="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Login also accepts the phone number instead of the email.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-pass">Temporary password *</Label>
              <Input
                id="nu-pass"
                type="text"
                autoComplete="new-password"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                minLength={8}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                At least 8 characters. Shown in plain text so you can pass it on — ask them to
                change it after the first sign-in.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={newUser.staff_role}
                onValueChange={(v) => setNewUser((u) => ({ ...u, staff_role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {newUser.staff_role === "sales"
                  ? "Starts with the standard salesperson permissions — no lead assignment, conversion or challenge management. You can adjust them afterwards."
                  : newUser.staff_role === "owner"
                    ? "Owners hold every sales permission, including access control."
                    : "Starts with no sales permissions; grant them after creating the account."}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
