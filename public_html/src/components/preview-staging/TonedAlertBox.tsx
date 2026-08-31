import { cn } from "@/lib/utils";

interface TonedAlertBoxProps {
  variant?: "destructive" | "amber" | "blue";
  title: string;
  children: React.ReactNode;
}

const variantStyles: Record<
  NonNullable<TonedAlertBoxProps["variant"]>,
  { wrapper: string; title: string }
> = {
  destructive: {
    wrapper: "bg-destructive/10 border-destructive/20",
    title: "text-destructive",
  },
  amber: {
    wrapper: "bg-amber-50 border-amber-200",
    title: "text-amber-700",
  },
  blue: {
    wrapper: "bg-blue-50 border-blue-200",
    title: "text-blue-700",
  },
};

export function TonedAlertBox({
  variant = "blue",
  title,
  children,
}: TonedAlertBoxProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("border rounded-lg p-3", styles.wrapper)}>
      <span className={cn("font-semibold text-sm", styles.title)}>{title}</span>
      <p className="text-sm text-muted-foreground mt-1">{children}</p>
    </div>
  );
}
