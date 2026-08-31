import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}

export function CreatableCombobox({
  value,
  onChange,
  suggestions,
  placeholder = "Select or create…",
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const trimmed = inputValue.trim();

  const filteredSuggestions = React.useMemo(
    () =>
      trimmed
        ? suggestions.filter((s) =>
            s.toLowerCase().includes(trimmed.toLowerCase())
          )
        : suggestions,
    [suggestions, trimmed]
  );

  const exactMatch = filteredSuggestions.some(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  const shouldShowCreate = trimmed.length > 0 && !exactMatch;

  const handleSelect = (selected: string) => {
    onChange(selected);
    setInputValue("");
    setOpen(false);
  };

  const handleCreate = () => {
    if (!trimmed) return;
    onChange(trimmed);
    setInputValue("");
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setInputValue("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex h-9 w-64 items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type to create…"
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {shouldShowCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={handleCreate}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create &ldquo;{trimmed}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
            {shouldShowCreate && filteredSuggestions.length > 0 && (
              <CommandSeparator />
            )}
            <CommandGroup>
              {filteredSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion}
                  onSelect={() => handleSelect(suggestion)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === suggestion ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {suggestion}
                </CommandItem>
              ))}
            </CommandGroup>
            {!shouldShowCreate && filteredSuggestions.length === 0 && (
              <CommandEmpty>No suggestions found.</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
