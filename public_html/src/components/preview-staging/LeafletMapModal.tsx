import { useEffect } from "react";
import { Map, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeafletMapModalProps {
  /** Ref attached to the empty div that Leaflet mounts into. */
  mapRef: React.RefObject<HTMLDivElement>;
  /** Optional legend node rendered in the header bar beside the title. */
  legend?: React.ReactNode;
  /** Called when the user closes the modal (backdrop click or X button or Escape). */
  onClose: () => void;
}

export function LeafletMapModal({ mapRef, legend, onClose }: LeafletMapModalProps) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Map View"
      onClick={(e) => {
        // Close only when clicking the backdrop, not the card itself
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Map className="h-4 w-4 text-primary" />
            <span className="text-base font-semibold text-card-foreground">Map View</span>
            {legend}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close map"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Leaflet mount target — flex-1 so the map fills all remaining height */}
        <div ref={mapRef} className="flex-1 w-full" />
      </div>
    </div>
  );
}

export default LeafletMapModal;
