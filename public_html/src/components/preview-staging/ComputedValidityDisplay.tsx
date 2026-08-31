import { cn } from "@/lib/utils";

interface ComputedValidityDisplayProps {
  issued: boolean;
  issuedAt?: string;
  computeFn: (date: string) => string;
  className?: string;
}

export function ComputedValidityDisplay({
  issued,
  issuedAt,
  computeFn,
  className,
}: ComputedValidityDisplayProps) {
  const validity = issued
    ? computeFn(issuedAt ?? "") || "Not set"
    : "Not issued";

  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      Valid until: {validity}
    </div>
  );
}
