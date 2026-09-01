import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flag, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesChallengesApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { ChallengeStatusBadge, formatDateTime, humanise } from "@/components/sales/SalesBits";
import { CommentThread } from "@/components/sales/CommentThread";
import { ChallengeTimer } from "@/components/sales/ChallengeTimer";
import { ChallengeExpiredAnimation } from "@/components/sales/challenge/ChallengeExpiredAnimation";
import type { SalesChallengeDetail as ChallengeDetail } from "@/types/sales";

/**
 * Challenge detail — accept, start, complete, and the expiry experience.
 *
 * The destruction animation is triggered by ONE thing only: the server
 * reporting status === 'expired' (spec §43). The local countdown reaching zero
 * merely triggers a re-fetch; it never decides the state by itself.
 */
export default function SalesChallengeDetail() {
  const { id } = useParams();
  const challengeId = Number(id);
  const navigate = useNavigate();
  const { me, can } = useSalesAccess();

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);

  const [completionNotes, setCompletionNotes] = useState("");

  /** Plays once per confirmed expiry, so a re-fetch doesn't replay it. */
  const [showDestruction, setShowDestruction] = useState(false);
  const playedForRef = useRef<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!Number.isFinite(challengeId) || challengeId <= 0) {
        setError("Invalid challenge");
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await salesChallengesApi.get(challengeId);
        setChallenge(data);
        setError(null);

        // The animation follows the server's verdict, never a local timer.
        if (data.status === "expired" && playedForRef.current !== data.id) {
          playedForRef.current = data.id;
          setShowDestruction(true);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not load the challenge";
        setError(message);
        if (!silent) toast.error(message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [challengeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (fn: () => Promise<ChallengeDetail>, successMessage: string) => {
    setActing(true);
    try {
      const updated = await fn();
      setChallenge(updated);
      toast.success(successMessage);
      // Re-read so derived fields (activity, report) stay in step.
      void load(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      toast.error(message);
      // A rejection is usually the server telling us the state moved on.
      void load(true);
    } finally {
      setActing(false);
    }
  };

  const isHolder = me?.user_id != null && challenge?.accepted_by === me.user_id;

  if (loading) {
    return (
      <SalesLayout>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </SalesLayout>
    );
  }

  if (error || !challenge) {
    return (
      <SalesLayout>
        <Button variant="ghost" size="sm" onClick={() => navigate("/sales/challenges")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Challenges
        </Button>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error ?? "Challenge not found"}
        </div>
      </SalesLayout>
    );
  }

  /*
   * The challenge shell. This same markup is what the destruction animation
   * tears apart, so each section carries a data-destroy-group for the stagger.
   */
  const shell = (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div data-destroy-group="1" className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Trophy className="h-4 w-4" />
          Challenge
        </div>
        <ChallengeStatusBadge value={challenge.status} />
      </div>

      <div data-destroy-group="2" className="px-5 py-4">
        <h1 className="text-xl font-bold text-card-foreground">{challenge.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {challenge.challenge_code}
          {challenge.priority !== "normal" ? ` · ${humanise(challenge.priority)} priority` : ""}
        </p>
      </div>

      <div data-destroy-group="3" className="border-t px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deadline</p>
            <p className="text-sm font-medium text-card-foreground">{formatDateTime(challenge.deadline)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time remaining</p>
            {challenge.is_actionable ? (
              <ChallengeTimer
                secondsRemaining={challenge.seconds_remaining}
                seedKey={challenge.server_time}
                size="lg"
                // Zero only prompts a re-check — the server decides what happened.
                onReachZero={() => void load(true)}
              />
            ) : (
              <span className="font-mono text-3xl font-semibold text-muted-foreground">
                {challenge.status === "expired" ? "00:00:00" : "—"}
              </span>
            )}
          </div>
        </div>
      </div>

      {challenge.description && (
        <div data-destroy-group="4" className="border-t px-5 py-4">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{challenge.description}</p>
        </div>
      )}

      <div data-destroy-group="5" className="border-t px-5 py-4 text-sm">
        {challenge.accepted_by_name ? (
          <p className="text-card-foreground">
            <span className="text-muted-foreground">Accepted by </span>
            {challenge.accepted_by_name}
            {challenge.accepted_at ? ` · ${formatDateTime(challenge.accepted_at)}` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground">Not accepted yet.</p>
        )}
        {challenge.completed_at && (
          <p className="mt-1 text-emerald-700">Completed {formatDateTime(challenge.completed_at)}</p>
        )}
        {challenge.completion_notes && (
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{challenge.completion_notes}</p>
        )}
        {challenge.lead_id && (
          <Link to={`/sales/leads/${challenge.lead_id}`} className="mt-2 inline-block text-xs text-primary underline">
            Related lead: {challenge.lead_company || challenge.lead_name}
          </Link>
        )}
      </div>

      <div data-destroy-group="6" className="border-t px-5 py-4">
        {/*
          The board is open to the whole team: anyone may read a challenge and
          join the discussion on it. Accepting is restricted to the people it
          was offered to, and never to whoever set it — `can_accept` is the
          server's answer, and the server refuses the request outright if it is
          asked anyway. The three refusals say different things because they
          are different situations, and "no" without a reason is what makes an
          app feel broken.
        */}
        {challenge.status === "available" &&
          (challenge.can_accept ? (
            <Button
              className="h-12 w-full text-base"
              disabled={acting || !challenge.is_actionable}
              onClick={() => void runAction(() => salesChallengesApi.accept(challenge.id), "Challenge accepted")}
            >
              <Flag className="mr-2 h-4 w-4" />
              Accept Challenge
            </Button>
          ) : (
            <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
              {challenge.i_created_it
                ? "You set this challenge — someone else has to take it. You can follow it and comment below."
                : challenge.assignees.length > 0
                  ? `Offered to ${challenge.assignees.map((a) => a.name ?? "someone").join(", ")} — you can follow it and comment below.`
                  : "You do not have permission to accept challenges. You can follow this one and comment below."}
            </p>
          ))}

        {/* Only the person holding the challenge can move it along. */}
        {challenge.status === "accepted" && isHolder && can("sales.challenges.accept") && (
          <Button
            className="h-12 w-full text-base"
            disabled={acting || !challenge.is_actionable}
            onClick={() => void runAction(() => salesChallengesApi.start(challenge.id), "Challenge in progress")}
          >
            Start Working
          </Button>
        )}

        {(challenge.status === "accepted" || challenge.status === "in_progress") &&
          isHolder &&
          can("sales.challenges.complete") && (
            <Button
              className="mt-2 h-12 w-full text-base"
              variant="secondary"
              disabled={acting || !challenge.is_actionable}
              onClick={() => setCompleteOpen(true)}
            >
              Mark Complete
            </Button>
          )}

        {/* What is at stake, said plainly, while it can still be acted on. */}
        {isHolder && (challenge.status === "accepted" || challenge.status === "in_progress") && (
          <p className="mt-3 text-center text-xs text-[#c2410c]">
            You are holding this challenge. If the deadline passes unfinished, your access to the
            app is destroyed until an administrator restores it.
          </p>
        )}

        {challenge.status === "expired" && (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-[#c2410c]">
              This challenge expired and can no longer be completed.
            </p>
            <Button variant="outline" className="h-11 w-full" onClick={() => setShowDestruction(true)}>
              Replay destruction
            </Button>
          </div>
        )}

        {challenge.status === "completed" && (
          <p className="text-center text-sm font-medium text-emerald-700">Challenge completed.</p>
        )}
      </div>
    </div>
  );

  return (
    <SalesLayout>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate("/sales/challenges")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Challenges
      </Button>

      {shell}

      {challenge.activity.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">History</h2>
          <ol className="relative space-y-3 border-l pl-5">
            {challenge.activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/50 ring-4 ring-background" />
                <p className="text-sm font-medium capitalize text-card-foreground">{humanise(a.action)}</p>
                {a.notes && <p className="text-sm text-muted-foreground">{a.notes}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {formatDateTime(a.created_at)}
                  {a.actor_name ? ` · ${a.actor_name}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {can("sales.comments.view") && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Discussion</h2>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <CommentThread
              entityType="challenge"
              entityId={challenge.id}
              initialComments={challenge.comments ?? []}
            />
          </div>
        </section>
      )}

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Challenge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cn">Completion notes</Label>
              <Textarea
                id="cn"
                rows={4}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="What was achieved?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCompleteOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={acting}
                onClick={async () => {
                  setCompleteOpen(false);
                  await runAction(
                    () => salesChallengesApi.complete(challenge.id, completionNotes || undefined),
                    "Challenge completed",
                  );
                  setCompletionNotes("");
                }}
              >
                {acting ? "Saving…" : "Complete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plays only for a server-confirmed expiry. */}
      {showDestruction && challenge.status === "expired" && (
        <ChallengeExpiredAnimation
          report={challenge.report}
          challengeTitle={challenge.title}
          challengeCode={challenge.challenge_code}
          onSignNewPact={
            can("sales.challenges.create") ? () => navigate("/sales/challenges?new=1") : undefined
          }
          onDismiss={() => setShowDestruction(false)}
        >
          {shell}
        </ChallengeExpiredAnimation>
      )}
    </SalesLayout>
  );
}
