/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { salesLeadsApi } from "@/lib/api/sales";
import type { ChallengeStatus, LeadStatus, LeadTemperature, PitchEvent } from "@/types/sales";

/** Lead sources the backend already recognises. */
export const LEAD_SOURCES = [
  "website", "referral", "cold_call", "email", "social",
  "event", "walk_in", "partner", "yes", "other",
] as const;

/**
 * A source as people say it: "YES" is the business network, not the word.
 * A lead from a pitch event reads as the event: "YES Meet Kanchipuram".
 */
export function sourceLabel(source: string | null | undefined, chapter?: string | null, pitch?: string | null): string {
  if (pitch) return pitch;
  if (!source) return "";
  if (source.toLowerCase() === "yes") return chapter ? `YES · ${chapter}` : "YES";
  return source.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const CUSTOM = "__custom__";
const NEW_CHAPTER = "__new_chapter__";
const PITCH = "pitch:";

/** The source a pitch event's leads carry: a YES meeting is YES, and so on. */
const PITCH_SOURCE: Record<string, string> = {
  yes_meeting: "yes", business_forum: "event", referral_event: "referral",
  cold_outreach: "cold_call", online: "social", other: "event",
};

/** The pitch events, fetched once per visit and shared by every form. */
let pitchList: Promise<PitchEvent[]> | null = null;
function usePitchEvents(enabled: boolean): PitchEvent[] {
  const [pitches, setPitches] = useState<PitchEvent[]>([]);
  useEffect(() => {
    if (!enabled) return;
    pitchList ??= salesLeadsApi.pitches().catch(() => { pitchList = null; return []; });
    let alive = true;
    void pitchList.then((p) => { if (alive) setPitches(p); });
    return () => { alive = false; };
  }, [enabled]);
  return pitches;
}

const shortDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/** The YES chapters already used, fetched once per visit and shared by every form. */
let chapterList: Promise<string[]> | null = null;
function useChapters(enabled: boolean): string[] {
  const [chapters, setChapters] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    chapterList ??= salesLeadsApi.chapters().catch(() => { chapterList = null; return []; });
    let alive = true;
    void chapterList.then((c) => { if (alive) setChapters(c); });
    return () => { alive = false; };
  }, [enabled]);
  return chapters;
}

/**
 * Which YES chapter: the chapters already used, then "New chapter…" to type
 * one that is not there yet. A chapter typed once is in the list next time.
 */
function ChapterSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const chapters = useChapters(true);
  const known = chapters.some((c) => c.toLowerCase() === value.trim().toLowerCase());
  const [typing, setTyping] = useState(false);
  const showInput = typing || (!!value && chapters.length > 0 && !known);
  const picked = known ? chapters.find((c) => c.toLowerCase() === value.trim().toLowerCase()) ?? value : showInput ? NEW_CHAPTER : "";
  return (
    <div className="space-y-2">
      <Select value={picked} onValueChange={(v) => {
        if (v === NEW_CHAPTER) { setTyping(true); onChange(""); }
        else { setTyping(false); onChange(v); }
      }}>
        <SelectTrigger id={id}><SelectValue placeholder="Select the chapter" /></SelectTrigger>
        <SelectContent>
          {chapters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          <SelectItem value={NEW_CHAPTER}>New chapter…</SelectItem>
        </SelectContent>
      </Select>
      {showInput && (
        <Input autoFocus aria-label="New chapter name" placeholder="Chapter name, e.g. Kanchipuram" value={value} maxLength={120}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/**
 * Lead source picker: the standard list, plus "Other — type your own" for
 * anything not covered. The custom value is stored verbatim, so a source like
 * "IndiaMART" survives exactly as typed rather than collapsing into "other".
 * Choosing YES (the business network) asks which chapter the lead came from.
 * The pitch events (Growth → Pitches) come first: picking one links the lead
 * to it, so the event counts the lead, its quote and the revenue it brings.
 */
export function SourceSelect({
  value,
  onChange,
  chapter = "",
  onChapter,
  pitchId = null,
  onPitch,
  id = "lead-source",
}: {
  value: string;
  onChange: (value: string) => void;
  /** The YES chapter, asked for only while the source is YES. */
  chapter?: string;
  onChapter?: (value: string) => void;
  /** The pitch event picked as the source; offered only with onPitch. */
  pitchId?: number | null;
  onPitch?: (pitch: PitchEvent | null) => void;
  id?: string;
}) {
  const isPreset = (v: string) => (LEAD_SOURCES as readonly string[]).includes(v);
  const [custom, setCustom] = useState(!!value && !isPreset(value));
  const pitches = usePitchEvents(!!onPitch);
  const pitch = pitchId ? pitches.find((p) => p.id === pitchId) : undefined;

  // A value arriving from outside (editing an existing lead) decides the mode.
  useEffect(() => {
    if (value && !isPreset(value)) setCustom(true);
  }, [value]);

  return (
    <div className="space-y-2">
      <Select
        value={pitchId && onPitch ? `${PITCH}${pitchId}` : custom ? CUSTOM : value}
        onValueChange={(v) => {
          if (v.startsWith(PITCH)) {
            const p = pitches.find((x) => `${PITCH}${x.id}` === v);
            if (!p) return;
            const src = PITCH_SOURCE[p.type] ?? "event";
            setCustom(false);
            onPitch?.(p);
            onChange(src);
            if (src === "yes") onChapter?.(p.city || p.name);
            return;
          }
          if (pitchId) onPitch?.(null);
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
          {onPitch && (pitches.length > 0 || pitchId) && (
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Pitch events</SelectLabel>
              {pitchId && !pitch && <SelectItem value={`${PITCH}${pitchId}`}>Pitch event</SelectItem>}
              {pitches.map((p) => (
                <SelectItem key={p.id} value={`${PITCH}${p.id}`}>
                  {p.name} · {shortDate(p.date)}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectGroup>
            {onPitch && pitches.length > 0 && <SelectLabel className="text-xs text-muted-foreground">Other sources</SelectLabel>}
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s} value={s} className={s === "yes" ? undefined : "capitalize"}>
                {s === "yes" ? "YES (business network)" : s.replace(/_/g, " ")}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Other — type your own</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {pitchId && onPitch && (
        <p className="text-xs text-muted-foreground">
          Counted in this event's leads, quotes and ROI under Growth → Pitches.
        </p>
      )}

      {custom && !pitchId && (
        <Input
          autoFocus
          placeholder="Enter the source, e.g. IndiaMART"
          value={value}
          maxLength={60}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {value === "yes" && onChapter && !pitchId && (
        <div className="space-y-1">
          <label htmlFor={`${id}-chapter`} className="text-xs font-medium text-foreground">Which YES chapter? *</label>
          <ChapterSelect id={`${id}-chapter`} value={chapter} onChange={onChapter} />
        </div>
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

/**
 * A meeting link, but only where it will actually open.
 *
 * Links entered before they were checked can be anything — a scheme typo
 * ("htttps://meet.google.com/…"), or a note to self. Rendering those as
 * hyperlinks hides the problem until somebody taps one on their way into the
 * call; shown as plain text, with a nudge, it can be fixed beforehand.
 */
export function MeetingLink({ href, label, className }: { href: string; label?: string; className?: string }) {
  const usable = /^https?:\/\//i.test(href.trim());
  if (!usable) {
    // Wraps rather than truncates: a warning cut off at "not a working link, ed…"
    // is a worse hint than no warning at all.
    return (
      <span className={cn("block break-all text-muted-foreground", className)}>
        {href}
        <span className="ml-1 whitespace-nowrap text-destructive">— not a working link</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn("block truncate text-primary underline", className)}
    >
      {label ?? href}
    </a>
  );
}

export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Where a call or follow-up's subject lives.
 *
 * These records used to belong to a lead and only a lead, so every screen built
 * `/sales/leads/${lead_id}` by hand. One can now belong to a client instead,
 * where that id is null and the hand-built path becomes "/sales/leads/null" —
 * a page that loads and then reports the lead is missing. Asking here keeps the
 * answer in one place, so a screen added later cannot get it wrong.
 *
 * A client opens its full record in the dashboard: that is where its projects,
 * payments and its own follow-up list already are.
 */
export function subjectPath(subject: {
  subject_type?: "lead" | "client";
  lead_id?: number | null;
  client_id?: number | null;
}): string {
  if (subject.subject_type === "client" && subject.client_id) {
    return `/clients/${subject.client_id}`;
  }
  return subject.lead_id ? `/sales/leads/${subject.lead_id}` : "#";
}

/** The subject's display name, falling back for rows written before subjects existed. */
export function subjectLabel(subject: {
  subject_name?: string | null;
  lead_company?: string | null;
  lead_name?: string | null;
  client_name?: string | null;
}): string {
  return (
    subject.subject_name ||
    subject.client_name ||
    subject.lead_company ||
    subject.lead_name ||
    "—"
  );
}
