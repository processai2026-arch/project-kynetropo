import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PhotoThumbnailProps {
  /** Public URL of the photo */
  src: string;
  /** Alt text shown on the img element */
  title: string;
  /** Renders the amber "Featured" badge when true; hides the "Set featured" button */
  isFeatured: boolean;
  /** Called when the thumbnail area is clicked (open lightbox / full-size view) */
  onOpen: () => void;
  /** Called when the delete button is clicked */
  onDelete: () => void;
  /** Called when the "Set featured" button is clicked */
  onSetFeatured: () => void;
}

export function PhotoThumbnail({
  src,
  title,
  isFeatured,
  onOpen,
  onDelete,
  onSetFeatured,
}: PhotoThumbnailProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open photo: ${title}`}
      className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Photo */}
      <img src={src} alt={title} className="w-full h-full object-cover" />

      {/* Featured badge — top-left, amber, always visible when isFeatured */}
      {isFeatured && (
        <span className="absolute top-1 left-1 z-10 flex items-center gap-0.5 bg-amber-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
          <Star className="h-2.5 w-2.5 fill-white stroke-none" />
          Featured
        </span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
        {/* Delete button — top-right */}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete photo"
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "absolute top-1 right-1 h-6 w-6",
            "text-white bg-black/40 hover:bg-destructive"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        {/* Set featured button — bottom-center, hidden when already featured */}
        {!isFeatured && (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Set as featured photo"
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "absolute bottom-1 left-1/2 -translate-x-1/2",
              "text-white text-[10px] h-6 px-2 whitespace-nowrap",
              "bg-black/40 hover:bg-black/60"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSetFeatured();
            }}
          >
            Set featured
          </Button>
        )}
      </div>
    </div>
  );
}

export default PhotoThumbnail;
