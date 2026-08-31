import React from "react";
import { SelectItem } from "@/components/ui/select";

export interface EntityCodeSelectOptionProps {
  /** Record ID — used as the SelectItem `value` */
  id: string | number;
  /** Short alphanumeric code displayed first, e.g. "LEAD-001" or "PROP-042" */
  code: string;
  /** Human-readable name displayed after the em-dash. Null/undefined triggers fallback. */
  name?: string | null;
  /**
   * Fallback identifier rendered as "#<fallbackId>" when `name` is absent.
   * Defaults to `id` when omitted.
   */
  fallbackId?: string | number;
}

/**
 * A SelectItem that renders: <code> — <name | #fallbackId>
 *
 * Used anywhere a dropdown option needs a short code prefix for quick
 * visual scanning alongside a human-readable label.
 *
 * @example
 * // Lead dropdown
 * <EntityCodeSelectOption id={l.id} code={l.lead_code} name={l.buyer_name} fallbackId={l.buyer_id} />
 *
 * // Property dropdown
 * <EntityCodeSelectOption id={p.id} code={p.property_code} name={p.title} />
 */
export function EntityCodeSelectOption({
  id,
  code,
  name,
  fallbackId,
}: EntityCodeSelectOptionProps) {
  const resolvedName =
    name?.trim() ? name.trim() : `#${fallbackId ?? id}`;

  return (
    <SelectItem value={String(id)}>
      <span className="font-medium text-foreground">{code}</span>
      <span className="mx-1.5 text-muted-foreground">—</span>
      <span className="text-card-foreground">{resolvedName}</span>
    </SelectItem>
  );
}

export default EntityCodeSelectOption;
