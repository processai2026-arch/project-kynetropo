import React from "react";
import { Link2, Pencil, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type PermissionLevel = "edit" | "view" | "hidden";

export interface PermissionCycleBadgeProps {
  /** Display name of the nav item or feature. */
  itemTitle: string;
  /** Current permission level — drives the icon shown in the interactive state. */
  level: PermissionLevel | string;
  /**
   * Tailwind classes that colour the badge border and text based on the current
   * level. Computed by the parent so the badge stays stateless about colours.
   */
  levelClass: string;
  /**
   * When true the badge is read-only: it shows a link icon and the parent title
   * as a footnote, signalling that the permission is locked to the parent module.
   */
  inherited: boolean;
  /** Title of the parent module this item inherits from. Required when inherited=true. */
  parentTitle?: string;
  /** Called when the user clicks the badge to advance the permission level. */
  onCycle: () => void;
}

// ── Level → icon map ─────────────────────────────────────────────────────────

const LEVEL_ICONS: Record<string, React.ElementType> = {
  edit:   Pencil,
  view:   Eye,
  hidden: EyeOff,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PermissionCycleBadge({
  itemTitle,
  level,
  levelClass,
  inherited,
  parentTitle = "",
  onCycle,
}: PermissionCycleBadgeProps) {
  const LevelIcon = LEVEL_ICONS[level] ?? Eye;

  // ── Inherited (read-only) variant ─────────────────────────────────────────
  if (inherited) {
    return (
      <div
        role="img"
        aria-label={`${itemTitle} — access follows "${parentTitle}"`}
        title={`Access follows "${parentTitle}" — change that module to control this`}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-md border",
          "text-xs font-medium opacity-60 cursor-not-allowed select-none",
          levelClass,
        )}
      >
        <Link2 className="h-3 w-3 shrink-0" aria-hidden />
        <span>{itemTitle}</span>
        {parentTitle && (
          <span className="text-[10px] font-normal opacity-80">
            ↳ {parentTitle}
          </span>
        )}
      </div>
    );
  }

  // ── Interactive (clickable cycle) variant ─────────────────────────────────
  return (
    <button
      type="button"
      onClick={onCycle}
      title={`Permission: ${level} — click to change`}
      aria-label={`${itemTitle}: ${level}. Click to cycle permission`}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md border",
        "text-xs font-medium cursor-pointer",
        "hover:opacity-80 active:scale-95 transition-opacity",
        levelClass,
      )}
    >
      <LevelIcon className="h-3 w-3 shrink-0" aria-hidden />
      <span>{itemTitle}</span>
    </button>
  );
}

export default PermissionCycleBadge;
