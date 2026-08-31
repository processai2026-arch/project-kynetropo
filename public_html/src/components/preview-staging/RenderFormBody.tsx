import React from "react";
import { Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

export interface RenderFormBodyProps {
  onSubmit: () => void;
  submitLabel: string;
  showPassword: boolean;
  isEdit?: boolean;
  children?: React.ReactNode;
}

export function renderFormBody({
  onSubmit,
  submitLabel,
  showPassword,
  isEdit = false,
  children,
}: RenderFormBodyProps): JSX.Element {
  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
      {showPassword && !isEdit && (
        <p className="text-xs text-muted-foreground">
          Dealer will login with their phone number and the password you set below.
        </p>
      )}
      {children}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={onSubmit} className="gap-2">
          {showPassword && !isEdit && <Key className="h-4 w-4" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}
