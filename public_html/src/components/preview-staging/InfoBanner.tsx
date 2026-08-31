import { cn } from "@/lib/utils";

interface InfoBannerProps {
  label: string;
  message: string;
  variant?: "blue" | "amber" | "red" | "green";
  className?: string;
}

const variantStyles: Record<NonNullable<InfoBannerProps["variant"]>, string> = {
  blue:  "bg-blue-50 border-blue-200 text-blue-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  red:   "bg-red-50 border-red-200 text-red-600",
  green: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export function InfoBanner({
  label,
  message,
  variant = "blue",
  className,
}: InfoBannerProps) {
  return (
    <div
      className={cn(
        "mt-4 p-3 border rounded-lg text-sm",
        variantStyles[variant],
        className
      )}
    >
      <span className="font-semibold">{label} </span>
      {message}
    </div>
  );
}
