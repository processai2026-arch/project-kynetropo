import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ToggleStatusBadgeProps {
  /** Whether the record is currently active */
  isActive: boolean;
  /** True while the API call is in flight — disables the button and shows an ellipsis */
  toggling: boolean;
  /** Callback fired when the user clicks the badge — caller owns the API call */
  onToggle: () => void;
}

export function ToggleStatusBadge({ isActive, toggling, onToggle }: ToggleStatusBadgeProps) {
  return (
    <button
      type="button"
      disabled={toggling}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "cursor-pointer rounded-md transition-opacity",
        "hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
      title={toggling ? "Updating…" : isActive ? "Click to deactivate" : "Click to activate"}
      aria-label={isActive ? "Active — click to deactivate" : "Inactive — click to activate"}
      aria-busy={toggling}
    >
      <Badge
        className={cn(
          "border capitalize pointer-events-none select-none",
          isActive
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-gray-100 text-gray-500 border-gray-200"
        )}
      >
        {toggling ? "…" : isActive ? "Active" : "Inactive"}
      </Badge>
    </button>
  );
}

export default ToggleStatusBadge;
