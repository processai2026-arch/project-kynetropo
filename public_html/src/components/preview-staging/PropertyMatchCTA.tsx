import React from "react";
import { Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PropertyMatchCTAProps {
  /** Whether a lead already exists for this property-buyer pair */
  hasLead: boolean;
  /** Whether the property is currently available */
  isAvailable: boolean;
  /** Lead code to display alongside the badge, e.g. "LD-0042" */
  leadCode?: string;
  /** Called when the user clicks the Create Lead button */
  onCreateLead?: () => void;
}

export function PropertyMatchCTA({
  hasLead,
  isAvailable,
  leadCode,
  onCreateLead,
}: PropertyMatchCTAProps) {
  if (hasLead) {
    return (
      <Badge
        className={cn(
          "border inline-flex items-center gap-1 text-xs",
          "bg-emerald-50 text-emerald-700 border-emerald-200",
        )}
      >
        <Check className="h-3 w-3" />
        Lead created{leadCode ? ` · ${leadCode}` : ""}
      </Badge>
    );
  }

  if (isAvailable) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={onCreateLead}
      >
        <Plus className="h-3 w-3 mr-1" />
        Create Lead
      </Button>
    );
  }

  return (
    <span className="text-xs text-muted-foreground capitalize">
      Not available
    </span>
  );
}

export default PropertyMatchCTA;
