import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { accessApi, type Role } from "@/lib/api/accessControl";

export default function AccessControl() {
  const qc = useQueryClient();
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: accessApi.roles });
  const auditQ = useQuery({ queryKey: ["audit"], queryFn: () => accessApi.audit(1) });
  const mfaQ = useQuery({ queryKey: ["mfa"], queryFn: accessApi.mfaStatus });

  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const catalog = rolesQ.data?.catalog ?? {};

  const createRole = useMutation({
    mutationFn: () => accessApi.createRole({ name, permissions: perms }),
    onSuccess: () => { toast.success("Role created"); setName(""); setPerms([]); qc.invalidateQueries({ queryKey: ["roles"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delRole = useMutation({
    mutationFn: (id: number) => accessApi.deleteRole(id),
    onSuccess: () => { toast.success("Role deleted"); qc.invalidateQueries({ queryKey: ["roles"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const togglePerm = (p: string) => setPerms((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Access Control</h1>
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles &amp; Permissions</TabsTrigger>
          <TabsTrigger value="mfa">Two-Factor (MFA)</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-medium">New role</h2>
            <div className="flex gap-2">
              <Input placeholder="Role name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
              <Button disabled={!name || createRole.isPending} onClick={() => createRole.mutate()}>Create</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(catalog).map(([group, list]) => (
                <div key={group} className="rounded border p-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{group}</p>
                  {(list as string[]).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-medium mb-2">Roles</h2>
            <div className="space-y-2">
              {(rolesQ.data?.roles ?? []).map((r: Role) => (
                <div key={r.role_id} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <p className="font-medium">{r.name}{r.is_system && <span className="ml-2 text-xs text-muted-foreground">(system)</span>}</p>
                    <p className="text-xs text-muted-foreground">{r.permissions.join(", ") || "no permissions"}</p>
                  </div>
                  {!r.is_system && <Button variant="destructive" size="sm" onClick={() => delRole.mutate(r.role_id)}>Delete</Button>}
                </div>
              ))}
              {rolesQ.data?.roles?.length === 0 && <p className="text-sm text-muted-foreground">No custom roles yet.</p>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mfa">
          <MfaPanel enrolled={mfaQ.data?.enrolled} enabled={mfaQ.data?.enabled} onChange={() => qc.invalidateQueries({ queryKey: ["mfa"] })} />
        </TabsContent>

        <TabsContent value="audit">
          <Card className="p-4">
            <h2 className="font-medium mb-2">Recent activity</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="p-1">When</th><th className="p-1">User</th><th className="p-1">Action</th><th className="p-1">Table</th></tr></thead>
                <tbody>
                  {(auditQ.data?.data ?? []).map((a) => (
                    <tr key={a.audit_id} className="border-t"><td className="p-1">{a.created_at}</td><td className="p-1">{a.user_name ?? a.user_id ?? "—"}</td><td className="p-1">{a.action}</td><td className="p-1">{a.table_name}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MfaPanel({ enrolled, enabled, onChange }: { enrolled?: boolean; enabled?: boolean; onChange: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const enroll = useMutation({
    mutationFn: accessApi.mfaEnroll,
    onSuccess: (d) => { setSecret(d.secret); setUri(d.otpauth_uri); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const verify = useMutation({
    mutationFn: () => accessApi.mfaVerify(code),
    onSuccess: () => { toast.success("MFA enabled"); setSecret(null); onChange(); },
    onError: (e: any) => toast.error(e?.message ?? "Invalid code"),
  });
  const disable = useMutation({
    mutationFn: accessApi.mfaDisable,
    onSuccess: () => { toast.success("MFA disabled"); onChange(); },
  });

  return (
    <Card className="p-4 space-y-3 max-w-lg">
      <h2 className="font-medium">Two-factor authentication</h2>
      <p className="text-sm text-muted-foreground">Status: {enabled ? "Enabled ✅" : enrolled ? "Enrolled (not verified)" : "Not set up"}</p>
      {enabled ? (
        <Button variant="destructive" onClick={() => disable.mutate()}>Disable MFA</Button>
      ) : secret ? (
        <div className="space-y-2">
          <p className="text-sm">Add this secret to your authenticator app:</p>
          <code className="block rounded bg-muted p-2 text-sm break-all">{secret}</code>
          <p className="text-xs text-muted-foreground break-all">{uri}</p>
          <div className="flex gap-2">
            <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[160px]" />
            <Button onClick={() => verify.mutate()} disabled={code.length !== 6}>Verify &amp; enable</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => enroll.mutate()} disabled={enroll.isPending}>Set up MFA</Button>
      )}
    </Card>
  );
}
