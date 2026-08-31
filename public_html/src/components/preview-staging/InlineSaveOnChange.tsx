import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface InlineSaveOnChangeProps {
  currentValue: string;
  persistedValue: string;
  options: string[];
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void>;
  triggerWidth?: string;
  disabled?: boolean;
}

export function InlineSaveOnChange({
  currentValue,
  persistedValue,
  options,
  onChange,
  onSave,
  triggerWidth = "w-40",
  disabled = false,
}: InlineSaveOnChangeProps) {
  const [saving, setSaving] = useState(false);

  const isDirty = currentValue !== persistedValue;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(currentValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <Select
        value={currentValue}
        onValueChange={onChange}
        disabled={disabled || saving}
      >
        <SelectTrigger className={cn("h-8 text-sm", triggerWidth)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isDirty && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Saving
            </>
          ) : (
            "Save"
          )}
        </Button>
      )}
    </div>
  );
}
