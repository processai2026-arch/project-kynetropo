import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeetingMedia {
  id: number;
  meeting_id: number;
  file_url: string;
  media_type: "image" | "video";
  file_name: string;
  created_at: string;
}

interface MeetingMediaPanelProps {
  meetingId: number;
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

interface HiddenFileInputTriggerProps {
  uploading: boolean;
  onFile: (files: FileList) => void;
}

function HiddenFileInputTrigger({ uploading, onFile }: HiddenFileInputTriggerProps) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onFile(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => ref.current?.click()}
        className="h-7 gap-1.5 text-xs"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        {uploading ? "Uploading…" : "Add"}
      </Button>
    </>
  );
}

interface MediaThumbnailCardProps {
  item: MeetingMedia;
  onDelete: (id: number) => void;
  onOpen: (item: MeetingMedia) => void;
}

function MediaThumbnailCard({ item, onDelete, onOpen }: MediaThumbnailCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await apiFetch(`/admin/meetings/${item.meeting_id}/media/${item.id}`, {
        method: "DELETE",
      });
      onDelete(item.id);
      toast.success("Media removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="group relative rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer aspect-square"
      onClick={() => onOpen(item)}
    >
      {item.media_type === "image" ? (
        <img
          src={item.file_url}
          alt={item.file_name}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-muted/50">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground text-center px-2 truncate max-w-full">
            {item.file_name}
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={deleting}
        onClick={handleDelete}
        className={cn(
          "absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-full",
          "bg-background/80 border border-border text-muted-foreground",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
          deleting && "opacity-100 pointer-events-none"
        )}
      >
        {deleting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

interface LightboxOverlayProps {
  item: MeetingMedia;
  onClose: () => void;
}

function LightboxOverlay({ item, onClose }: LightboxOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-background/20 text-white hover:bg-background/40 transition-colors"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="max-w-4xl max-h-[90vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {item.media_type === "image" ? (
          <img
            src={item.file_url}
            alt={item.file_name}
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <video
            src={item.file_url}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 truncate max-w-sm text-center">
        {item.file_name}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "video/mp4", "video/mov", "video/quicktime"];

export function MeetingMediaPanel({ meetingId }: MeetingMediaPanelProps) {
  const [media, setMedia] = useState<MeetingMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<MeetingMedia | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: MeetingMedia[] }>(`/admin/meetings/${meetingId}/media`);
      setMedia(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [meetingId]);

  const onUpload = async (files: FileList) => {
    const valid = Array.from(files).filter((f) => ALLOWED_MIME.includes(f.type));
    const invalid = Array.from(files).filter((f) => !ALLOWED_MIME.includes(f.type));

    if (invalid.length) {
      toast.error(`${invalid.length} file(s) skipped — only images and videos accepted`);
    }
    if (!valid.length) return;

    setUploading(true);
    let successCount = 0;

    for (const file of valid) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("meeting_id", String(meetingId));

        await apiFetch(`/admin/meetings/${meetingId}/media`, {
          method: "POST",
          body: fd,
        });
        successCount++;
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`);
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded`);
      await load();
    }
  };

  const handleDelete = (id: number) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">
            Media ({loading ? "…" : media.length})
          </h4>
          <HiddenFileInputTrigger uploading={uploading} onFile={onUpload} />
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        )}

        {!loading && media.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border border-dashed border-border bg-muted/20">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No media attached yet</p>
          </div>
        )}

        {!loading && media.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {media.map((item) => (
              <MediaThumbnailCard
                key={item.id}
                item={item}
                onDelete={handleDelete}
                onOpen={setLightbox}
              />
            ))}
          </div>
        )}
      </section>

      {lightbox && (
        <LightboxOverlay item={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
