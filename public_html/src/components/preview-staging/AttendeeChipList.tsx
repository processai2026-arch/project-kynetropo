import { cn } from "@/lib/utils";

export interface AttendeeChipListProps {
  ids: string[];
  nameMap: Record<string, { name: string }>;
  className?: string;
}

export function AttendeeChipList({
  ids,
  nameMap,
  className,
}: AttendeeChipListProps) {
  if (ids.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ids.map((id) => (
        <span
          key={id}
          className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
        >
          {nameMap[id]?.name ?? id}
        </span>
      ))}
    </div>
  );
}
