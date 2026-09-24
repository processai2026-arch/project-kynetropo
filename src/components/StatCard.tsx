import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENTS, type Accent } from "@/lib/accents";

/**
 * A KPI tile.
 *
 * A row of identical blue tiles reads as one block and gives the eye nothing to
 * navigate by — the icon may as well be absent. Each card takes a hue from the
 * shared accent vocabulary instead, so a figure keeps the same colour wherever
 * it appears and can be found by it.
 *
 * The hues are decorative. Anything that means good/bad — a status, an overdue
 * balance — stays on the semantic colours.
 */
export type StatAccent = Accent;

interface StatCardProps {
  title: string;
  value: string;
  /**
   * Optional because 28 call sites across the app never passed one, and the
   * card has always rendered fine without it — the type was simply stricter
   * than the component. Declaring it required made those 28 into type errors
   * that no one could fix without inventing a caption per card.
   */
  subtitle?: string;
  icon: LucideIcon;
  subtitleColor?: "primary" | "muted";
  /** Defaults to the brand sky, so existing cards are unchanged. */
  accent?: Accent;
  /**
   * How much of the card the accent gets.
   *
   * `"card"` is the default everywhere: a white card with a tinted icon chip,
   * which keeps a row of six figures quiet enough to read as one set.
   *
   * `"tint"` floods the whole card instead and moves the chip to the front of
   * the line. It is for a short row that opens a record — four figures about
   * one hub — where the colour separates four different subjects rather than
   * decorating four instances of the same one.
   */
  surface?: "card" | "tint";
}

export function StatCard({
  title, value, subtitle, icon: Icon, subtitleColor = "primary", accent = "sky",
  surface = "card",
}: StatCardProps) {
  const a = ACCENTS[accent];
  const tinted = surface === "tint";
  return (
    // No coloured rule down the edge. Six of them in a row read as six
    // unrelated cards rather than one set of figures, and the colour is
    // already carried by the icon chip — quietly, where it doesn't compete
    // with the number.
    <div
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md",
        tinted
          ? cn("flex items-center gap-4", a.tile, a.border)
          : "bg-card flex items-start justify-between",
      )}
    >
      {tinted && (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card shadow-sm">
          <Icon className={cn("h-6 w-6", a.icon)} />
        </div>
      )}

      <div className="min-w-0">
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold mt-1 text-card-foreground eco-nums">{value}</p>
        {/* Rendered even when empty: a row of cards where only some carry a
            caption would otherwise sit at different internal heights, and the
            numbers above them would stop lining up across the row. */}
        <p
          className={cn(
            "text-xs mt-1 truncate",
            subtitleColor === "muted"
              ? "text-muted-foreground"
              // On a tint the brand sky is the wrong blue against three of the
              // four grounds; the card's own hue is the one that belongs.
              : tinted ? a.icon : "text-primary",
          )}
        >
          {subtitle ?? "\u00A0"}
        </p>
      </div>

      {!tinted && (
        <div className={cn("p-3 rounded-xl shrink-0", a.tile)}>
          <Icon className={cn("h-6 w-6", a.icon)} />
        </div>
      )}
    </div>
  );
}
