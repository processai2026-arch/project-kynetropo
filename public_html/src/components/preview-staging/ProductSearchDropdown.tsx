import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InvoiceProduct } from "@/types/invoiceProduct";

interface ProductSearchDropdownProps {
  value: string;
  products: InvoiceProduct[];
  isOpen: boolean;
  onChange: (value: string) => void;
  onSelect: (product: InvoiceProduct) => void;
  onCreateNew: (prefill: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function ProductSearchDropdown({
  value,
  products,
  isOpen,
  onChange,
  onSelect,
  onCreateNew,
  onOpenChange,
}: ProductSearchDropdownProps) {
  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim();
    if (!q) return products.slice(0, 20);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.hsn_code ?? "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [value, products]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => setTimeout(() => onOpenChange(false), 150)}
        placeholder="Search or type…"
        className="h-8 text-xs"
      />
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-card border rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-[380px]">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No products match
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={p.product_id}
              type="button"
              onMouseDown={() => onSelect(p)}
              className={cn(
                "w-full text-left px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors border-b last:border-0"
              )}
            >
              <div className="font-medium text-card-foreground">{p.name}</div>
              <div className="text-muted-foreground font-mono mt-0.5">
                SKU: {p.sku}
                {p.hsn_code ? ` · HSN: ${p.hsn_code}` : ""}
              </div>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={() => onCreateNew(value)}
            className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-primary/5 transition-colors border-t flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" />
            {value.trim() ? `Create "${value}"` : "Create new product"}
          </button>
        </div>
      )}
    </div>
  );
}
