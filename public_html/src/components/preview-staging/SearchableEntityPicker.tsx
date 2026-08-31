import * as React from "react";
import { useRef, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface EntityOption {
  id: string | number;
  label: string;
  sub?: string;
}

export interface SearchableEntityPickerProps {
  /** The currently selected entity, or null/undefined when nothing is chosen */
  selectedEntity: EntityOption | null | undefined;
  /** Full list of options to filter against */
  entityOptions: EntityOption[];
  /** Controlled search string */
  entitySearch: string;
  /** Whether the dropdown list is visible */
  entityDropOpen: boolean;
  /** Show a loading spinner inside the dropdown */
  entityLoading?: boolean;
  /** Called when the user selects an option from the list */
  onSelect: (option: EntityOption) => void;
  /** Called when the user clicks the clear (X) button */
  onClear: () => void;
  /** Display name shown in the label — e.g. "Lead", "Property", "Buyer" */
  entityType: string;
  /** Callback fired when the search input changes — parent should update entitySearch and entityDropOpen */
  onSearchChange: (value: string, dropOpen: boolean) => void;
  /** Optional extra class applied to the outer wrapper */
  className?: string;
}

/**
 * SearchableEntityPicker
 *
 * A compound widget that shows a selected-entity chip when a value is chosen,
 * or a search input with a floating option-list dropdown otherwise.
 *
 * The component is uncontrolled for dropdown focus/blur — it closes the dropdown
 * automatically when the user clicks outside via a ref-based click-outside listener.
 * The parent owns all state: selectedEntity, entitySearch, entityDropOpen.
 */
export function SearchableEntityPicker({
  selectedEntity,
  entityOptions,
  entitySearch,
  entityDropOpen,
  entityLoading = false,
  onSelect,
  onClear,
  entityType,
  onSearchChange,
  className,
}: SearchableEntityPickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside the widget
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onSearchChange(entitySearch, false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [entitySearch, onSearchChange]);

  const filteredOptions = entitySearch.trim()
    ? entityOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(entitySearch.toLowerCase()) ||
          (o.sub ?? "").toLowerCase().includes(entitySearch.toLowerCase())
      )
    : entityOptions;

  return (
    <div
      ref={wrapperRef}
      className={cn("space-y-1.5 rounded-lg border bg-muted/20 p-3", className)}
    >
      <Label className="text-sm font-semibold text-foreground">
        Link to {entityType} *
      </Label>

      {selectedEntity ? (
        /* ── Selected chip ── */
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2.5 text-sm">
          <span className="flex-1 truncate font-medium text-card-foreground">
            {selectedEntity.label}
          </span>
          {selectedEntity.sub && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {selectedEntity.sub}
            </span>
          )}
          <button
            type="button"
            aria-label={`Clear selected ${entityType}`}
            onClick={onClear}
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* ── Search input + dropdown ── */
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-background pl-9"
            placeholder="Search by name or code…"
            value={entitySearch}
            onChange={(e) => onSearchChange(e.target.value, true)}
            onFocus={() => onSearchChange(entitySearch, true)}
            autoComplete="off"
          />

          {entityDropOpen && (
            <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {entityLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading…</span>
                </div>
              ) : filteredOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No {entityType.toLowerCase()} found
                </p>
              ) : (
                filteredOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    /* mousedown fires before the input's blur, so the dropdown stays open long
                       enough for the click to register before the outside-click handler fires */
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(o);
                    }}
                    className="flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-sm last:border-0 hover:bg-muted/60"
                  >
                    <span className="truncate text-card-foreground">{o.label}</span>
                    {o.sub && (
                      <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                        {o.sub}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableEntityPicker;
