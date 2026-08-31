import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { cn } from "@/lib/utils";
import { RACI_LABELS, RACI_ROLES, type RaciRole } from "@/lib/api/meetings";

export interface RaciRow {
  id: string;
  deliverable: string;
  assignments: Record<string, RaciRole>;
}

export interface RaciMatrixTableProps {
  raci: RaciRow[];
  attendeeIds: string[];
  nameMap: Record<string, { name: string }>;
  editable?: boolean;
  onRoleChange?: (rowId: string, empId: string, role: RaciRole) => void;
  onDeleteRow?: (rowId: string) => void;
}

export function RaciRolePill({ role }: { role: RaciRole }) {
  const config = RACI_LABELS[role] ?? RACI_LABELS["-"];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold",
        config.color
      )}
    >
      {role === "-" ? "" : role}
    </span>
  );
}

export function RaciMatrixTable({
  raci,
  attendeeIds,
  nameMap,
  editable = false,
  onRoleChange,
  onDeleteRow,
}: RaciMatrixTableProps) {
  if (attendeeIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Select attendees first to build the RACI matrix.
      </p>
    );
  }

  if (raci.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No deliverables added yet.
      </p>
    );
  }

  const showDelete = editable && !!onDeleteRow;
  const showSelect = editable && !!onRoleChange;

  return (
    <div className="space-y-2">
      <ScrollableX className="rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium min-w-[180px]">
                Deliverable
              </th>
              {attendeeIds.map((id) => (
                <th
                  key={id}
                  className="px-2 py-2 font-medium text-center min-w-[80px]"
                >
                  {nameMap[id]?.name.split(" ")[0] ?? id}
                </th>
              ))}
              {showDelete && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {raci.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-medium text-card-foreground">
                  {r.deliverable || "—"}
                </td>
                {attendeeIds.map((id) => {
                  const role = (r.assignments[id] ?? "-") as RaciRole;
                  return (
                    <td key={id} className="px-2 py-2 text-center">
                      {showSelect ? (
                        <Select
                          value={role}
                          onValueChange={(v) => onRoleChange!(r.id, id, v as RaciRole)}
                        >
                          <SelectTrigger className="h-8 w-20 text-xs mx-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RACI_ROLES.map((rl) => (
                              <SelectItem key={rl} value={rl}>
                                {rl === "-"
                                  ? "— None"
                                  : `${rl} · ${RACI_LABELS[rl].label}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <RaciRolePill role={role} />
                      )}
                    </td>
                  );
                })}
                {showDelete && (
                  <td className="px-1 py-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onDeleteRow!(r.id)}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableX>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {RACI_ROLES.filter((r) => r !== "-").map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center",
                RACI_LABELS[r].color
              )}
            >
              {r}
            </span>
            {RACI_LABELS[r].label}
          </div>
        ))}
      </div>
    </div>
  );
}
