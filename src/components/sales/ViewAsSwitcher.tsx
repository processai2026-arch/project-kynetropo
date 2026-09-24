import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSalesViewAs } from "@/hooks/useSalesViewAs";
import { useTeamMembers, namesakeHint } from "@/hooks/useTeamMembers";

/**
 * "Show me what Naresh is working on."
 *
 * Picking a colleague points the whole module at them — the dashboard totals,
 * the pipeline, the diary, the tasks, the challenges. Nothing can be changed
 * while you are in there: the server only honours the switch on reads and
 * refuses any write that carries it, and the app drops every button that would
 * be refused rather than offering it and failing at the last step.
 */
export function ViewAsSwitcher({ className }: { className?: string }) {
  const { viewAs, setViewAs } = useSalesViewAs();
  const people = useTeamMembers(true);

  // Nobody to switch to. One person on a team of one is just "my view".
  if (people.length < 2) return null;

  return (
    <div className={className}>
      <Select
        value={viewAs ? String(viewAs.user_id) : "mine"}
        onValueChange={(v) => {
          if (v === "mine") {
            setViewAs(null);
            return;
          }
          const person = people.find((p) => String(p.user_id) === v);
          setViewAs(person ? { user_id: person.user_id, name: person.name } : null);
        }}
      >
        <SelectTrigger className="h-9 w-[190px] gap-2" aria-label="Whose work to show">
          <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mine">My view</SelectItem>
          {people.map((p) => (
            <SelectItem key={p.user_id} value={String(p.user_id)}>
              {p.name}
              {namesakeHint(p) && (
                <span className="ml-1.5 text-xs text-muted-foreground">{namesakeHint(p)}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The strip that keeps saying whose figures these are.
 *
 * Shown on every sales screen, not just the one where the switch was made:
 * the whole risk of a mode like this is forgetting you are in it and reading
 * someone else's numbers as your own.
 */
export function ViewAsBanner() {
  const { viewAs, setViewAs } = useSalesViewAs();
  if (!viewAs) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">Viewing {viewAs.name}</p>
          <p className="text-[11px] text-muted-foreground">Read-only — nothing here can be changed</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="h-8 shrink-0 px-2.5" onClick={() => setViewAs(null)}>
        <X className="mr-1 h-3.5 w-3.5" />
        Mine
      </Button>
    </div>
  );
}
