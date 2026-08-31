import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface DialogFooterWithTotalProps {
  totalLabel: string;
  saving: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: () => void;
}

export function DialogFooterWithTotal({
  totalLabel,
  saving,
  submitLabel = "Save",
  onCancel,
  onSubmit,
}: DialogFooterWithTotalProps) {
  return (
    <DialogFooter className="items-center sm:justify-between">
      <div className="text-base font-semibold">{totalLabel}</div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={onSubmit}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </DialogFooter>
  );
}
