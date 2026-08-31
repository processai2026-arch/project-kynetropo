import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface RefreshSpinButtonProps {
  loading: boolean;
  onClick: () => void;
  label?: string;
}

export function RefreshSpinButton({
  loading,
  onClick,
  label = "Refresh",
}: RefreshSpinButtonProps) {
  return (
    <Button onClick={onClick} disabled={loading}>
      <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
      {loading ? "Loading…" : label}
    </Button>
  );
}
