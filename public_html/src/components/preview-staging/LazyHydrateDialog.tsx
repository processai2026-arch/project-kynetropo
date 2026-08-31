import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface LazyHydrateDialogProps<T> {
  partialData: T | null;
  fullData: T | null;
  isLoading: boolean;
  loadingText?: string;
  title?: string;
  contentClassName?: string;
  onClose: () => void;
  children: (data: T, isLoading: boolean) => ReactNode;
}

export function LazyHydrateDialog<T>({
  partialData,
  fullData,
  isLoading,
  loadingText,
  title,
  contentClassName,
  onClose,
  children,
}: LazyHydrateDialogProps<T>) {
  const open = partialData !== null || fullData !== null;
  const activeData = fullData ?? partialData;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={cn("max-w-2xl", contentClassName)}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {loadingText ?? "Loading…"}
          </p>
        ) : activeData !== null ? (
          children(activeData, isLoading)
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
