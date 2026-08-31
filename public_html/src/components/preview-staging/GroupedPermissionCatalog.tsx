import { cn } from "@/lib/utils";

export interface GroupedPermissionCatalogProps {
  catalog: Record<string, string[]>;
  selected: string[];
  onToggle: (permission: string) => void;
}

export function GroupedPermissionCatalog({
  catalog,
  selected,
  onToggle,
}: GroupedPermissionCatalogProps) {
  const entries = Object.entries(catalog).filter(([, list]) => list.length > 0);

  if (entries.length === 0) {
    return (
      <div className="border rounded-lg p-3 py-6 text-sm text-muted-foreground text-center">
        No permissions available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
      {entries.map(([group, list]) => (
        <div key={group}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {group}
          </p>
          <div className="space-y-1">
            {list.map((permission) => {
              const id = `perm-${group}-${permission}`;
              return (
                <label
                  key={permission}
                  htmlFor={id}
                  className={cn(
                    "flex items-center gap-2 text-sm cursor-pointer",
                    selected.includes(permission) && "text-foreground"
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.includes(permission)}
                    onChange={() => onToggle(permission)}
                    className="rounded border-input accent-primary"
                  />
                  <span className="text-card-foreground">{permission}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
