import { useState } from "react";
import { Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MultiStateSettingsPanelProps {
  title: string;
  icon: LucideIcon;
  isEnabled: boolean;
  isEnrolling: boolean;
  secret?: string | null;
  onEnable: () => void;
  onDisable: () => void;
  onVerify: (code: string) => void;
  working: boolean;
  className?: string;
}

export function MultiStateSettingsPanel({
  title,
  icon: Icon,
  isEnabled,
  isEnrolling,
  secret,
  onEnable,
  onDisable,
  onVerify,
  working,
  className,
}: MultiStateSettingsPanelProps) {
  const [code, setCode] = useState("");

  const handleVerify = () => {
    if (!code.trim()) return;
    onVerify(code.trim());
    setCode("");
  };

  return (
    <div className={cn("bg-card rounded-xl border shadow-sm p-6 max-w-lg space-y-4", className)}>
      <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {title}
      </h2>

      {isEnabled ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This feature is currently active. Disabling it will take effect immediately.
          </p>
          <Button variant="destructive" onClick={onDisable} disabled={working}>
            Disable
          </Button>
        </div>
      ) : isEnrolling ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Copy the secret key into your authenticator app, then enter the verification code below to confirm.
          </p>
          {secret && (
            <code className="block rounded-lg bg-muted p-3 text-sm break-all font-mono">
              {secret}
            </code>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              maxLength={8}
            />
            <Button onClick={handleVerify} disabled={working || !code.trim()}>
              Verify
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Not yet configured. Complete setup to enable this feature.
          </p>
          <Button onClick={onEnable} disabled={working}>
            <Shield className="h-4 w-4 mr-2" />
            Set up
          </Button>
        </div>
      )}
    </div>
  );
}
