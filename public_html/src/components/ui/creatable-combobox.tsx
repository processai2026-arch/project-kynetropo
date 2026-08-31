"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronsUpDown, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  CommandSeparator,
} from "@/components/ui/command";
import { dropdownOptionsApi, type DropdownOption } from "@/lib/api/dropdownOptions";

// Built-in fallback options shown immediately, before API responds
const BUILT_IN_FALLBACKS: Record<string, string[]> = {
  marketplace:              ["amazon", "flipkart", "meesho", "other"],
  customer_type:            ["b2b", "b2c"],
  vendor_type:              ["manufacturer", "distributor", "wholesaler", "retailer", "importer", "other"],
  expense_category:         ["Shipping", "Marketplace Commission", "Packaging", "Advertising", "Other"],
  product_category:         ["Electronics", "Clothing", "Accessories", "Books", "Home", "Other"],
  product_unit:             ["pcs", "kg", "g", "L", "mL", "box", "pair", "set", "roll", "sheet"],
  payment_method:           ["cash", "bank_transfer", "upi", "cheque", "card", "other"],
  statement_type:           ["sales", "purchase", "all"],
  settlement_status:        ["pending", "received", "disputed"],
  invoice_status:           ["pending", "processing", "review", "approved", "rejected", "error"],
  order_status:             ["completed", "pending", "cancelled", "returned"],
  expense_marketplace:      ["amazon", "flipkart", "meesho", "other", "none"],
  // General module keys
  expense_payment_mode:     ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"],
  general_expense_category: ["Office Stationery", "Employee Welfare", "Rent", "Fuel & Transport",
                              "Food & Hospitality", "Maintenance & Repairs", "Professional Services",
                              "IT & Software", "Miscellaneous", "Other"],
  employee_department:      ["Engineering", "Sales", "Marketing", "Finance", "HR", "Operations",
                              "Warehouse", "Customer Support", "Management", "Other"],
  crm_lead_source:          ["Website", "Referral", "Cold Call", "Social Media", "Exhibition",
                              "Advertisement", "Email Campaign", "Walk-in", "Other"],
  product_catalog_category: ["Electronics", "Clothing", "Accessories", "Books", "Home",
                              "Sports", "Toys", "Food", "Health", "Other"],
  inventory_unit:           ["pcs", "kg", "g", "L", "mL", "box", "pair", "set", "roll", "sheet",
                              "mt", "ft", "cm", "dozen", "bag", "carton"],
  invoice_payment_status:   ["paid", "unpaid", "partial", "overdue", "refunded"],
  indian_state:             ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
                              "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
                              "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
                              "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
                              "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
                              "Uttar Pradesh", "Uttarakhand", "West Bengal",
                              "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry"],
};

/**
 * CreatableCombobox — searchable dropdown that lets users add new options.
 *
 * Props:
 *   optionsKey   — name of the dropdown (e.g. "marketplace") — persisted to DB per tenant
 *   value        — currently selected value string
 *   onChange     — called with the new string value when selection changes
 *   placeholder  — text shown when nothing is selected (default: "Select…")
 *   className    — optional className for the trigger button
 *   disabled     — disables the combobox
 *
 * Behaviour:
 *   - Options loaded once per mount from /admin/dropdown-options/{key}
 *   - Typing filters existing options (case-insensitive)
 *   - If typed text matches nothing, shows "+ Add '{typed}'" at bottom
 *   - Pressing Enter or clicking "+ Add" saves to DB and selects it immediately
 *   - Custom options show an × to delete them (built-ins cannot be deleted)
 */
export interface CreatableComboboxProps {
  optionsKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CreatableCombobox({
  optionsKey,
  value,
  onChange,
  placeholder = "Select…",
  className,
  disabled = false,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  // Seed with built-in fallbacks immediately so the dropdown is never empty
  const [options, setOptions] = useState<DropdownOption[]>(() =>
    (BUILT_IN_FALLBACKS[optionsKey] ?? []).map((v) => ({ value: v, is_custom: false }))
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const loadedRef = useRef(false);

  const loadOptions = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const opts = await dropdownOptionsApi.list(optionsKey);
      // API returned options — replace fallbacks with the full server list
      if (opts.length > 0) setOptions(opts);
    } catch {
      // API unavailable — built-in fallbacks already shown, user can still type to add
    } finally {
      setLoading(false);
    }
  }, [optionsKey]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadOptions();
    }
  }, [loadOptions]);

  const filtered = options.filter((o) =>
    o.value.toLowerCase().includes(query.toLowerCase())
  );

  const exactMatch = options.some(
    (o) => o.value.toLowerCase() === query.toLowerCase()
  );
  const showAddOption = query.trim().length > 0 && !exactMatch;

  const handleSelect = (val: string) => {
    onChange(val);
    setQuery("");
    setOpen(false);
  };

  const handleAdd = async () => {
    const trimmed = query.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      const updated = await dropdownOptionsApi.add(optionsKey, trimmed);
      setOptions(updated);
      onChange(trimmed);
      setQuery("");
      setOpen(false);
    } catch {
      // Fail silently — option just won't persist but can still be used this session
      onChange(trimmed);
      setOptions((prev) => [...prev, { value: trimmed, is_custom: true }]);
      setQuery("");
      setOpen(false);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, opt: DropdownOption) => {
    e.preventDefault();
    e.stopPropagation();
    if (!opt.is_custom) return; // built-ins are protected
    try {
      await dropdownOptionsApi.remove(optionsKey, opt.value);
      setOptions((prev) => prev.filter((o) => o.value !== opt.value));
      if (value === opt.value) onChange("");
    } catch {
      // Ignore
    }
  };

  const displayValue = value
    ? (options.find((o) => o.value.toLowerCase() === value.toLowerCase())?.value ?? value)
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={displayValue ? "text-foreground" : "text-muted-foreground"}>
            {displayValue || placeholder}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onInteractOutside={(e) => {
          // Allow interaction with items inside the popover itself
          const target = e.target as HTMLElement;
          if (target.closest("[data-combobox-popover]")) e.preventDefault();
        }}
      >
        <Command shouldFilter={false} data-combobox-popover>
          <CommandInput
            placeholder={`Search or type to add…`}
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === "Enter" && showAddOption) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <CommandList>
            {filtered.length === 0 && !showAddOption && (
              <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
                {loading ? "Loading…" : "No options found"}
              </CommandEmpty>
            )}

            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => handleSelect(opt.value)}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value.toLowerCase() === opt.value.toLowerCase()
                            ? "opacity-100 text-primary"
                            : "opacity-0"
                        )}
                      />
                      <span className="capitalize">{opt.value}</span>
                    </div>
                    {opt.is_custom && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, opt)}
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 rounded"
                        title="Remove custom option"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showAddOption && (
              <>
                {filtered.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    value={`__add__${query}`}
                    onSelect={handleAdd}
                    className="text-primary"
                  >
                    {adding ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add &ldquo;{query.trim()}&rdquo;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
