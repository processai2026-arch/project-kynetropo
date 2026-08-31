import { MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapLinkButtonProps {
  latitude?: number | string | null;
  longitude?: number | string | null;
  mapsUrl?: string | null;
}

/** Guard against bare URLs missing a protocol (e.g. "maps.google.com/...") */
function safeHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return "https://" + url;
}

export function MapLinkButton({ latitude, longitude, mapsUrl }: MapLinkButtonProps) {
  const lat = latitude != null ? Number(latitude) : NaN;
  const lng = longitude != null ? Number(longitude) : NaN;
  const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  if (hasCoords) {
    const href = `https://www.google.com/maps?q=${lat},${lng}&z=16&ll=${lat},${lng}`;
    return (
      <Button className="w-full" variant="outline" asChild>
        <a href={href} target="_blank" rel="noopener noreferrer">
          <MapPin className="h-4 w-4 mr-2" />
          View on Maps
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </Button>
    );
  }

  if (mapsUrl) {
    return (
      <Button className="w-full" variant="outline" asChild>
        <a href={safeHref(mapsUrl)} target="_blank" rel="noopener noreferrer">
          <MapPin className="h-4 w-4 mr-2" />
          View on Maps
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
      </Button>
    );
  }

  return (
    <Button className="w-full" variant="outline" disabled>
      <MapPin className="h-4 w-4 mr-2" />
      No Map Link
    </Button>
  );
}

export default MapLinkButton;
