import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

interface SelectionCountDropdownItemProps {
  icon: LucideIcon;
  label: string;
  selectedCount?: number;
  totalCount?: number;
  onClick: () => void;
}

export function SelectionCountDropdownItem({
  icon: Icon,
  label,
  selectedCount = 0,
  totalCount = 0,
  onClick,
}: SelectionCountDropdownItemProps) {
  return (
    <DropdownMenuItem onClick={onClick}>
      <Icon className="h-4 w-4 mr-2" />
      {label}
      <span className="ml-auto text-xs text-muted-foreground pl-4">
        {selectedCount > 0 ? `${selectedCount} selected` : `all ${totalCount}`}
      </span>
    </DropdownMenuItem>
  );
}
