import React from "react";
import { cn } from "@/lib/utils";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoxOverlay extends Box {
  id?: string;
  color?: "blue" | "amber" | "green" | "red";
  label?: string;
}

type OverlayColor = "blue" | "amber" | "green" | "red";

const overlayBorderBg: Record<OverlayColor, string> = {
  blue:  "border-blue-500 bg-blue-500/10",
  amber: "border-amber-400 bg-amber-400/10",
  green: "border-emerald-500 bg-emerald-500/10",
  red:   "border-red-500 bg-red-500/10",
};

const overlayLabel: Record<OverlayColor, string> = {
  blue:  "bg-blue-500 text-white",
  amber: "bg-amber-400 text-white",
  green: "bg-emerald-500 text-white",
  red:   "bg-red-500 text-white",
};

interface CropOverlayProps {
  box: Box;
  color: OverlayColor;
  label: string;
}

function CropOverlay({ box, color, label }: CropOverlayProps) {
  return (
    <div
      className={cn("absolute border-2 pointer-events-none", overlayBorderBg[color])}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <span
        className={cn(
          "absolute top-0 left-0 text-[10px] font-medium px-1 leading-5",
          overlayLabel[color]
        )}
      >
        {label}
      </span>
    </div>
  );
}

export interface InteractiveImageCropCanvasProps {
  previewUrl: string;
  imgRef: React.RefObject<HTMLImageElement>;
  drawMode: string | null;
  confirmedBoxes?: BoxOverlay[];
  liveBox?: Box | null;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function InteractiveImageCropCanvas({
  previewUrl,
  imgRef,
  drawMode,
  confirmedBoxes = [],
  liveBox = null,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: InteractiveImageCropCanvasProps) {
  return (
    <div
      className={cn(
        "relative border border-border rounded-lg overflow-hidden select-none",
        drawMode ? "cursor-crosshair" : "cursor-default"
      )}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <img
        ref={imgRef}
        src={previewUrl}
        alt="preview"
        className="w-full block"
        draggable={false}
      />

      {confirmedBoxes.map((box, i) => (
        <CropOverlay
          key={box.id ?? i}
          box={box}
          color={box.color ?? "blue"}
          label={box.label ?? "Region"}
        />
      ))}

      {liveBox && liveBox.w > 4 && liveBox.h > 4 && (
        <CropOverlay box={liveBox} color="amber" label="Drawing" />
      )}
    </div>
  );
}
