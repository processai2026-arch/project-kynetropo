import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddToCatalogOverlayProps {
  prompt: { name: string; [key: string]: string } | null;
  isAdding: boolean;
  onSkip: () => void;
  onConfirm: () => void;
  title?: string;
  body?: ReactNode;
}

export function AddToCatalogOverlay({
  prompt,
  isAdding,
  onSkip,
  onConfirm,
  title,
  body,
}: AddToCatalogOverlayProps) {
  if (!prompt) return null;

  const resolvedTitle = title ?? `Add "${prompt.name}" to Catalog?`;
  const resolvedBody =
    body ??
    `"${prompt.name}" was not found in your product catalog. Would you like to add it now so it appears in future lookups?`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm mx-4 space-y-4">
        <h2 className="text-base font-semibold text-foreground">{resolvedTitle}</h2>
        <p className="text-sm text-muted-foreground">{resolvedBody}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onSkip}>
            Skip
          </Button>
          <Button className="flex-1" disabled={isAdding} onClick={onConfirm}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add to Catalog
          </Button>
        </div>
      </div>
    </div>
  );
}
