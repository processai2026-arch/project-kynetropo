import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A select you can type into, for picking one record out of many.
 *
 * A plain <Select> is fine for six statuses and useless for seven hundred
 * customers — you cannot find "Nithya V" by scrolling, and the code and phone
 * number people actually search by are not in the label at all.
 *
 * Note the `value` given to CommandItem. cmdk runs its own filter over that
 * string, not over what is rendered, so anything meant to be searchable has to
 * be in it — label, code and phone together. Setting it to the record id (the
 * obvious thing) makes every search return nothing.
 */
export interface ComboOption {
  /** The value stored in the form — usually a record id as a string. */
  value: string;
  label: string;
  /** Code shown beside the name and included in the search text. */
  hint?: string | null;
  /** Second line — phone, area, hub. Also searchable. */
  meta?: string | null;
  /** Optional grouping heading. Options sharing one are rendered together. */
  group?: string;
  /** Small tag on the right of the row — which KIND of record this is. */
  badge?: string;
  disabled?: boolean;
}

export function RecordCombobox({
  value, onChange, options, placeholder = "Select…", searchPlaceholder = "Type to search…",
  emptyText = "Nothing matches", disabled = false, id, className, onSearch, loading = false, selectedOption, action, searchable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /**
   * Hand the typed term to the parent and let the SERVER find the matches.
   *
   * Without this the parent must load every candidate up front and cmdk filters
   * the lot on each keystroke. At forty records that is invisible; at the eight
   * hundred operators MP TV has it is a frozen list, which reads as "the
   * dropdown doesn't scroll" rather than as "the dropdown is busy".
   *
   * When supplied, cmdk's own filtering is switched OFF — otherwise it would
   * filter the server's results a second time, against a term the server has
   * already matched more broadly, and hide rows that legitimately matched.
   */
  onSearch?: (term: string) => void;
  loading?: boolean;
  /** What to show for `value` when a server search has moved `options` on and the chosen record is no longer among them. */
  selectedOption?: ComboOption | null;
  /** A short list needs no search box: the options are the whole choice. */
  searchable?: boolean;
  /** A last row that is not a record, e.g. "Add new customer". Closes the list, then runs. Use with `onSearch`. */
  action?: {
    label: string; icon?: ReactNode; onSelect: (term: string) => void;
    /** It acts on the typed term: pressed with nothing typed, it keeps the list open and puts the caret in the search box. */
    needsTerm?: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? (selectedOption && selectedOption.value === value ? selectedOption : undefined),
    [options, value, selectedOption],
  );
  const serverSide = typeof onSearch === "function";

  // Group headings, in the order the groups first appear.
  const groups = useMemo(() => {
    const out = new Map<string, ComboOption[]>();
    for (const o of options) {
      const key = o.group ?? "";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(o);
    }
    return [...out.entries()];
  }, [options]);

  return (
    /*
     * modal, because this box is used inside dialogs.
     *
     * A Radix Dialog wraps its content in react-remove-scroll, which blocks
     * wheel events everywhere except the subtree it is guarding. PopoverContent
     * is portaled to <body>, i.e. OUTSIDE that subtree — so the options list
     * scrolled by dragging its bar or by keyboard, but the mouse wheel over it
     * did nothing at all. With 555 operators behind this picker that made the
     * list feel frozen.
     *
     * A modal Popover mounts its own scroll manager for its content, which
     * registers the list as a legitimate scroll target and lets the wheel
     * through. It costs nothing outside a dialog.
     */
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-field px-3 py-2 text-sm",
            "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? (
              <>
                {selected.label}
                {selected.hint && <span className="text-muted-foreground"> · {selected.hint}</span>}
                {selected.meta && <span className="text-muted-foreground"> · {selected.meta}</span>}
              </>
            ) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        /*
         * Put the caret in the search box, by hand.
         *
         * `preventDefault` cancels Radix's own "focus the first tabbable node",
         * which is what kept a click on an option from reaching the surrounding
         * dialog. Cancelling it also left focus on the trigger button, and the
         * input's `autoFocus` did not survive the popover's mount — so opening
         * the dropdown and typing did nothing until you clicked the search box
         * a second time. Focus it outright instead: click once, then type.
         */
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <Command shouldFilter={!serverSide}>
          {searchable && <CommandInput
            ref={searchRef}
            placeholder={searchPlaceholder}
            className="h-10"
            value={serverSide ? term : undefined}
            onValueChange={serverSide ? (v) => { setTerm(v); onSearch!(v); } : undefined}
          />}
          <CommandList className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
            ) : action ? (
              // The action row counts as an item, so cmdk's own Empty would never show.
              options.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">{emptyText}</CommandEmpty>
            )}
            {/* While the server searches, the last term's rows would read as this term's answer. */}
            {!(loading && serverSide) && groups.map(([heading, items]) => (
              <CommandGroup key={heading || "_"} heading={heading || undefined}>
                {items.map((o) => (
                  <CommandItem
                    key={o.value}
                    // Searchable text, not the id — see the note above. Ignored
                    // when the server is doing the filtering.
                    value={[o.label, o.hint, o.meta].filter(Boolean).join(" ")}
                    disabled={o.disabled}
                    onSelect={() => { onChange(o.value); setOpen(false); }}
                    // Belt and suspenders: with server-side filtering (shouldFilter=false)
                    // cmdk can miss a pointer selection, so a plain click selects too.
                    // onChange with the same value and closing twice are both harmless.
                    onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); } }}
                    className="gap-2"
                  >
                    <Check className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {o.label}
                        {o.hint && <span className="text-muted-foreground"> · {o.hint}</span>}
                      </span>
                      {o.meta && <span className="block truncate text-xs text-muted-foreground">{o.meta}</span>}
                    </span>
                    {o.badge && (
                      <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {o.badge}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {action && (
              <CommandGroup forceMount className="border-t">
                <CommandItem
                  value="__action__"
                  forceMount
                  // Let the list close before whatever the action opens (a dialog) takes focus.
                  onSelect={() => {
                    // A dead click reads as a broken dropdown: with nothing typed, send the caret to the box to type in.
                    if (action.needsTerm && !term.trim()) { searchRef.current?.focus(); return; }
                    setOpen(false);
                    const t = term;
                    setTimeout(() => action.onSelect(t), 0);
                  }}
                  className="gap-2 font-medium text-primary"
                >
                  {action.icon}
                  {action.label}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
