import { cn } from "@/lib/utils";

interface NetProfitBannerProps {
  label: string;
  value: string;
  className?: string;
}

export function NetProfitBanner({ label, value, className }: NetProfitBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border bg-card p-5",
        className
      )}
    >
      <span className="font-medium text-card-foreground">{label}</span>
      <span className="text-xl font-semibold text-card-foreground">{value}</span>
    </div>
  );
}
