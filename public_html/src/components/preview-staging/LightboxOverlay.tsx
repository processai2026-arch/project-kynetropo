import { useEffect } from "react";
import { X } from "lucide-react";
import { AuthImage } from "@/components/AuthImage";
import { AuthVideo } from "@/components/AuthVideo";
import type { ApiRow } from "@/lib/api/phase2";

interface LightboxOverlayProps {
  item: ApiRow | null;
  onClose: () => void;
  isVideo: (item: ApiRow) => boolean;
}

export function LightboxOverlay({ item, onClose, isVideo }: LightboxOverlayProps) {
  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media lightbox"
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <X className="h-7 w-7" />
      </button>
      <div
        className="flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo(item) ? (
          <AuthVideo
            attachmentId={item.attachment_id}
            mimeType={item.mime_type}
            fileName={item.original_name}
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          <AuthImage
            attachmentId={item.attachment_id}
            alt={item.original_name || "Media"}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  );
}
