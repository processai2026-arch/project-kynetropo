import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MediaLinkRowProps {
  href: string;
  mediaType: "drone" | "tour_360" | string;
  title: string;
  onDelete: () => void;
}

const MEDIA_ICONS: Record<string, string> = {
  drone: "🚁",
  tour_360: "360°",
};

function getIcon(mediaType: string): string {
  return MEDIA_ICONS[mediaType] ?? "🎬";
}

export function MediaLinkRow({ href, mediaType, title, onDelete }: MediaLinkRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      "hover:bg-muted/20 transition-colors"
    )}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <span className="text-2xl leading-none shrink-0" aria-hidden="true">
          {getIcon(mediaType)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-card-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {mediaType?.replace(/_/g, " ")}
          </p>
        </div>
      </a>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`Delete ${title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default MediaLinkRow;
