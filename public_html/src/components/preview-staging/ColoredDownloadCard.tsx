import { cn } from "@/lib/utils";

interface ColoredDownloadCardProps {
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  colorScheme?: "blue" | "amber";
}

const colorMap: Record<
  "blue" | "amber",
  {
    border: string;
    hover: string;
    iconBg: string;
    iconText: string;
    titleText: string;
    subtitleText: string;
  }
> = {
  blue: {
    border: "border-blue-200",
    hover: "hover:bg-blue-50",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    titleText: "text-blue-800",
    subtitleText: "text-blue-500",
  },
  amber: {
    border: "border-amber-200",
    hover: "hover:bg-amber-50",
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    titleText: "text-amber-800",
    subtitleText: "text-amber-500",
  },
};

export function ColoredDownloadCard({
  onClick,
  icon: Icon,
  title,
  subtitle,
  colorScheme = "blue",
}: ColoredDownloadCardProps) {
  const colors = colorMap[colorScheme];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border bg-white transition-colors text-left w-full",
        colors.border,
        colors.hover
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          colors.iconBg
        )}
      >
        <Icon className={cn("h-4 w-4", colors.iconText)} />
      </div>
      <div>
        <p className={cn("font-semibold text-xs", colors.titleText)}>{title}</p>
        <p className={cn("text-xs", colors.subtitleText)}>{subtitle}</p>
      </div>
    </button>
  );
}
