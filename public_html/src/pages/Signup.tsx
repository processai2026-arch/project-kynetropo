import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/BrandLogo";

type Plan = {
  code: string; name: string; price_monthly: number; price_yearly: number;
  currency: string; trial_days: number; max_users: number | null; features: Record<string, boolean>;
};
type Envelope<T> = { success: boolean; message: string; data: T };

const FEATURE_LABELS: Record<string, string> = {
  invoices: "Invoicing & GST", inventory: "Inventory", hr: "HR & Payroll",
  finance: "Finance & Reports", sales_docs: "Sales documents", ai: "AI insights",
};

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState(params.get("plan") || "trial");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ company_name: "", name: "", email: "", phone: "", password: "" });

  // ── Email OTP verification (required before account creation) ──────────────
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    apiFetch<Envelope<Plan[]>>("/plans")
      .then((res) => {
        const list = res.data ?? [];
        setPlans(list);
        if (!list.some((p) => p.code === selected)) setSelected(list.find((p) => p.code === "trial")?.code ?? list[0]?.code ?? "trial");
      })
      .catch((e) => toast.error(e.message ?? "Could not load plans"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    // Changing the email invalidates any prior verification.
    if (k === "email") { setEmailVerified(false); setOtpSent(false); setOtp(""); }
  };

  const sendOtp = async () => {
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Enter a valid email first"); return; }
    setSendingOtp(true);
    try {
      await apiFetch<Envelope<unknown>>("/auth/send-otp", {
        method: "POST", body: JSON.stringify({ email }), skipCache: true,
      });
      setOtpSent(true);
      toast.success(`Verification code sent to ${email}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send verification code");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.trim().length < 4) { toast.error("Enter the code from your email"); return; }
    setVerifyingOtp(true);
    try {
      await apiFetch<Envelope<{ verified: boolean }>>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ identifier: form.email.trim().toLowerCase(), otp: otp.trim(), purpose: "email_verification" }),
        skipCache: true,
      });
      setEmailVerified(true);
      toast.success("Email verified");
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid or expired code");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified) { toast.error("Please verify your email before creating your account"); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch<Envelope<{ login_url: string; trial_days: number }>>("/signup", {
        method: "POST",
        body: JSON.stringify({ ...form, plan_code: selected }),
        skipCache: true,
      });
      toast.success(res.message ?? "Account created!");
      navigate("/login", { state: { email: form.email, justSignedUp: true } });
    } catch (err: any) {
      toast.error(err?.message ?? "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const price = (p: Plan) => {
    const n = cycle === "monthly" ? p.price_monthly : p.price_yearly;
    if (n === 0) return "Free";
    const sym = p.currency === "INR" ? "₹" : p.currency + " ";
    return `${sym}${n.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
          <BrandLogo className="h-8 max-w-[160px]" fallbackClassName="text-lg" />
        </Link>
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Have an account? <span className="font-medium text-primary">Sign in</span>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Create your {BRAND.name} workspace</h1>
          <p className="mt-3 text-muted-foreground">Start free — set up your company in minutes. No credit card required.</p>
        </div>

        {/* billing cycle toggle */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
            {(["monthly", "yearly"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCycle(c)}
                className={`rounded-md px-4 py-1.5 font-medium capitalize ${cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {c}{c === "yearly" && <span className="ml-1 text-xs opacity-80">save ~2 mo</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading && <p className="col-span-full text-center text-muted-foreground">Loading plans…</p>}
          {plans.map((p) => {
            const active = selected === p.code;
            return (
              <button type="button" key={p.code} onClick={() => setSelected(p.code)}
                className={`rounded-2xl border p-5 text-left transition ${active ? "border-primary ring-2 ring-primary/30 shadow-lg" : "border-border hover:border-primary/50"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.code === "trial" && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{p.trial_days}-day free</span>}
                </div>
                <div className="mt-3"><span className="text-2xl font-bold">{price(p)}</span>{p.price_monthly > 0 && <span className="text-sm text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>}</div>
                <p className="mt-1 text-xs text-muted-foreground">{p.max_users ? `Up to ${p.max_users} users` : "Unlimited users"}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {Object.entries(p.features).filter(([, on]) => on).map(([k]) => (
                    <li key={k} className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">✓</span> {FEATURE_LABELS[k] ?? k}</li>
                  ))}
                </ul>
                {active && <div className="mt-4 text-center text-xs font-medium text-primary">Selected</div>}
              </button>
            );
          })}
        </section>

        {/* Signup form */}
        <section className="mx-auto mt-12 max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Your details</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Plan: <span className="font-medium text-foreground">{plans.find((p) => p.code === selected)?.name ?? "—"}</span>
          </p>
          <form onSubmit={submit} className="space-y-3">
            {[
              { k: "company_name", label: "Company name", type: "text", ph: "Acme Pvt Ltd" },
              { k: "name", label: "Your name", type: "text", ph: "Jane Doe" },
            ].map((f) => (
              <div key={f.k}>
                <label className="mb-1 block text-sm font-medium">{f.label}</label>
                <input required type={f.type} placeholder={f.ph} value={(form as any)[f.k]} onChange={set(f.k as keyof typeof form)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
            ))}

            {/* Email + OTP verification */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Email address {emailVerified && <span className="ml-1 text-xs font-semibold text-primary">✓ verified</span>}
              </label>
              <div className="flex gap-2">
                <input required type="email" placeholder="you@gmail.com" value={form.email} onChange={set("email")} disabled={emailVerified}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70" />
                {!emailVerified && (
                  <button type="button" onClick={sendOtp} disabled={sendingOtp}
                    className="shrink-0 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-60">
                    {sendingOtp ? "Sending…" : otpSent ? "Resend" : "Send code"}
                  </button>
                )}
              </div>
              {otpSent && !emailVerified && (
                <div className="mt-2 flex gap-2">
                  <input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button type="button" onClick={verifyOtp} disabled={verifyingOtp}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
                    {verifyingOtp ? "Verifying…" : "Verify"}
                  </button>
                </div>
              )}
              {otpSent && !emailVerified && <p className="mt-1 text-xs text-muted-foreground">Enter the code we emailed to verify your address.</p>}
            </div>

            {[
              { k: "phone", label: "Phone", type: "tel", ph: "9876543210" },
              { k: "password", label: "Password", type: "password", ph: "At least 8 characters" },
            ].map((f) => (
              <div key={f.k}>
                <label className="mb-1 block text-sm font-medium">{f.label}</label>
                <input required type={f.type} placeholder={f.ph} value={(form as any)[f.k]} onChange={set(f.k as keyof typeof form)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
            ))}
            <button type="submit" disabled={submitting || !emailVerified}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {submitting ? "Creating workspace…" : !emailVerified ? "Verify email to continue" : "Start free trial"}
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            By continuing you agree to {BRAND.name}'s terms. You can invite your team after signup.
          </p>
        </section>
      </main>
    </div>
  );
}
