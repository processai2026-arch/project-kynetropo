import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormFooterProps {
  /** Called when the Cancel button is clicked. */
  onCancel: () => void;
  /** When true, both buttons are disabled and the submit button shows a spinner. */
  saving: boolean;
  /** Label for the submit button when not saving. Defaults to "Save". */
  submitLabel?: string;
}

export function FormFooter({ onCancel, saving, submitLabel = "Save" }: FormFooterProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </div>
  );
}

export default FormFooter;
