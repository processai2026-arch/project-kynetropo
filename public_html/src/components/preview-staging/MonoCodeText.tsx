import { cn } from "@/lib/utils";

interface MonoCodeTextProps {
  code: string | number;
  className?: string;
}

export function MonoCodeText({ code, className }: MonoCodeTextProps) {
  return (
    <span
      className={cn(
        "text-xs font-mono text-muted-foreground",
        className
      )}
    >
      {code}
    </span>
  );
}

export default MonoCodeText;
