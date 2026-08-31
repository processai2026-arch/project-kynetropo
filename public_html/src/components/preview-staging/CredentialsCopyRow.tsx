import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CredentialsCopyRowProps {
  label: string;
  value: string;
  onCopy: (value: string) => void;
  className?: string;
}

export function CredentialsCopyRow({
  label,
  value,
  onCopy,
  className,
}: CredentialsCopyRowProps) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2 text-sm", className)}>
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-all font-medium">{value}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 shrink-0 p-0"
        onClick={() => onCopy(value)}
        type="button"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
