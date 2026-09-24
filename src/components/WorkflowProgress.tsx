import { useState } from "react";
import { Check, ChevronRight, Route } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A record's workflow as a progress line, with the next step one click away —
 * the "Order progress" design from chennis-raymondshop (OrderFlow).
 *
 * Done steps carry a tick, the current one is filled, the rest are outlined.
 * "Next step" moves one stage forward; any other stage can still be picked
 * from the line itself. Either way the move is confirmed in a dialog with an
 * optional note, and `onMove` runs the save.
 */
export function WorkflowProgress({
  title = "Progress",
  steps,
  current,
  onMove,
  disabled,
  subtitle,
}: {
  title?: string;
  steps: readonly string[];
  current: string;
  /** Saves the move. Throw to keep the dialog open with the error. */
  onMove: (stage: string, note: string) => Promise<unknown>;
  disabled?: boolean;
  subtitle?: string;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const at = steps.indexOf(current);
  const next = at >= 0 && at < steps.length - 1 ? steps[at + 1] : null;
  const pick = (stage: string) => { if (!disabled && stage !== current) setTarget(stage); };

  return (
    <SectionCard icon={Route} title={title} subtitle={subtitle ?? (at === steps.length - 1 ? "Complete" : at >= 0 ? `Step ${at + 1} of ${steps.length}` : undefined)}>
      <ol className="flex flex-wrap items-start gap-y-3">
        {steps.map((step, i) => {
          const done = at >= 0 && i < at;
          const now = i === at;
          return (
            <li key={step} className="flex items-center">
              {i > 0 && <span aria-hidden className={cn("mx-1 h-0.5 w-4 sm:w-6", done || now ? "bg-primary/60" : "bg-border")} />}
              <button
                type="button"
                onClick={() => pick(step)}
                disabled={disabled || now}
                title={now ? "Current stage" : `Move to ${step}`}
                className="flex min-w-[4.5rem] flex-col items-center gap-1 rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <span className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border-2 transition-colors",
                  now ? "border-primary bg-primary text-primary-foreground"
                    : done ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}>
                  {now ? <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground" /> : done ? <Check className="h-4 w-4" /> : ""}
                </span>
                <span className={cn("max-w-[6rem] text-center text-xs", now ? "font-semibold text-foreground" : "text-muted-foreground")}>{step}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {next && !disabled && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Next step</span>
          <Button onClick={() => setTarget(next)}>
            {next} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ActionDialog
        open={target !== null}
        onOpenChange={(v) => { if (!v) setTarget(null); }}
        title={`Move to "${target ?? ""}"`}
        description={
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{current || "—"}</span>
            <ChevronRight className="h-4 w-4" />
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{target}</span>
          </span>
        }
        confirmLabel="Move"
        onConfirm={async ({ reason }) => { if (target) await onMove(target, reason); }}
        successMessage={target ? `Moved to ${target}` : undefined}
        note="Note"
      />
    </SectionCard>
  );
}

export default WorkflowProgress;
