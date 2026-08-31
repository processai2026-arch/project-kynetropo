import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface GoogleMapsUrlInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onCoordsExtracted: (lat: number, lng: number) => void;
  lat?: number | null;
  lng?: number | null;
}

export function GoogleMapsUrlInput({
  id,
  value,
  onChange,
  onCoordsExtracted,
  lat,
  lng,
}: GoogleMapsUrlInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    onChange(url);

    // Pattern covers both @lat,lng and ?q=lat,lng share formats
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      onCoordsExtracted(Number(atMatch[1]), Number(atMatch[2]));
      return;
    }
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      onCoordsExtracted(Number(qMatch[1]), Number(qMatch[2]));
    }
  };

  const hasCoords = lat != null && lng != null && lat !== 0 && lng !== 0;

  return (
    <div className="space-y-1.5 col-span-2">
      <Label htmlFor={id}>Google Maps Link</Label>
      <Input
        id={id}
        type="url"
        value={value}
        onChange={handleChange}
        placeholder="Paste Google Maps link — coordinates extracted automatically"
      />
      {hasCoords ? (
        <p className="text-xs text-emerald-600">
          Coordinates: {lat!.toFixed(6)}, {lng!.toFixed(6)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Open Google Maps &rarr; share/copy link &rarr; paste here. Latitude &amp; longitude
          extracted automatically.
        </p>
      )}
    </div>
  );
}

export default GoogleMapsUrlInput;
