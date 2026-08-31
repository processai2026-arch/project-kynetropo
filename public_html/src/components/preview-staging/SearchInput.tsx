import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  width?: string;
}

export function SearchInput({ value, onChange, placeholder = "Search…", className, width = "w-64" }: SearchInputProps) {
  return (
    <div className={cn("relative", width, className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className="pl-10"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
