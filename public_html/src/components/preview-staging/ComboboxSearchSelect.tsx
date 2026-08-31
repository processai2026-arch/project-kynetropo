import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComboboxOption {
  /** Stable identifier — stored in form state, never shown directly. */
  value: string;
  /** Human-readable label shown in the trigger and the list. */
  label: string;
}

export interface ComboboxSearchSelectProps {
  /** Selectable items. */
  options: ComboboxOption[];
  /** Currently selected value. Pass `""` or `undefined` for no selection. */
  value: string | undefined;
  /** Called with the chosen option's value when the user picks an item. */
  onSelect: (value: string) => void;
  /** Text shown in the trigger button when nothing is selected. */
  placeholder?: string;
  /** Placeholder inside the search input. */
  searchPlaceholder?: string;
  /** Controlled open state — managed by the parent. */
  open: boolean;
  /** Called when the popover requests an open/close transition. */
  onOpenChange: (open: boolean) => void;
  /** Extra Tailwind classes forwarded to the trigger button. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Searchable combobox backed by Popover + Command.
 *
 * Open/close state is fully controlled by the parent so the field can be
 * coordinated with surrounding dialog or form logic without extra wiring.
 * The popover width mirrors the trigger via the Radix CSS variable so no
 * hardcoded pixel width is needed.
 */
export function ComboboxSearchSelect({
  options,
  value,
  onSelect,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  open,
  onOpenChange,
  className,
}: ComboboxSearchSelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            // Base layout
            "flex h-9 w-full items-center justify-between rounded-md",
            // Border / background — uses design-system tokens, never hex
            "border border-input bg-background px-3 py-2",
            // Typography
            "text-sm text-foreground shadow-sm",
            // Focus ring — matches shadcn inputs
            "focus:outline-none focus:ring-1 focus:ring-ring",
            // Disabled
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn(
              "truncate",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        // Mirror trigger width — no hardcoded px value needed
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command
          // Case-insensitive substring filter so the user can type any part
          // of the label — cmdk's default exact-prefix match is too strict
          // for long employee / property lists.
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  // cmdk matches on this string — keep it as the label so
                  // the custom filter above works correctly.
                  value={opt.label}
                  onSelect={() => {
                    onSelect(opt.value);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate text-sm">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ComboboxSearchSelect;
