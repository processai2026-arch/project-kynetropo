import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TranscribeButtonProps {
  /** Callback fired when the user clicks the button. */
  onTranscribe: () => void;
  /** When true the button is disabled and shows the spinner state. */
  loading: boolean;
  /** Optional helper text rendered beside the button. */
  hint?: string;
}

export function TranscribeButton({ onTranscribe, loading, hint }: TranscribeButtonProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onTranscribe}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Transcribing…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Transcribe → Summary
          </>
        )}
      </Button>
      {hint && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

export default TranscribeButton;
