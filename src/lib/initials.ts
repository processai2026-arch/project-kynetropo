/**
 * Up to two initials — first and last word — for a record's mark or list disc.
 * Only letters and digits count, so "Pant / Trouser" is "PT" and
 * "Shirt (Full Sleeve)" is "SS", never "P/" or "S(". "—" when there is no name.
 */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter(Boolean);
  return `${words[0] ?? ""}${words.length > 1 ? words[words.length - 1] : ""}`.toUpperCase() || "—";
}
