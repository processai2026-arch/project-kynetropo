/** Minimal stubs for inventory formatting helpers. */

/** Format a number as Indian Rupees with no decimals. */
export function inr0(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Format a number as Indian Rupees with up to 2 decimals. */
export function inr(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Coerce to a safe finite number (NaN / null / undefined → 0). */
export function num(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Format a quantity with up to 3 decimal places. */
export function qty(value: number | string | null | undefined): string {
  const n = num(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

/** Format an ISO date string as "DD/MM/YYYY". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Format an ISO datetime string as "DD/MM/YYYY HH:MM". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return `${formatDate(value)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Return a Tailwind colour pair for a severity string (WRITE_OFF_CANDIDATE, DEAD, SLOW, etc.). */
export function severityChip(severity: string | null | undefined): { bg: string; text: string } {
  switch ((severity ?? "").toUpperCase()) {
    case "WRITE_OFF_CANDIDATE":
    case "DEAD":
      return { bg: "bg-red-100", text: "text-red-700" };
    case "SLOW":
      return { bg: "bg-amber-100", text: "text-amber-700" };
    case "MODERATE":
      return { bg: "bg-yellow-100", text: "text-yellow-700" };
    default:
      return { bg: "bg-muted", text: "text-muted-foreground" };
  }
}
