import { cn } from "@/lib/utils";

interface InlinePillStatusProps {
  status: string;
  activeValue?: string;
}

export function InlinePillStatus({
  status,
  activeValue = "active",
}: InlinePillStatusProps) {
  const isActive = status === activeValue;

  return (
    <span
      className={cn(
        "text-xs px-3 py-1 rounded-full font-medium",
        isActive
          ? "bg-primary/10 text-primary"
          : "bg-muted text-status-pending"
      )}
    >
      {status}
    </span>
  );
}
