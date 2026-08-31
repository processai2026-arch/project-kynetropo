import { CheckCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CropSavedChipProps {
  label: string;
  onReset: () => void;
  resetDisabled?: boolean;
}

export function CropSavedChip({
  label,
  onReset,
  resetDisabled = false,
}: CropSavedChipProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
        <CheckCircle className="h-3.5 w-3.5" />
        {label}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        disabled={resetDisabled}
        className={cn(
          "text-destructive hover:text-destructive border-destructive/30",
          resetDisabled && "pointer-events-none opacity-50"
        )}
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1" />
        Reset
      </Button>
    </div>
  );
}
