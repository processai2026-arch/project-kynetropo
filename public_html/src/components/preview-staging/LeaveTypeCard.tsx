import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface LeaveTypeCardProps {
  /** Display name of the leave type */
  name: string;
  /** Annual quota in days */
  quota: number;
  /** Whether this leave type is paid */
  isPaid: boolean;
  /** Whether the leave type is currently active */
  isActive: boolean;
  /** Called when the edit button is clicked */
  onEdit: () => void;
  /** Called when the active toggle is changed; receives the new boolean value */
  onToggle: (value: boolean) => void;
  /** Unique id wired to the Switch + Label htmlFor pair */
  toggleId: string;
}

export function LeaveTypeCard({
  name,
  quota,
  isPaid,
  isActive,
  onEdit,
  onToggle,
  toggleId,
}: LeaveTypeCardProps) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-card-foreground truncate">
              {name}
            </h3>
            {!isActive && (
              <Badge className="border bg-muted text-muted-foreground capitalize shrink-0">
                Inactive
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {quota} {quota === 1 ? "day" : "days"} annual quota &middot;{" "}
            {isPaid ? "Paid" : "Unpaid"}
          </p>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          className="shrink-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      {/* Footer toggle */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Label
          htmlFor={toggleId}
          className="text-xs text-muted-foreground cursor-pointer select-none"
        >
          Active
        </Label>
        <Switch
          id={toggleId}
          checked={isActive}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${name} active state`}
        />
      </div>
    </div>
  );
}

export default LeaveTypeCard;
