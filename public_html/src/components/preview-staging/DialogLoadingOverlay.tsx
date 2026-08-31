import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogLoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DialogLoadingOverlay({
  loading,
  children,
  className,
}: DialogLoadingOverlayProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 py-2", className)}>
      {children}
    </div>
  );
}
