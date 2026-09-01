import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { sections } from "@/lib/navigation";
import { globalSearch, MIN_QUERY, type SearchGroup } from "@/lib/api/globalSearch";
import { useConfirmLeave } from "@/components/UnsavedChangesGuard";

/**
 * Search across the whole system from the header.
 *
 * Two layers, and both matter. Pages are known up front, so typing "leads"
 * jumps there with no round trip. Records — clients, projects, sales leads,
 * bugs, pitches, employees — come from one server query, so a company name
 * finds the client *and* the lead it came from.
 *
 * Ctrl/Cmd-K opens it, which is the shortcut people already try.
 */
export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const confirmLeave = useConfirmLeave();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced, and every superseded request is aborted. Without the abort a
  // slow early keystroke can land after a fast later one and overwrite the
  // newer results with staler ones.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      globalSearch(q, controller.signal)
        .then(setGroups)
        .catch(() => { /* aborted, or offline — the pages list still works */ })
        .finally(() => setLoading(false));
    }, 220);
    return () => { clearTimeout(t); controller.abort(); };
  }, [query]);

  // Reset on close, so reopening does not flash the previous search.
  useEffect(() => {
    if (!open) { setQuery(""); setGroups([]); }
  }, [open]);

  // The palette answers Enter as well as a click, and a keypress is not a
  // click on anything — so this asks the guard directly rather than relying on
  // the click listener that covers links and marked buttons.
  const go = async (url: string) => {
    if (!(await confirmLeave())) return;
    setOpen(false);
    navigate(url);
  };

  const typed = query.trim();
  const tooShort = typed.length > 0 && typed.length < MIN_QUERY;

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          title="Search everything (Ctrl+K)"
          aria-label="Search everything"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-5 w-5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="Search everything (Ctrl+K)"
          aria-label="Search everything"
          className="flex w-full items-center gap-2 rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Search clients, projects, leads, bugs…</span>
          {/* Shown, not hidden in a tooltip — a shortcut nobody is told about
              may as well not exist. */}
          <kbd className="hidden md:inline shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search clients, projects, leads, bugs, people…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}

          {!loading && (
            <CommandEmpty>
              {tooShort ? `Type at least ${MIN_QUERY} characters.` : "Nothing matches that."}
            </CommandEmpty>
          )}

          {/* Records first once there are any: someone who typed a name or a
              document number wants that record, not the page it lives on. */}
          {groups.map((group) => (
            <CommandGroup key={group.type} heading={group.label}>
              {group.items.map((hit) => (
                <CommandItem
                  key={`${group.type}-${hit.id}`}
                  // The typed text is part of the value on purpose. cmdk runs
                  // its own fuzzy filter over these items, and the server may
                  // have matched this row on a field that is never rendered —
                  // a GSTIN, an HSN code, a reference number — which cmdk
                  // would then filter straight back out. The server already
                  // decided this row matches; including the query says so.
                  value={`${hit.title} ${hit.subtitle} ${typed}`}
                  onSelect={() => go(hit.url)}
                  className="gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{hit.title}</p>
                    {hit.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{hit.subtitle}</p>
                    )}
                  </div>
                  {hit.meta && (
                    <span className="shrink-0 text-xs text-muted-foreground eco-nums">{hit.meta}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {sections.map((section) => (
            <CommandGroup key={section.label} heading={`Go to · ${section.label}`}>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.url}
                    // Section name in the value so "finance" finds every page
                    // in Finance, not only the one called Finance.
                    value={`${section.label} ${item.title}`}
                    onSelect={() => go(item.url)}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
