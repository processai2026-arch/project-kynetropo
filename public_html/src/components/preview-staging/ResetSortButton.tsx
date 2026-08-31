import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResetSortButtonProps {
  visible: boolean;
  onReset: () => void;
}

export function ResetSortButton({ visible, onReset }: ResetSortButtonProps) {
  if (!visible) return null;
  return (
    <Button variant="outline" size="sm" onClick={onReset} className="text-xs">
      <RefreshCw className="h-3 w-3 mr-1" />
      Reset Sort
    </Button>
  );
}
