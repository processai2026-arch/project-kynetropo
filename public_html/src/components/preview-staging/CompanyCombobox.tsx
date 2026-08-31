import React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyOption {
  /** Display name and search key */
  label: string;
  /** Optional GST Identification Number shown as a mono sub-label */
  gstin?: string;
}

export interface CompanyComboboxProps {
  /** Current text value — the typed or selected company name */
  value: string;
  /** Roster of existing customer/company records to search against */
  companies: CompanyOption[];
  /** Controls whether the popover is open */
  isOpen: boolean;
  /** Called when the popover open state should change */
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user picks an existing company from the list.
   * The full CompanyOption is provided so the parent can auto-fill
   * related fields (e.g. gstin, address).
   */
  onSelect: (company: CompanyOption) => void;
  /**
   * Called as the user types in the search input.
   * Wire this to whatever state holds customer_name in the parent form.
   */
  onValueChange: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyCombobox({
  value,
  companies,
  isOpen,
  onOpenChange,
  onSelect,
  onValueChange,
}: CompanyComboboxProps) {
  const handleSelect = (company: CompanyOption) => {
    onSelect(company);
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input",
            "bg-background px-3 py-2 text-sm shadow-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span
            className={cn(
              "truncate",
              !value && "text-muted-foreground",
            )}
          >
            {value || "Search or type a new company name…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search company or type new…"
            value={value}
            onValueChange={onValueChange}
          />
          <CommandList>
            {/* cmdk renders CommandEmpty only when no items match the current input */}
            <CommandEmpty>
              <div className="px-4 py-3 text-left text-sm text-muted-foreground">
                {value ? (
                  <>
                    No match &mdash;{" "}
                    <span className="font-medium text-foreground">
                      &ldquo;{value}&rdquo;
                    </span>{" "}
                    will be used as a new company.
                  </>
                ) : (
                  "Start typing to search or add a new company."
                )}
              </div>
            </CommandEmpty>

            <CommandGroup heading="Existing customers">
              {companies.map((company) => (
                <CommandItem
                  key={company.label}
                  value={company.label}
                  onSelect={() => handleSelect(company)}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0 transition-opacity",
                      value === company.label ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {company.label}
                    </p>
                    {company.gstin && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {company.gstin}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default CompanyCombobox;
