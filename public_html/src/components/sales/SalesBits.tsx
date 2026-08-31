import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ChallengeStatus, LeadStatus, LeadTemperature } from "@/types/sales";

/** Lead sources the backend already recognises. */
export const LEAD_SOURCES = [
  "website", "referral", "cold_call", "email", "social",
  "event", "walk_in", "partner", "other",
] as const;

const CUSTOM = "__custom__";

/**
 * Lead source picker: the standard list, plus "Other — type your own" for
 * anything not covered. The custom value is stored verbatim, so a source like
 * "IndiaMART" survives exactly as typed rather than collapsing into "other".
 */
export function SourceSelect({
  value,
  onChange,
  id = "lead-source",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const isPreset = (v: string) => (LEAD_SOURCES as readonly string[]).includes(v);
  const [custom, setCustom] = useState(!!value && !isPreset(value));

  // A value arriving from outside (editing an existing lead) decides the mode.
  useEffect(() => {
    if (value && !isPreset(value)) setCustom(true);
  }, [value]);

  return (
    <div className="space-y-2">
      <Select
        value={custom ? CUSTOM : value}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          {LEAD_SOURCES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Other — type your own</SelectItem>
        </SelectContent>
      </Select>

      {custom && (
        <Input
          autoFocus
          placeholder="Enter the source, e.g. IndiaMART"
          value={value}
          maxLength={60}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/**
 * Small shared presentation pieces for the sales module. Colour is used
 * sparingly — temperature is the one thing that earns a strong accent.
 */

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  hot:  "bg-red-50 text-red-600 border-red-200",
  warm: "bg-amber-50 text-amber-600 border-amber-200",
  cold: "bg-slate-100 text-slate-500 border-slate-200",
};

export function TemperatureBadge({ value, className }: { value: LeadTemperature; className?: string }) {
  return (
    <Badge className={cn("border uppercase tracking-wide text-[10px] font-semibold", TEMPERATURE_STYLES[value], className)}>
      {value}
    </Badge>
  );
}

const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new:               "bg-blue-50 text-blue-600 border-blue-200",
  contacted:         "bg-cyan-50 text-cyan-600 border-cyan-200",
  qualified:         "bg-violet-50 text-violet-600 border-violet-200",
  meeting_scheduled: "bg-indigo-50 text-indigo-600 border-indigo-200",
  proposal:          "bg-amber-50 text-amber-600 border-amber-200",
  onboarding:        "bg-teal-50 text-teal-700 border-teal-200",
  converted:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost:              "bg-red-50 text-red-600 border-red-200",
};

export function LeadStatusBadge({ value, className }: { value: LeadStatus; className?: string }) {
  return (
    <Badge className={cn("border capitalize", LEAD_STATUS_STYLES[value] ?? "bg-muted text-muted-foreground", className)}>
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

const CHALLENGE_STATUS_STYLES: Record<ChallengeStatus, string> = {
  available:   "bg-blue-50 text-blue-600 border-blue-200",
  accepted:    "bg-violet-50 text-violet-600 border-violet-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired:     "bg-[#FF5A1F]/10 text-[#c2410c] border-[#FF5A1F]/30",
  cancelled:   "bg-slate-100 text-slate-500 border-slate-200",
};

export function ChallengeStatusBadge({ value, className }: { value: ChallengeStatus; className?: string }) {
  return (
    <Badge className={cn("border uppercase text-[10px] font-semibold tracking-wide", CHALLENGE_STATUS_STYLES[value], className)}>
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

/** Formats "2026-09-03 11:30:00" for display without pulling in a date library. */
export function formatDateTime(value: string | null | undefined, withTime = true): string {
  if (!value) return "—";
  const normalised = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalised);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatDate(value: string | null | undefined): string {
  return formatDateTime(value, false);
}

/** "11:30:00" → "11:30 AM"; returns "" for a missing time. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}

export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
