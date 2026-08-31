import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MonospaceSecretBlockProps {
  value: string;
  className?: string;
}

export function MonospaceSecretBlock({ value, className }: MonospaceSecretBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable in non-secure contexts — fail silently
    }
  };

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <code className="block flex-1 rounded-lg bg-muted p-3 text-sm break-all font-mono text-foreground leading-relaxed">
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
