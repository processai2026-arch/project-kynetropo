import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export interface ScanResult {
  name: string;
  action: string;
  time: string;
}

interface ScanSuccessOverlayProps {
  scan: ScanResult | null;
  onDismiss: () => void;
  dismissAfterMs?: number;
  title?: string;
}

export function ScanSuccessOverlay({
  scan,
  onDismiss,
  dismissAfterMs = 3000,
  title = "Attendance Marked",
}: ScanSuccessOverlayProps) {
  useEffect(() => {
    if (!scan) return;
    const timer = setTimeout(onDismiss, dismissAfterMs);
    return () => clearTimeout(timer);
  }, [scan, onDismiss, dismissAfterMs]);

  if (!scan) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/35 px-4 pointer-events-none">
      <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-background p-10 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-14 w-14 text-primary" />
        </div>
        <p className="text-3xl font-bold text-foreground">{title}</p>
        <p className="mt-4 text-2xl font-semibold text-primary">{scan.name}</p>
        <p className="mt-2 text-lg text-muted-foreground">
          {scan.action} at {scan.time}
        </p>
      </div>
    </div>
  );
}
