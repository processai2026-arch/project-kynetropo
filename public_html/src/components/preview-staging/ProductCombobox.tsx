import React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inrFull } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single item from the product catalog. */
export interface Product {
  id: number | string;
  name: string;
  price: number;
  hsn_code?: string;
  gst_rate: number;
}

/**
 * Shape returned by onSelect for every pick path.
 * - Catalog pick: all four fields are populated.
 * - Previously-used pick: only description is set.
 * - Free-text keystroke: only description is set.
 */
export interface ProductSelection {
  description: string;
  unit_price?: number;
  hsn_code?: string;
  gst_rate?: number;
}

export interface ProductComboboxProps {
  /** 0-based index of the invoice line this combobox belongs to. */
  lineIndex: number;
  /** Current description value for this line (controlled). */
  description: string;
  /** Product catalog items to show under the "Products" group. */
  products: Product[];
  /**
   * Previously used free-text descriptions sourced from localStorage.
   * Shown under the "Previously used" group when non-empty.
   */
  customDescs: string[];
  /** Whether this combobox popover is currently open. */
  isOpen: boolean;
  /** Called when the popover open state should change. */
  onOpenChange: (open: boolean) => void;
  /**
   * Called whenever a value changes:
   * - On every keystroke in the command input (free-text path).
   * - On catalog item selection (all price/GST fields populated).
   * - On previously-used item selection (description only).
   */
  onSelect: (selection: ProductSelection) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductCombobox({
  lineIndex,
  description,
  products,
  customDescs,
  isOpen,
  onOpenChange,
  onSelect,
}: ProductComboboxProps) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label={`Pick product for line ${lineIndex + 1}`}
          className="w-full justify-between h-9 font-normal text-sm"
        >
          <span className={cn("truncate min-w-0", !description && "text-muted-foreground")}>
            {description || "Type or pick a product…"}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type description…"
            value={description}
            onValueChange={(v) => onSelect({ description: v })}
          />

          <CommandList>
            <CommandEmpty>
              <span className="text-xs text-muted-foreground">
                No match — typed text will be used
              </span>
            </CommandEmpty>

            {products.length > 0 && (
              <CommandGroup heading="Products">
                {products.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      onSelect({
                        description: p.name,
                        unit_price: p.price,
                        hsn_code: p.hsn_code,
                        gst_rate: p.gst_rate,
                      });
                      onOpenChange(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5 shrink-0 transition-opacity",
                        description === p.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0 tabular-nums">
                      {inrFull(p.price)} · {p.gst_rate}% GST
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {customDescs.length > 0 && (
              <CommandGroup heading="Previously used">
                {customDescs.map((d) => (
                  <CommandItem
                    key={d}
                    value={d}
                    onSelect={() => {
                      onSelect({ description: d });
                      onOpenChange(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5 shrink-0 transition-opacity",
                        description === d ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{d}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ProductCombobox;
