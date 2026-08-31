import { cn } from "@/lib/utils";

interface BoxCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BoxOverlayProps {
  box: BoxCoords;
  color?: "blue" | "amber";
  label: string;
}

export function BoxOverlay({ box, color = "blue", label }: BoxOverlayProps) {
  return (
    <div
      className={cn(
        "absolute border-2 pointer-events-none",
        color === "blue"
          ? "border-blue-500 bg-blue-400/10"
          : "border-amber-500 bg-amber-400/10"
      )}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <span
        className={cn(
          "absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded",
          color === "blue"
            ? "bg-blue-500 text-white"
            : "bg-amber-500 text-white"
        )}
      >
        {label}
      </span>
    </div>
  );
}
