import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface DialogFormFooterProps {
  saving: boolean;
  onCancel: () => void;
  submitLabel?: string;
  savingLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
}

export function DialogFormFooter({
  saving,
  onCancel,
  submitLabel = "Save",
  savingLabel = "Saving…",
  cancelLabel = "Cancel",
  icon,
}: DialogFormFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" type="button" onClick={onCancel} disabled={saving}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={saving} className="gap-2">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {savingLabel}
          </>
        ) : (
          <>
            {icon}
            {submitLabel}
          </>
        )}
      </Button>
    </DialogFooter>
  );
}
