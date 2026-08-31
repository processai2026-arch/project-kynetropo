import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export interface ProductSuggestion {
  id: number;
  name: string;
  hsn_code: string;
  price: number;
  gst_rate: number;
  unit: string;
}

export interface NewInvoiceLine {
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
}

export interface ProductComboboxCellProps {
  value: string;
  onSelect: (patch: Partial<NewInvoiceLine>) => void;
  products: ProductSuggestion[];
  customDescs: string[];
  hsnMap: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductComboboxCell({
  value,
  onSelect,
  products,
  customDescs,
  hsnMap,
  open,
  onOpenChange,
}: ProductComboboxCellProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-9 font-normal text-sm truncate"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Type or pick a product…"}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type description…"
            value={value}
            onValueChange={(v) => onSelect({ description: v })}
          />
          <CommandList>
            <CommandEmpty>
              <span className="text-xs text-muted-foreground">
                No match — will use typed text as description
              </span>
            </CommandEmpty>

            {products.length > 0 && (
              <CommandGroup heading="Products">
                {products.map((p) => (
                  <CommandItem
                    key={`prod-${p.id}`}
                    value={p.name}
                    onSelect={() => {
                      onSelect({
                        description: p.name,
                        unit_price: p.price,
                        hsn_code: p.hsn_code || hsnMap[p.name] || "",
                        gst_rate: p.gst_rate,
                        unit: p.unit || "Nos",
                      });
                      onOpenChange(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5 shrink-0",
                        value === p.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      ₹{p.price.toLocaleString("en-IN")} · {p.gst_rate}% GST
                      {p.unit ? ` · ${p.unit}` : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {customDescs.length > 0 && (
              <CommandGroup heading="Previously used">
                {customDescs.map((d) => (
                  <CommandItem
                    key={`custom-${d}`}
                    value={d}
                    onSelect={() => {
                      onSelect({ description: d, hsn_code: hsnMap[d] || "" });
                      onOpenChange(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5 shrink-0",
                        value === d ? "opacity-100" : "opacity-0"
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
