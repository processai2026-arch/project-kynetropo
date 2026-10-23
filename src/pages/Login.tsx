import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Eye, EyeOff, Share } from "lucide-react";
import { isInstalledApp, useInstallApp } from "@/hooks/useInstallApp";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  // Back to where they were going (the installed app opens on /sales); on a phone with
  // nowhere in particular, the Sales app — the phone's app — rather than the ERP dashboard.
  const from = (useLocation().state as { from?: string } | null)?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await login(email, password);
    if (success) {
      toast.success("Welcome back!");
      navigate(from && from !== "/login" ? from : window.matchMedia("(max-width: 767px)").matches ? "/sales" : "/", { replace: true });
    } else {
      toast.error("Invalid email, password, or unauthorized access");
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
      <Card className="w-full shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <Link to="/" className="mx-auto inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BrandLogo className="h-10 max-w-[210px]" fallbackClassName="text-2xl" />
          </Link>
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">Sign in to your workspace</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Welcome back — enter your credentials to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create a company account
            </Link>
          </p>
        </CardContent>
      </Card>
      <InstallCard />
      </div>
    </div>
  );
};

/**
 * Install puts Kynetropo on the home screen as an app — the same card as Diamond Fencing's
 * sign-in. Chrome and Edge offer it; on an iPhone it is Share → Add to Home Screen.
 */
function InstallCard() {
  const { canInstall, install } = useInstallApp();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isInstalledApp()) return null;
  if (canInstall) {
    return (
      <Button type="button" variant="outline" className="mt-4 w-full bg-card" onClick={() => void install()}>
        <Download className="h-4 w-4" /> Install Kynetropo on this device
      </Button>
    );
  }
  if (!ios) return null;
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border bg-card p-3 text-center text-xs text-muted-foreground">
      To install Kynetropo: tap <Share className="h-3.5 w-3.5" aria-label="Share" /> then “Add to Home Screen”
    </p>
  );
}

export default Login;
