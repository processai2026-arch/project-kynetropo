import { useEffect } from "react";
import { X } from "lucide-react";
import { AuthImage } from "@/components/AuthImage";
import { AuthVideo } from "@/components/AuthVideo";

export interface MediaLightboxProps {
  /** Controls whether the overlay is visible. */
  open: boolean;
  /** Called when the user dismisses the overlay (backdrop click, X button, or Escape key). */
  onClose: () => void;
  /** Attachment ID passed to AuthImage or AuthVideo for authenticated retrieval. */
  attachmentId?: string | number;
  /** When true, renders an AuthVideo player; otherwise renders an AuthImage. */
  isVideo?: boolean;
  /** MIME type forwarded to AuthVideo (e.g. "video/mp4"). */
  mimeType?: string;
  /** Alt text for the image; also used as the dialog aria-label. */
  alt?: string;
  /** Original file name forwarded to AuthVideo for download hints. */
  fileName?: string;
}

/**
 * Full-screen overlay that shows an image at full size or plays a local video
 * with native browser controls. Dismissed by clicking the backdrop, the X
 * button, or pressing Escape.
 */
export function MediaLightbox({
  open,
  onClose,
  attachmentId,
  isVideo = false,
  mimeType,
  alt = "Media",
  fileName,
}: MediaLightboxProps) {
  // Dismiss on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-7 w-7" />
      </button>

      {/* Stop clicks on the media from closing the overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center"
      >
        {isVideo ? (
          <AuthVideo
            attachmentId={attachmentId}
            mimeType={mimeType}
            fileName={fileName}
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          <AuthImage
            attachmentId={attachmentId}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  );
}

export default MediaLightbox;
