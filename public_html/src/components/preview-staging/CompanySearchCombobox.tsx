import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface CompanySuggestion {
  id?: number;
  name: string;
  gstin?: string | null;
  state?: string | null;
  address?: string | null;
}

export interface CompanySearchComboboxProps {
  value: string;
  companies: CompanySuggestion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (company: CompanySuggestion) => void;
  onValueChange: (v: string) => void;
}

export function CompanySearchCombobox({
  value,
  companies,
  open,
  onOpenChange,
  onSelect,
  onValueChange,
}: CompanySearchComboboxProps) {
  const query = value.toLowerCase();
  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      (c.gstin ?? "").toLowerCase().includes(query)
  );

  const handleSelect = (company: CompanySuggestion) => {
    onSelect(company);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Search or type a new name…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or GSTIN…"
            value={value}
            onValueChange={onValueChange}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground px-4">
                {value.trim() ? (
                  <>
                    Will be created as{" "}
                    <span className="font-medium text-foreground">"{value}"</span>
                  </>
                ) : (
                  "Type to search existing customers…"
                )}
              </div>
            ) : (
              <CommandGroup heading="Existing customers">
                {filtered.map((company, idx) => (
                  <CommandItem
                    key={company.id ?? `${company.name}-${idx}`}
                    value={company.name}
                    onSelect={() => handleSelect(company)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === company.name
                            ? "opacity-100 text-primary"
                            : "opacity-0"
                        )}
                      />
                      <span className="text-sm text-foreground">{company.name}</span>
                    </div>
                    {company.gstin && (
                      <span className="ml-6 font-mono text-xs tracking-wide text-muted-foreground">
                        {company.gstin}
                      </span>
                    )}
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
