import { cn } from "@/lib/utils";

interface UserProfileCellProps {
  name: string;
  email: string;
  phone?: string;
  className?: string;
}

export function UserProfileCell({
  name,
  email,
  phone,
  className,
}: UserProfileCellProps) {
  return (
    <td className={cn("px-5 py-4", className)}>
      <div className="font-medium text-foreground">{name}</div>
      <div className="text-xs text-muted-foreground">{email}</div>
      {phone && (
        <div className="text-xs text-muted-foreground">{phone}</div>
      )}
    </td>
  );
}
