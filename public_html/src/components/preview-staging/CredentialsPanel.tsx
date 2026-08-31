import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CredentialsCopyRowProps {
  label: string;
  value: string;
  onCopy: (value: string) => void;
}

function CredentialsCopyRow({ label, value, onCopy }: CredentialsCopyRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="flex-1 truncate font-mono text-sm text-card-foreground">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

export interface CredentialsPanelProps {
  rows: Array<[label: string, value: string]>;
  copyAllText: string;
  emailSent: boolean;
  emailAddress?: string;
  onCopy: (value: string) => void;
}

export function CredentialsPanel({
  rows,
  copyAllText,
  emailSent,
  emailAddress,
  onCopy,
}: CredentialsPanelProps) {
  return (
    <div className="space-y-3 py-2">
      <div
        className={cn(
          "rounded-md px-3 py-2 text-sm",
          emailSent
            ? "bg-emerald-500/10 text-emerald-700"
            : "bg-amber-500/10 text-amber-700"
        )}
      >
        {emailSent
          ? `✓ Credentials emailed to ${emailAddress}`
          : "No email on file — share these credentials manually."}
      </div>

      <div className="rounded-lg border divide-y">
        {rows.map(([label, value]) => (
          <CredentialsCopyRow
            key={label}
            label={label}
            value={value}
            onCopy={onCopy}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => onCopy(copyAllText)}
      >
        <Copy className="h-4 w-4" />
        Copy all
      </Button>
    </div>
  );
}
