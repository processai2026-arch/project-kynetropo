import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TogglableStatusBadgeProps {
  /** Whether the entity is currently active. */
  isActive: boolean;
  /** When true the button is disabled and the badge shows an ellipsis. */
  loading?: boolean;
  /** Called when the user clicks the badge. */
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function TogglableStatusBadge({
  isActive,
  loading = false,
  onClick,
}: TogglableStatusBadgeProps) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-40"
      title="Click to toggle status"
    >
      <Badge
        className={cn(
          "border",
          isActive
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-gray-100 text-gray-500 border-gray-200",
        )}
      >
        {loading ? "…" : isActive ? "Active" : "Inactive"}
      </Badge>
    </button>
  );
}

export default TogglableStatusBadge;
