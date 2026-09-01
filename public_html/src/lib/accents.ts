/**
 * The one place a decorative colour is chosen.
 *
 * Ported from the VB Solar / Real Estate CRM kit. Colour was being picked per
 * page, so the same subject came out a different colour depending on which
 * screen you were on — which is exactly what stops a palette from becoming a
 * system.
 *
 * Semantic colour — a status, an overdue balance, a destructive action — is
 * deliberately NOT in this file. That lives on the semantic tokens, so the two
 * systems can never start contradicting each other about what red means.
 */

export type Accent = "sky" | "violet" | "amber" | "emerald" | "rose" | "teal" | "slate";

export interface AccentClasses {
  /** Tinted surface, for an icon chip or a tile background. */
  tile: string;
  /** Icon / text on that tint. */
  icon: string;
  /** Border to pair with `tile`. */
  border: string;
}

export const ACCENTS: Record<Accent, AccentClasses> = {
  sky: {
    tile: "bg-sky-50 dark:bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-500/20",
  },
  violet: {
    tile: "bg-violet-50 dark:bg-violet-500/10",
    icon: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-500/20",
  },
  amber: {
    tile: "bg-amber-50 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-500/20",
  },
  emerald: {
    tile: "bg-emerald-50 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-500/20",
  },
  rose: {
    tile: "bg-rose-50 dark:bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-500/20",
  },
  teal: {
    tile: "bg-teal-50 dark:bg-teal-500/10",
    icon: "text-teal-600 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-500/20",
  },
  slate: {
    tile: "bg-slate-100 dark:bg-slate-500/10",
    icon: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-500/20",
  },
};

/**
 * Sidebar section → accent, so a module keeps its colour from the launcher in
 * the header through to the figures on its own pages.
 */
export const MODULE: Record<string, Accent> = {
  Overview: "sky",
  CRM: "violet",
  Sales: "sky",
  Delivery: "rose",
  Finance: "amber",
  Growth: "teal",
  Team: "emerald",
  System: "slate",
};

export const accentOf = (a: Accent): AccentClasses => ACCENTS[a];
