import React from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PropertyMapCardProps {
  /** Property reference code displayed in monospace (e.g. "PROP-0042") */
  code: string;
  /** Display name / title of the property */
  title: string;
  /** Human-readable status label rendered inside the badge */
  status: string;
  /** Tailwind class string controlling the badge colour — supplied by the caller's status map */
  statusClass: string;
  /** District name; row is hidden when omitted */
  district?: string;
  /** Taluk / sub-district appended after district with a comma */
  taluk?: string;
  /** Land-area string (e.g. "12 acres"); row is hidden when omitted */
  area?: string;
  /** Pre-formatted price string (e.g. "₹45,00,000") */
  price: string;
  /** When false the MapPin button is disabled and dimmed */
  hasGps: boolean;
  /** Fired when the title text or "View Details" button is clicked */
  onViewDetails: () => void;
  /** Fired when the MapPin button is clicked — only active when hasGps is true */
  onOpenMap: () => void;
}

export function PropertyMapCard({
  code,
  title,
  status,
  statusClass,
  district,
  taluk,
  area,
  price,
  hasGps,
  onViewDetails,
  onOpenMap,
}: PropertyMapCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header row: code + title / status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-muted-foreground">{code}</p>
          <p
            className="text-sm font-semibold text-card-foreground mt-0.5 truncate cursor-pointer hover:text-primary transition-colors"
            onClick={onViewDetails}
          >
            {title}
          </p>
        </div>
        <Badge className={cn("border shrink-0 capitalize text-xs", statusClass)}>
          {status}
        </Badge>
      </div>

      {/* Location + price details */}
      <div className="text-xs text-muted-foreground space-y-1">
        {district && (
          <p>
            <span className="font-medium text-card-foreground">{district}</span>
            {taluk ? `, ${taluk}` : ""}
          </p>
        )}
        {area && <p>{area}</p>}
        <p className="text-base font-semibold text-card-foreground">{price}</p>
      </div>

      {/* Action row: view-details button + GPS map-pin button */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-7"
          onClick={onViewDetails}
        >
          View Details
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0",
            hasGps
              ? "text-primary border-primary/30 hover:bg-primary/5"
              : "text-muted-foreground cursor-not-allowed opacity-50"
          )}
          disabled={!hasGps}
          onClick={hasGps ? onOpenMap : undefined}
          aria-label={hasGps ? "Open on map" : "No GPS coordinates available"}
          title={hasGps ? "Open on map" : "No GPS coordinates on record"}
        >
          <MapPin className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default PropertyMapCard;
