import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface IconAvatarProps {
  /** A Lucide icon component rendered centered inside the circle */
  icon: LucideIcon;
  /** Container and icon size variant. Defaults to "md" */
  size?: "sm" | "md" | "lg";
  /** Tailwind background class. Defaults to "bg-primary/10" */
  bg?: string;
  /** Tailwind icon color class. Defaults to "text-primary" */
  color?: string;
  /** Extra classes forwarded to the outer div */
  className?: string;
}

const containerSizes: Record<NonNullable<IconAvatarProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const iconSizes: Record<NonNullable<IconAvatarProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function IconAvatar({
  icon: Icon,
  size = "md",
  bg,
  color,
  className,
}: IconAvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0",
        containerSizes[size],
        bg ?? "bg-primary/10",
        className,
      )}
    >
      <Icon className={cn(iconSizes[size], color ?? "text-primary")} />
    </div>
  );
}

export default IconAvatar;
