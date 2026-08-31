import { Shield, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UserListItemUser {
  user_id: number | string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  is_active: boolean;
}

interface UserListItemProps {
  user: UserListItemUser;
  onEdit: (user: UserListItemUser) => void;
  onDelete: (userId: number | string) => void;
}

export function UserListItem({ user, onEdit, onDelete }: UserListItemProps) {
  return (
    <div className="p-4 flex items-center gap-4">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Shield className="h-4 w-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-card-foreground truncate">
          {user.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {user.email ?? ""}
          {user.phone ? ` · ${user.phone}` : ""}
        </p>
      </div>

      <Badge className="border capitalize bg-muted text-muted-foreground text-xs shrink-0">
        {user.role.replace(/_/g, " ")}
      </Badge>

      <Badge
        className={cn(
          "border text-xs shrink-0",
          user.is_active
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-gray-100 text-gray-400 border-gray-200"
        )}
      >
        {user.is_active ? "Active" : "Inactive"}
      </Badge>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${user.name}`}
          onClick={() => onEdit(user)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${user.name}`}
          onClick={() => onDelete(user.user_id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export default UserListItem;
