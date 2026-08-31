import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface PhotoLightboxProps {
  src: string;
  caption?: string;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function PhotoLightbox({
  src,
  caption,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: PhotoLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) onPrev();
      if (e.key === "ArrowRight" && index < total - 1) onNext();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, total, onClose, onPrev, onNext]);

  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
        onClick={onClose}
        aria-label="Close photo viewer"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter — hidden when viewing a single image */}
      {total > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full select-none">
          {index + 1} / {total}
        </div>
      )}

      {/* Previous button */}
      {hasPrev && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next button */}
      {hasNext && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image — stops click propagation so it does not close the overlay */}
      <img
        src={src}
        alt={caption ?? ""}
        className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Caption */}
      {caption && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-4 py-1.5 rounded-full max-w-[80vw] truncate whitespace-nowrap select-none">
          {caption}
        </p>
      )}
    </div>
  );
}

export default PhotoLightbox;
