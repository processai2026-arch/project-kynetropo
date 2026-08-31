/** Stub component — placeholder for a QR code scanner (camera-based). */
import React from "react";
import { X, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  fullscreen?: boolean;
  busy?: boolean;
}

export function QrScanner({ onScan: _onScan, onClose, fullscreen: _fullscreen, busy }: QrScannerProps) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-4 bg-black/80">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 shadow-2xl">
        <QrCode className="h-16 w-16 text-primary" />
        <p className="text-sm text-muted-foreground">
          {busy ? "Processing…" : "QR scanner is not available in this environment."}
        </p>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="h-4 w-4" /> Close
        </Button>
      </div>
    </div>
  );
}
