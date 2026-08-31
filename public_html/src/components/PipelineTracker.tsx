import { CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface PipelineStage {
  key: string;
  label: string;
}

export interface PipelineTrackerProps {
  /** Ordered list of pipeline stages (from schema.json or a local constant). */
  stages: PipelineStage[];
  /** Index of the current active stage in the stages array. */
  currentIdx: number;
  /** Keys of stages that were skipped (jumped over). */
  skippedStages?: string[];
  /** Whether the lead is lost — renders a red Lost badge and dims everything. */
  isLost?: boolean;
  /** Called when a stage circle is clicked. Receives the stage key and index. */
  onStageClick?: (key: string, idx: number) => void;
  /** Optional extra node rendered after the last circle (e.g. Full Payment virtual stage). */
  trailingNode?: React.ReactNode;
  /** Milestone dates rendered below the tracker strip. */
  milestones?: { label: string; date: string | null | undefined }[];
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export function PipelineTracker({
  stages,
  currentIdx,
  skippedStages = [],
  isLost = false,
  onStageClick,
  trailingNode,
  milestones,
}: PipelineTrackerProps) {
  const skippedSet = new Set(skippedStages);

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <div className="flex items-start gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const isSkipped   = skippedSet.has(stage.key);
          const isLastStage = idx === stages.length - 1;
          const isCompleted = !isLost && (idx < currentIdx || (isLastStage && idx === currentIdx));
          const isCurrent   = !isLost && idx === currentIdx && !isLastStage;
          const isFuture    = idx > currentIdx;

          return (
            <div key={stage.key} className="flex items-center gap-1 min-w-0 shrink-0">
              <div
                className={cn(
                  'flex flex-col items-center gap-1 shrink-0',
                  onStageClick && 'cursor-pointer group',
                )}
                onClick={() => onStageClick?.(stage.key, idx)}
              >
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all border-2',
                  isSkipped
                    ? 'bg-muted border-muted-foreground/30 text-muted-foreground hover:border-primary/50'
                    : isCompleted
                      ? 'bg-primary border-primary text-primary-foreground group-hover:bg-primary/80'
                      : isCurrent
                        ? 'bg-primary/10 border-primary text-primary'
                        : isFuture
                          ? 'bg-background border-muted-foreground/30 text-muted-foreground group-hover:border-primary/50'
                          : 'bg-muted border-muted text-muted-foreground',
                )}>
                  {isSkipped
                    ? <span className="text-[10px] font-bold">—</span>
                    : isCompleted
                      ? <CheckCircle2 className="h-4 w-4" />
                      : <Circle className={cn('h-3 w-3', isFuture && 'opacity-40')} />}
                </div>
                <span className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  isCurrent   ? 'text-primary' :
                  isCompleted ? 'text-card-foreground' :
                  isSkipped   ? 'text-muted-foreground opacity-50' :
                  'text-muted-foreground opacity-60',
                )}>
                  {stage.label}
                </span>
              </div>

              {idx < stages.length - 1 && (
                <div className={cn(
                  'h-0.5 w-5 shrink-0 mb-4',
                  idx < currentIdx && !isSkipped ? 'bg-primary' : 'bg-muted',
                )} />
              )}
            </div>
          );
        })}

        {trailingNode && (
          <div className="flex items-center gap-1 min-w-0 shrink-0">
            <div className="h-0.5 w-5 shrink-0 mb-4 bg-muted" />
            {trailingNode}
          </div>
        )}

        {isLost && (
          <Badge className="ml-3 border bg-red-50 text-red-600 border-red-200 shrink-0 self-start mt-1">
            Lost
          </Badge>
        )}
      </div>

      {milestones && milestones.some(m => m.date) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-3 border-t text-xs text-muted-foreground">
          {milestones.map(m => {
            const d = formatShortDate(m.date);
            if (!d) return null;
            return (
              <span key={m.label}>
                <span className="text-card-foreground font-medium">{m.label}:</span> {d}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PipelineTracker;
