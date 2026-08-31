import { cn } from "@/lib/utils";

interface AiListProps {
  title: string;
  icon: React.ElementType;
  tone: string;
  items?: string[];
}

export function AiList({ title, icon: Icon, tone, items = [] }: AiListProps) {
  return (
    <div className="rounded-lg border p-3">
      <div className={cn("mb-2 flex items-center gap-1.5 text-sm font-medium", tone)}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.length === 0 ? (
          <li>—</li>
        ) : (
          items.map((t, i) => (
            <li key={i} className="flex gap-1.5">
              <span>•</span>
              <span>{t}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
