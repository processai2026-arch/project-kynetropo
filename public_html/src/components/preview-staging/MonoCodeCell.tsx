import { cn } from "@/lib/utils";

interface MonoCodeCellProps {
  value: string | null | undefined;
  fallback?: string;
  className?: string;
}

export function MonoCodeCell({ value, fallback = "—", className }: MonoCodeCellProps) {
  return (
    <td className={cn("py-3 px-4 font-mono text-xs text-card-foreground", className)}>
      {value ?? fallback}
    </td>
  );
}
