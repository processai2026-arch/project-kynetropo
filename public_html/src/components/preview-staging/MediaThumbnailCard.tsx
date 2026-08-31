import { Film, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthImage } from "@/components/AuthImage";
import { cn } from "@/lib/utils";

export interface MediaRow {
  attachment_id: number;
  type?: string;
  mime_type?: string;
  category?: string;
  external_url?: string | null;
  original_name?: string | null;
  caption?: string | null;
}

interface MediaThumbnailCardProps {
  item: MediaRow;
  onOpen: (item: MediaRow) => void;
  onDelete: (attachmentId: number) => void;
}

function isPhoto(m: MediaRow): boolean {
  return (
    m.type === "photo" ||
    String(m.mime_type ?? "").startsWith("image") ||
    m.category === "meeting_photo"
  );
}

function isLocalVideo(m: MediaRow): boolean {
  return (
    !m.external_url &&
    !!m.attachment_id &&
    (String(m.mime_type ?? "").startsWith("video") ||
      m.category === "meeting_video" ||
      /\.(mp4|mov|webm)$/i.test(String(m.original_name ?? "")))
  );
}

export function MediaThumbnailCard({ item, onOpen, onDelete }: MediaThumbnailCardProps) {
  const photo = isPhoto(item);
  const localVideo = isLocalVideo(item);
  const name = item.original_name || "Media";

  return (
    <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
      <div className="aspect-video bg-muted flex items-center justify-center relative">
        {photo ? (
          <AuthImage
            attachmentId={item.attachment_id}
            alt={item.original_name || item.caption || "Media thumbnail"}
            className="h-full w-full object-cover cursor-zoom-in"
            onClick={() => onOpen(item)}
          />
        ) : localVideo ? (
          <button
            type="button"
            onClick={() => onOpen(item)}
            className={cn(
              "h-full w-full flex items-center justify-center",
              "bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
            )}
            aria-label="Play video"
          >
            <div className="rounded-full bg-black/50 p-3">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </button>
        ) : (
          <div className="text-center text-xs text-muted-foreground px-3">
            <Film className="h-6 w-6 mx-auto mb-1" />
            {item.external_url ? "External video" : "Video"}
          </div>
        )}
      </div>

      <div className="p-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{name}</p>
          {item.caption && (
            <p className="text-[11px] text-muted-foreground truncate">{item.caption}</p>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => onDelete(item.attachment_id)}
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
