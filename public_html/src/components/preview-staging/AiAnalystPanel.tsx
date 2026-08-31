import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Brain, Lightbulb, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AiAnalystResult {
  health_score: number;
  headline?: string;
  summary?: string;
  drivers: string[];
  risks: string[];
  recommendations: string[];
  outlook?: string;
  generated_at: string;
}

export interface AiAnalystPanelProps {
  isPending: boolean;
  result: AiAnalystResult | null;
  onAnalyse: () => void;
  title?: string;
  teaserText?: string;
}

const RING_R = 36;
const RING_C = 2 * Math.PI * RING_R;

function ringColors(score: number) {
  if (score >= 75) return { ring: "stroke-emerald-500", label: "text-emerald-600" };
  if (score >= 50) return { ring: "stroke-amber-500",   label: "text-amber-600"  };
  if (score >= 25) return { ring: "stroke-orange-500",  label: "text-orange-600" };
  return               { ring: "stroke-red-500",        label: "text-red-600"    };
}

interface BulletSectionProps {
  icon: LucideIcon;
  label: string;
  items: string[];
  iconCls: string;
  headingCls: string;
  dotCls: string;
}

function BulletSection({ icon: Icon, label, items, iconCls, headingCls, dotCls }: BulletSectionProps) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", iconCls)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wider", headingCls)}>
          {label}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotCls)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiAnalystPanel({
  isPending,
  result,
  onAnalyse,
  title = "AI Analysis",
  teaserText = "Run an AI-powered analysis to surface key insights, risks, and recommendations.",
}: AiAnalystPanelProps) {
  const colors = result ? ringColors(result.health_score) : null;
  const dashOffset = result
    ? RING_C * (1 - Math.max(0, Math.min(100, result.health_score)) / 100)
    : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
        </div>
        <Button
          size="sm"
          variant={result ? "outline" : "default"}
          disabled={isPending}
          onClick={onAnalyse}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : result ? (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Re-analyse
            </>
          ) : (
            "Analyse"
          )}
        </Button>
      </div>

      {!result && !isPending && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {teaserText}
        </div>
      )}

      {isPending && (
        <div className="px-4 py-8 text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analysing data…</p>
        </div>
      )}

      {result && colors && (
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative flex shrink-0 items-center justify-center">
              <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
                <circle
                  cx="44"
                  cy="44"
                  r={RING_R}
                  fill="none"
                  strokeWidth="8"
                  className="stroke-muted/30"
                />
                <circle
                  cx="44"
                  cy="44"
                  r={RING_R}
                  fill="none"
                  strokeWidth="8"
                  className={cn(colors.ring, "transition-all duration-700 ease-out")}
                  strokeDasharray={RING_C}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-xl font-bold leading-none", colors.label)}>
                  {result.health_score}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 pt-1">
              {result.headline && (
                <p className="text-base font-semibold leading-snug text-card-foreground">
                  {result.headline}
                </p>
              )}
              {result.summary && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {result.summary}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t pt-3">
            <BulletSection
              icon={TrendingUp}
              label="Drivers"
              items={result.drivers}
              iconCls="text-emerald-600"
              headingCls="text-emerald-700"
              dotCls="bg-emerald-500"
            />
            <BulletSection
              icon={AlertTriangle}
              label="Risks"
              items={result.risks}
              iconCls="text-red-500"
              headingCls="text-red-700"
              dotCls="bg-red-500"
            />
            <BulletSection
              icon={Lightbulb}
              label="Recommendations"
              items={result.recommendations}
              iconCls="text-primary"
              headingCls="text-primary"
              dotCls="bg-primary"
            />
          </div>

          {result.outlook && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium leading-relaxed text-primary">
                {result.outlook}
              </p>
            </div>
          )}

          <p className="text-right text-xs text-muted-foreground">
            Generated {new Date(result.generated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
