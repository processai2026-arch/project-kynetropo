import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface EntityToggleCardProps {
  id: string | number;
  name: string;
  isActive: boolean;
  meta: string;
  onEdit: () => void;
  onToggle: () => void;
  toggleDisabled?: boolean;
}

export function EntityToggleCard({
  id,
  name,
  isActive,
  meta,
  onEdit,
  onToggle,
  toggleDisabled = false,
}: EntityToggleCardProps) {
  return (
    <div
      id={String(id)}
      className={cn("rounded-md border bg-card p-4", !isActive && "opacity-75")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-card-foreground">{name}</h3>
            {!isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <Label
          htmlFor={`entity-toggle-${id}`}
          className="text-xs text-muted-foreground"
        >
          Active
        </Label>
        <Switch
          id={`entity-toggle-${id}`}
          checked={isActive}
          disabled={toggleDisabled}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
}
