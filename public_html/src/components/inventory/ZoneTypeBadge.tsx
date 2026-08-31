import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const ZONE_TYPE_STYLES: Record<string, { label: string; accent: string; bg: string; text: string }> = {
  READY_STOCK:  { label: "Ready Stock",  accent: "border-l-emerald-500", bg: "bg-emerald-100", text: "text-emerald-700" },
  QUARANTINE:   { label: "Quarantine",   accent: "border-l-red-500",     bg: "bg-red-100",     text: "text-red-700"     },
  STAGING:      { label: "Staging",      accent: "border-l-amber-500",   bg: "bg-amber-100",   text: "text-amber-700"   },
  RETURN:       { label: "Return",       accent: "border-l-purple-500",  bg: "bg-purple-100",  text: "text-purple-700"  },
  OVERFLOW:     { label: "Overflow",     accent: "border-l-sky-500",     bg: "bg-sky-100",     text: "text-sky-700"     },
  DAMAGE:       { label: "Damage",       accent: "border-l-rose-500",    bg: "bg-rose-100",    text: "text-rose-700"    },
  TEMP_HOLD:    { label: "Temp Hold",    accent: "border-l-orange-500",  bg: "bg-orange-100",  text: "text-orange-700"  },
  PRODUCTION:   { label: "Production",   accent: "border-l-cyan-500",    bg: "bg-cyan-100",    text: "text-cyan-700"    },
  DISPATCH:     { label: "Dispatch",     accent: "border-l-indigo-500",  bg: "bg-indigo-100",  text: "text-indigo-700"  },
};

export function zoneTypeStyle(zoneType: string) {
  return (
    ZONE_TYPE_STYLES[zoneType] ?? {
      label: zoneType,
      accent: "border-l-slate-400",
      bg: "bg-slate-100",
      text: "text-slate-700",
    }
  );
}

export function ZoneTypeBadge({ type }: { type: string }) {
  const s = zoneTypeStyle(type);
  return (
    <Badge className={cn("border-transparent", s.bg, s.text)}>
      {s.label}
    </Badge>
  );
}
