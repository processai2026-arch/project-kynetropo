import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditableTableCellProps {
  value: string | number;
  onChange: (rawValue: string) => void;
  inputMode?: "decimal" | "numeric";
  width?: string;
}

export function InlineEditableTableCell({
  value,
  onChange,
  inputMode = "decimal",
  width = "w-24",
}: InlineEditableTableCellProps) {
  return (
    <td className="px-4 py-3 text-right">
      <Input
        type="text"
        inputMode={inputMode}
        className={cn("h-8 ml-auto text-right", width)}
        value={String(value ?? 0)}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}
