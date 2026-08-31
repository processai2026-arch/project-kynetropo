import { cn } from "@/lib/utils";

interface AvatarWithInitialsFallbackProps {
  photoSrc: string | null;
  name: string;
  size?: "sm" | "md";
}

const sizeMap: Record<"sm" | "md", { container: string; text: string }> = {
  sm: { container: "h-6 w-6", text: "text-[10px]" },
  md: { container: "h-8 w-8", text: "text-xs" },
};

export function AvatarWithInitialsFallback({
  photoSrc,
  name,
  size = "md",
}: AvatarWithInitialsFallbackProps) {
  const { container, text } = sizeMap[size];

  if (photoSrc) {
    return (
      <img
        src={photoSrc}
        alt={name}
        className={cn(container, "rounded-full object-cover border shrink-0")}
      />
    );
  }

  return (
    <div
      className={cn(
        container,
        "rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0",
        text
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
