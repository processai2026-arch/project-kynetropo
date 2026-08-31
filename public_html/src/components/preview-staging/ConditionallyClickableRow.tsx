import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ConditionallyClickableRowProps {
  linkId: string | number | null | undefined;
  onNavigate: () => void;
  children: ReactNode;
  className?: string;
}

export function ConditionallyClickableRow({
  linkId,
  onNavigate,
  children,
  className,
}: ConditionallyClickableRowProps) {
  const isClickable = Boolean(linkId);

  return (
    <tr
      className={cn(
        "border-b transition-colors",
        isClickable && "hover:bg-muted/30 cursor-pointer",
        className
      )}
      onClick={() => {
        if (isClickable) onNavigate();
      }}
    >
      {children}
    </tr>
  );
}
