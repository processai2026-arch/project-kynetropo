import { KeyboardEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface InlineAddRowProps {
  /** Controlled value of the text input. */
  value: string;
  /** Called on every keystroke with the new raw string. */
  onChange: (value: string) => void;
  /** Called when the user clicks Add or presses Enter (guarded: no-ops when saving or empty). */
  onAdd: () => void;
  /** When true the button shows a spinner and both controls are disabled. */
  saving?: boolean;
  /** Placeholder shown inside the input. */
  placeholder?: string;
  /** Button label text. */
  addLabel?: string;
}

export function InlineAddRow({
  value,
  onChange,
  onAdd,
  saving = false,
  placeholder = "Add item…",
  addLabel = "Add",
}: InlineAddRowProps) {
  const canSubmit = !saving && value.trim().length > 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) onAdd();
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={saving}
        className="h-8 text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs shrink-0"
        disabled={!canSubmit}
        onClick={onAdd}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <Plus className="h-3.5 w-3.5 mr-1" />
        )}
        {addLabel}
      </Button>
    </div>
  );
}

export default InlineAddRow;
