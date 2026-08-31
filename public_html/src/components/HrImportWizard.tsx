/** Stub component — placeholder for the HR bulk import wizard. */
import React from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ImportKind = "attendance" | "tasks" | "employees" | string;

interface HrImportWizardProps {
  kind: ImportKind;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const KIND_LABELS: Record<string, string> = {
  attendance: "Attendance",
  tasks: "Tasks",
  employees: "Employees",
};

export function HrImportWizard({ kind, open, onClose, onDone: _onDone }: HrImportWizardProps) {
  const label = KIND_LABELS[kind] ?? kind;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import {label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Bulk import for <strong>{label}</strong> is not yet configured in this environment.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
