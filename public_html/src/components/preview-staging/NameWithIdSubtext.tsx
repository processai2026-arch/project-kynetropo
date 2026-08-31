import { cn } from "@/lib/utils";

interface NameWithIdSubtextProps {
  name: string;
  id: string | number;
  className?: string;
}

export function NameWithIdSubtext({ name, id, className }: NameWithIdSubtextProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="font-medium text-card-foreground">{name}</div>
      <div className="text-xs text-muted-foreground">#{id}</div>
    </div>
  );
}
