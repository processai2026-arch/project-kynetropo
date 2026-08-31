import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ComboOption {
  id: string | number;
  label: string;
  sub?: string;
}

export interface SearchComboProps {
  label: string;
  placeholder?: string;
  value: string | number | null | undefined;
  onChange: (id: string | number | null) => void;
  options: ComboOption[];
  loading?: boolean;
}

export function SearchCombo({
  label,
  placeholder = "Search…",
  value,
  onChange,
  options,
  loading = false,
}: SearchComboProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () =>
      value != null
        ? (options.find((o) => String(o.id) === String(value)) ?? null)
        : null,
    [value, options]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sub?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (id: string | number) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label>{label}</Label>
      <div className="relative">
        {selected ? (
          <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 bg-background text-sm">
            <span className="flex-1 truncate text-card-foreground">
              {selected.label}
            </span>
            {selected.sub && (
              <span className="text-xs text-muted-foreground shrink-0">
                {selected.sub}
              </span>
            )}
            <button
              type="button"
              onClick={clear}
              aria-label="Clear selection"
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder={loading ? "Loading…" : placeholder}
              value={query}
              disabled={loading}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
          </div>
        )}

        {open && !selected && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No results found
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={() => select(o.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm",
                    "hover:bg-muted/60 text-left transition-colors"
                  )}
                >
                  <span className="text-card-foreground truncate">
                    {o.label}
                  </span>
                  {o.sub && (
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {o.sub}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchCombo;
