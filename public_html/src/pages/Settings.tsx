import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, Building2, Lock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function Settings() {
  const { adminEmail, userName } = useAuth();

  // Profile
  const [profile, setProfile] = useState({ name: userName ?? "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Business
  const [business, setBusiness] = useState({ business_name: "", gstin: "" });
  const [savingBusiness, setSavingBusiness] = useState(false);

  // Password
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  // Load existing settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ data: Record<string, string> }>("/admin/settings");
        const d = res.data ?? {};
        if (d.name) setProfile(p => ({ ...p, name: d.name }));
        if (d.phone) setProfile(p => ({ ...p, phone: d.phone }));
        if (d.business_name) setBusiness(p => ({ ...p, business_name: d.business_name }));
        if (d.gstin) setBusiness(p => ({ ...p, gstin: d.gstin }));
      } catch { /* non-critical */ }
    })();
  }, []);

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { toast.error("Name is required"); return; }
    setSavingProfile(true);
    try {
      await apiFetch("/admin/settings", { method: "PUT", body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.trim() }) });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally { setSavingProfile(false); }
  };

  const handleSaveBusiness = async () => {
    if (business.gstin && !GSTIN_REGEX.test(business.gstin)) {
      toast.error("Invalid GSTIN format — should be 15 characters like 27AAPFU0939F1ZV");
      return;
    }
    setSavingBusiness(true);
    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ business_name: business.business_name.trim(), gstin: business.gstin.trim() }),
      });
      toast.success("Business info updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update business info");
    } finally { setSavingBusiness(false); }
  };

  const handleUpdatePassword = async () => {
    if (!pwd.current_password) { toast.error("Enter current password"); return; }
    if (pwd.new_password.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (pwd.new_password !== pwd.confirm_password) { toast.error("Passwords do not match"); return; }
    setSavingPwd(true);
    try {
      await apiFetch("/users/" + "me" + "/password", {
        method: "PUT",
        body: JSON.stringify({ current_password: pwd.current_password, new_password: pwd.new_password }),
      });
      toast.success("Password updated");
      setPwd({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password. Check current password is correct.");
    } finally { setSavingPwd(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />Profile
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={adminEmail ?? ""} disabled className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="9876543210" />
        </div>
        <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
          {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save Profile
        </Button>
      </div>

      {/* Business Information */}
      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />Business Information
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="bname">Business Name</Label>
          <Input id="bname" value={business.business_name} onChange={e => setBusiness(p => ({ ...p, business_name: e.target.value }))} placeholder="RK Electronics Pvt Ltd" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin" className="font-mono"
            value={business.gstin}
            onChange={e => setBusiness(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
            placeholder="27AAPFU0939F1ZV"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground">15-character GST Identification Number</p>
        </div>
        <Button size="sm" onClick={handleSaveBusiness} disabled={savingBusiness}>
          {savingBusiness && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save Business Info
        </Button>
      </div>

      {/* Change Password */}
      <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />Change Password
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="cur-pwd">Current Password</Label>
          <Input id="cur-pwd" type="password" value={pwd.current_password} onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pwd">New Password</Label>
          <Input id="new-pwd" type="password" value={pwd.new_password} onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))} />
          <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf-pwd">Confirm New Password</Label>
          <Input id="conf-pwd" type="password" value={pwd.confirm_password} onChange={e => setPwd(p => ({ ...p, confirm_password: e.target.value }))} />
        </div>
        <Button size="sm" onClick={handleUpdatePassword} disabled={savingPwd}>
          {savingPwd && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Update Password
        </Button>
      </div>
    </div>
  );
}
