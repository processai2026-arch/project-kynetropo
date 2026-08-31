/** Stub component — placeholder for facial recognition attendance scanner. */
import React from "react";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Employee {
  id?: number | string;
  name?: string;
  [key: string]: unknown;
}

interface FaceAttendanceScannerProps {
  employees: Employee[];
  onMatch: (employee: Employee) => void;
  onClose: () => void;
  busy?: boolean;
}

export function FaceAttendanceScanner({
  employees: _employees,
  onMatch: _onMatch,
  onClose,
  busy,
}: FaceAttendanceScannerProps) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-4 bg-black/80">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 shadow-2xl">
        <Camera className="h-16 w-16 text-primary" />
        <p className="text-sm text-muted-foreground">
          {busy ? "Processing…" : "Face scanner is not available in this environment."}
        </p>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="h-4 w-4" /> Close
        </Button>
      </div>
    </div>
  );
}
