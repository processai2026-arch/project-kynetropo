/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { opsFinanceApi } from "@/lib/api/ops";

/** "cold_call" → "Cold call"; a category typed by someone stays as typed. */
export function categoryLabel(c: string | null | undefined): string {
  if (!c) return "—";
  return c.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());
}

const NEW = "__new__";

/**
 * Expense category: the usual ones and every one added before, then
 * "New category…" to type one that is not there. A category added once is in
 * the list next time.
 */
export function CategorySelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    opsFinanceApi.expenseCategories().then((r) => setCategories(r.data ?? [])).catch(() => setCategories([]));
  }, []);

  const known = categories.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  const showInput = typing || (!!value && categories.length > 0 && !known);

  return (
    <div className="space-y-2">
      <Select value={known ?? (showInput ? NEW : "")} onValueChange={(v) => {
        if (v === NEW) { setTyping(true); onChange(""); }
        else { setTyping(false); onChange(v); }
      }}>
        <SelectTrigger id={id}><SelectValue placeholder="Choose a category" /></SelectTrigger>
        <SelectContent>
          {categories.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
          <SelectItem value={NEW}>+ New category…</SelectItem>
        </SelectContent>
      </Select>
      {showInput && (
        <Input autoFocus aria-label="New category name" placeholder="e.g. Office rent" maxLength={60} value={value}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
