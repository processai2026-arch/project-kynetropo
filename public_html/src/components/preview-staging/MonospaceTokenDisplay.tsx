import { cn } from "@/lib/utils";

interface MonospaceTokenDisplayProps {
  value: string;
  className?: string;
}

export function MonospaceTokenDisplay({
  value,
  className,
}: MonospaceTokenDisplayProps) {
  return (
    <code
      className={cn(
        "text-xs bg-muted px-2 py-1 rounded font-mono break-all",
        className
      )}
    >
      {value}
    </code>
  );
}
