import { cn } from "@/lib/utils";

interface AiHealthScoreRingProps {
  score: number;
  scoreRing: string;
  scoreTone: string;
}

export function getScoreRing(score: number): string {
  if (score >= 70) return "border-emerald-500";
  if (score >= 45) return "border-amber-400";
  return "border-red-500";
}

export function getScoreTone(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 45) return "text-amber-500";
  return "text-red-500";
}

export function AiHealthScoreRing({ score, scoreRing, scoreTone }: AiHealthScoreRingProps) {
  return (
    <div
      className={cn(
        "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4",
        scoreRing
      )}
    >
      <span className={cn("text-xl font-bold leading-none", scoreTone)}>{score}</span>
      <span className="text-[9px] text-muted-foreground">health</span>
    </div>
  );
}
