import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayButtonOverlayProps {
  onPlay: () => void;
  className?: string;
}

export function VideoPlayButtonOverlay({ onPlay, className }: VideoPlayButtonOverlayProps) {
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-muted", className)}>
      <button
        onClick={onPlay}
        className="h-full w-full flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors"
        aria-label="Play video"
      >
        <div className="rounded-full bg-black/50 p-3">
          <Play className="h-7 w-7 text-white fill-white" />
        </div>
      </button>
    </div>
  );
}
