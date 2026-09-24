/**
 * Formatting — one answer per question, used by every screen and every print.
 *
 * Dates are written `13.09.2026`;
 * money is INR with Indian digit grouping (`₹1,23,456.00`). Both are built by
 * hand rather than through `Intl`, so a browser's ICU build can never change
 * what a screen or a print says.
 *
 * Date-only strings from the API (`2026-09-13`) are read as LOCAL dates.
 * `new Date("2026-09-13")` is UTC midnight — the previous evening anywhere
 * west of Greenwich — which is the classic off-by-one on a due date.
 *
 * Display only. Nothing here is authoritative for money: the server computes
 * every bill, and these functions only print what it sent.
 */

export type DateInput = string | Date | null | undefined;
export type NumberInput = number | string | null | undefined;

/** What an empty value renders as, everywhere. */
export const DASH = "—";

// ── Numbers & money ────────────────────────────────────────────────────────

/**
 * A number from whatever the wire sent. PHP returns DECIMAL columns as strings
 * ("1250.00"), so every money helper takes both. Blank and garbage are null,
 * never NaN.
 */
export function toNumber(value: NumberInput): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Round half away from zero without binary drift.
 *
 * `(1.005).toFixed(2)` is "1.00" because 1.005 is stored as 1.00499…; shifting
 * the decimal point through the string form rounds the number a person typed.
 */
function roundTo(n: number, decimals: number): number {
  const abs = Math.abs(n);
  const clean = Number(abs.toPrecision(15));
  const text = String(clean);
  const rounded = text.includes("e")
    ? Math.round(clean * 10 ** decimals) / 10 ** decimals
    : Number(`${Math.round(Number(`${text}e${decimals}`))}e-${decimals}`);
  return n < 0 ? -rounded : rounded;
}

/** `12345678` → `1,23,45,678` (lakh/crore grouping). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${digits.slice(-3)}`;
}

/** `123456.5` → `1,23,456.50`. No currency symbol — for table cells under a ₹ header. */
export function formatAmount(value: NumberInput, decimals = 2): string {
  const n = toNumber(value);
  if (n === null) return DASH;
  const rounded = roundTo(n, decimals);
  const [whole, fraction] = Math.abs(rounded).toFixed(decimals).split(".");
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${groupIndian(whole)}${decimals > 0 ? `.${fraction}` : ""}`;
}

/** `123456.5` → `₹1,23,456.50`; `-50` → `-₹50.00`; blank → `—`. */
export function inr(value: NumberInput, decimals = 2): string {
  const text = formatAmount(value, decimals);
  if (text === DASH) return DASH;
  return text.startsWith("-") ? `-₹${text.slice(1)}` : `₹${text}`;
}

/** Dashboard tiles only: `₹1.25L`, `₹2.40Cr`, `₹45.0K`. Never on a bill. */
export function inrCompact(value: NumberInput): string {
  const n = toNumber(value);
  if (n === null) return DASH;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${groupIndian(String(Math.round(abs)))}`;
}

/** A quantity: whole pieces print bare (`2`), metres keep up to 2 decimals (`2.5`). */
export function formatQty(value: NumberInput): string {
  const n = toNumber(value);
  if (n === null) return DASH;
  if (Number.isInteger(n)) return String(n);
  return String(roundTo(n, 2));
}

/** `1536` → `1.5 KB`. */
export function formatBytes(bytes: NumberInput): string {
  const n = toNumber(bytes);
  if (n === null) return DASH;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let size = n / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}

// ── Dates ──────────────────────────────────────────────────────────────────

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (n: number) => String(n).padStart(2, "0");

function localDate(y: number, m: number, d: number, h = 0, min = 0, s = 0): Date | null {
  const date = new Date(y, m - 1, d, h, min, s);
  // Refuse roll-overs: 2026-02-31 must not quietly become 3 March.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * A Date from an API value.
 *
 * `YYYY-MM-DD` and `YYYY-MM-DD HH:mm[:ss]` (MySQL, no zone — the server runs on
 * Asia/Kolkata) are read as local time; anything carrying a zone is left to the
 * platform parser. Returns null for blank or unreadable input.
 */
export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = value.trim();
  let m = DATE_ONLY.exec(text);
  if (m) return localDate(+m[1], +m[2], +m[3]);
  m = LOCAL_DATE_TIME.exec(text);
  if (m) return localDate(+m[1], +m[2], +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `2026-09-13` → `13.09.2026` (day.month.year). Blank → `—`. */
export function formatDate(value: DateInput): string {
  if (value === null || value === undefined || value === "") return DASH;
  const d = parseDate(value);
  if (!d) return typeof value === "string" ? value : DASH;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** `14:05` → `2:05 pm`. */
export function formatTime(value: DateInput): string {
  const d = parseDate(value);
  if (!d) return DASH;
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? "am" : "pm"}`;
}

/** `2026-09-13 14:05:00` → `13.09.2026, 2:05 pm`. */
export function formatDateTime(value: DateInput): string {
  if (value === null || value === undefined || value === "") return DASH;
  const d = parseDate(value);
  if (!d) return typeof value === "string" ? value : DASH;
  return `${formatDate(d)}, ${formatTime(d)}`;
}

/** A date, plus the time when there is one — "18.09.2026" or "18.09.2026, 6:00 pm" (ADR-33). */
export function formatWhen(value: DateInput): string {
  if (value === null || value === undefined || value === "") return DASH;
  const midnight = typeof value === "string" && /(^\d{4}-\d{2}-\d{2}$)|[ T]00:00(:00)?$/.test(value.trim());
  return midnight ? formatDate(value) : formatDateTime(value);
}

/** A Date as `YYYY-MM-DD` in LOCAL time — what `<input type="date">` and the API take. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Today as `YYYY-MM-DD`, local.
 *
 * Not `new Date().toISOString().slice(0, 10)`: that is UTC, which in India is
 * YESTERDAY between midnight and 5:30 am.
 */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** The first day of this month, local time — the usual start of a money check. */
export function monthStartIso(): string {
  return `${todayIso().slice(0, 8)}01`;
}

/** `addDaysIso("2026-09-13", 3)` → `"2026-09-16"`. Null for an unreadable date. */
export function addDaysIso(value: DateInput, days: number): string | null {
  const d = parseDate(value);
  if (!d) return null;
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/**
 * Whole calendar days from `from` to `to` (default: today). Positive when `to`
 * is later. Time of day is ignored and DST cannot shift the answer.
 *
 *   daysBetween(order.promised_delivery_date)   // > 0 → that many days overdue
 */
export function daysBetween(from: DateInput, to: DateInput = new Date()): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return null;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

// ── Text ───────────────────────────────────────────────────────────────────

/** `—` for anything empty, so a null never renders as the word "null". */
export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return DASH;
  return String(value);
}

/** `in_process` → `In process`. For values with no label map of their own. */
export function humanise(value: string | null | undefined): string {
  if (!value) return DASH;
  const text = value.replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
