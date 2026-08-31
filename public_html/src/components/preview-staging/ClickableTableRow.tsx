import { cn } from "@/lib/utils";

interface ClickableTableRowProps {
  onClick: () => void;
  hoverBg?: string;
  children: React.ReactNode;
}

export function ClickableTableRow({
  onClick,
  hoverBg,
  children,
}: ClickableTableRowProps) {
  return (
    <tr
      className={cn(
        "border-b transition-colors cursor-pointer",
        hoverBg ?? "hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}
