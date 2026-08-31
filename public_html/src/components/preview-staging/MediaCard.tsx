import { ExternalLink, FileText, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthImage } from "@/components/AuthImage";

export interface ApiRow {
  id: string | number;
  type: "photo" | "video" | "external" | string;
  url: string;
  title: string;
  category: string;
  date: string;
  thumbnail_url?: string;
}

interface MediaCardProps {
  m: ApiRow;
  hideCaption?: boolean;
  onDelete: (m: ApiRow) => void;
  onLightbox: (m: ApiRow) => void;
}

function ThumbnailContent({
  m,
  onLightbox,
}: {
  m: ApiRow;
  onLightbox: (m: ApiRow) => void;
}) {
  if (m.type === "photo") {
    return (
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-zoom-in"
        onClick={() => onLightbox(m)}
      >
        <AuthImage src={m.url} alt={m.title} className="w-full h-full object-cover" />
      </button>
    );
  }

  if (m.type === "video") {
    return (
      <button
        type="button"
        className="absolute inset-0 w-full h-full group"
        onClick={() => onLightbox(m)}
      >
        {m.thumbnail_url ? (
          <AuthImage
            src={m.thumbnail_url}
            alt={m.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-md">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </span>
        </span>
      </button>
    );
  }

  if (m.type === "external") {
    return (
      <a
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${m.title} in a new tab`}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
      >
        <ExternalLink className="h-8 w-8" />
        <span className="text-xs font-medium">Open link</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className="absolute inset-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => onLightbox(m)}
    >
      <FileText className="h-10 w-10" />
    </button>
  );
}

export function MediaCard({
  m,
  hideCaption = false,
  onDelete,
  onLightbox,
}: MediaCardProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm flex flex-col">
      <div className="aspect-video bg-muted flex items-center justify-center relative">
        <ThumbnailContent m={m} onLightbox={onLightbox} />
      </div>
      <div className="p-3 flex flex-col flex-1 gap-2">
        {!hideCaption && (
          <div className="font-semibold text-sm truncate text-card-foreground">
            {m.title}
          </div>
        )}
        <span
          className={cn(
            "inline-block self-start text-[10px] font-medium px-2 py-0.5 rounded-full",
            "bg-primary/10 text-primary"
          )}
        >
          {m.category}
        </span>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-muted-foreground">{m.date}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(m)}
            aria-label={`Delete ${m.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
