import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The ⋮ at the end of a table row, holding that row's actions.
 *
 * Edit, activate and delete used to sit in the row as three ghost icon buttons.
 * Three buttons wide is a column's worth of space on every row for actions
 * taken on almost none of them, and a delete icon one pixel from an edit icon
 * is a mis-click with no undo. Folded into a menu the row ends with one target,
 * and destructive items can be labelled in words rather than trusted to a red
 * outline.
 *
 * The click is stopped here rather than at each item because these rows open
 * their record when clicked — opening the operator while reaching for its menu
 * is the bug this prevents.
 */
export function RowActionsMenu({
  children,
  ariaLabel = "Row actions",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      role="presentation"
      className="flex justify-end"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={ariaLabel} className="h-8 w-8">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default RowActionsMenu;
