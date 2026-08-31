import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GpsPinButtonProps {
  /** Whether the property has GPS coordinates. Controls styling and interactivity. */
  hasGps: boolean;
  /** Called when the button is clicked. Only fires when hasGps is true. */
  onClick?: () => void;
}

export function GpsPinButton({ hasGps, onClick }: GpsPinButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        "h-7 w-7 shrink-0",
        hasGps
          ? "text-primary border-primary/30 hover:bg-primary/5"
          : "text-muted-foreground cursor-not-allowed opacity-50"
      )}
      title={hasGps ? "Open in Google Maps" : "No GPS data"}
      disabled={!hasGps}
      onClick={hasGps ? onClick : undefined}
    >
      <MapPin className="h-3.5 w-3.5" />
    </Button>
  );
}

export default GpsPinButton;
