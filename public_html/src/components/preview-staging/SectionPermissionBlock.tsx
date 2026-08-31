import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermissionLevel = "edit" | "view" | "hidden";

export interface PermissionItem {
  key: string;
  label: string;
  level: PermissionLevel;
}

export interface SectionPermissionBlockProps {
  /** Navigation section name shown as the block heading. */
  sectionLabel: string;
  /** All permission items that belong to this section. */
  items: PermissionItem[];
  /** Called when a badge is clicked; parent updates level for that key. */
  onCycle: (key: string) => void;
  /** Called when an "All …" quick-set button is clicked. */
  onSetAll: (sectionLabel: string, level: PermissionLevel) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_LEVELS: PermissionLevel[] = ["edit", "view", "hidden"];

const LEVEL_BADGE_STYLES: Record<PermissionLevel, string> = {
  edit:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  view:   "bg-blue-50 text-blue-600 border-blue-200",
  hidden: "bg-muted text-muted-foreground border-border",
};

const LEVEL_INDICATOR: Record<PermissionLevel, string> = {
  edit:   "E",
  view:   "V",
  hidden: "–",
};

// ─── PermissionCycleBadge (private sub-component) ────────────────────────────

interface PermissionCycleBadgeProps extends PermissionItem {
  onCycle: () => void;
}

function PermissionCycleBadge({ label, level, onCycle }: PermissionCycleBadgeProps) {
  return (
    <button
      type="button"
      onClick={onCycle}
      title={`${label} — ${level} (click to cycle)`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium",
        "cursor-pointer transition-opacity hover:opacity-70",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        LEVEL_BADGE_STYLES[level],
      )}
    >
      {label}
      <span className="font-bold opacity-80 tabular-nums">{LEVEL_INDICATOR[level]}</span>
    </button>
  );
}

// ─── SectionPermissionBlock ───────────────────────────────────────────────────

export function SectionPermissionBlock({
  sectionLabel,
  items,
  onCycle,
  onSetAll,
}: SectionPermissionBlockProps) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {/* Header: section label + bulk quick-set buttons */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {sectionLabel}
        </p>
        <div className="flex gap-1 shrink-0">
          {QUICK_LEVELS.map((level) => (
            <Button
              key={level}
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs capitalize"
              onClick={() => onSetAll(sectionLabel, level)}
            >
              All {level}
            </Button>
          ))}
        </div>
      </div>

      {/* Permission badges */}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <PermissionCycleBadge
            key={item.key}
            {...item}
            onCycle={() => onCycle(item.key)}
          />
        ))}
      </div>
    </div>
  );
}

export default SectionPermissionBlock;
