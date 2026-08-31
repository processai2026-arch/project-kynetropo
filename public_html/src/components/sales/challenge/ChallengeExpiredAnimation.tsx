import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DestroyedScreen } from "./DestroyedScreen";
import { EmberParticles } from "./EmberParticles";
import { Singularity } from "./Singularity";
import type { ChallengeReport } from "@/types/sales";
import "./challenge-destroy.css";

type Phase = "verifying" | "collapsing" | "destroyed";

interface ChallengeExpiredAnimationProps {
  /**
   * The actual challenge shell to destroy. Mark its sections with
   * data-destroy-group="1".."6" so they shear apart on a stagger instead of
   * shrinking as one flat plane.
   */
  children: ReactNode;
  report?: ChallengeReport;
  challengeTitle?: string;
  challengeCode?: string;
  onSignNewPact?: () => void;
  /** Called when the user dismisses the destroyed screen. */
  onDismiss: () => void;
}

/** Full sequence ≈ 2.75s; reduced motion collapses it to a short cross-fade. */
const TIMINGS = { collapseAt: 1200, destroyedAt: 2750 };
const REDUCED_TIMINGS = { collapseAt: 150, destroyedAt: 650 };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * ChallengeExpiredAnimation — the black-hole collapse played when the backend
 * has CONFIRMED a challenge is expired.
 *
 * This component holds no business logic: it never decides that a challenge has
 * expired, never reads a deadline and never calls the API. The caller mounts it
 * only after the server reports status = 'expired' (spec §43), and the state it
 * announces is understandable without any of the motion (spec §40).
 */
export function ChallengeExpiredAnimation({
  children,
  report,
  challengeTitle,
  challengeCode,
  onSignNewPact,
  onDismiss,
}: ChallengeExpiredAnimationProps) {
  const [phase, setPhase] = useState<Phase>("verifying");
  const reduced = useRef(prefersReducedMotion()).current;

  useEffect(() => {
    const t = reduced ? REDUCED_TIMINGS : TIMINGS;
    const timers = [
      window.setTimeout(() => setPhase("collapsing"), t.collapseAt),
      // Hard cut to the destroyed state.
      window.setTimeout(() => setPhase("destroyed"), t.destroyedAt),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  // Esc always exits — the animation must never trap the user.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // The overlay is fixed and full-screen; portalling keeps it out of the
  // page's stacking and overflow contexts.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="kyn-destroy">
      {phase === "destroyed" ? (
        <DestroyedScreen
          report={report}
          challengeTitle={challengeTitle}
          challengeCode={challengeCode}
          onSignNewPact={onSignNewPact}
          onDismiss={onDismiss}
        />
      ) : (
        <>
          {/*
           * Phase 2 is mounted from the start so its CSS delays (1.2s) line up
           * with the real elapsed time; the verification overlay simply covers
           * it until then. Mounting it late would restart every delay.
           */}
          <div className="kyn-destroy__stage">
            <div className="kyn-destroy__shell">{children}</div>
          </div>
          <Singularity />
          {!reduced && <EmberParticles />}
          <div className="kyn-destroy__darkness" />

          {/* Phase 1 — verification (0–1.2s): build tension before the failure. */}
          {phase === "verifying" && (
            <div className="kyn-destroy__verify">
              <div className="kyn-destroy__mark" aria-hidden="true">
                K
                <span className="kyn-destroy__scan" />
              </div>
              <p className="kyn-destroy__verify-label">Verifying pact…</p>
            </div>
          )}

          {/* The state is announced regardless of how much motion is shown. */}
          <p className="sr-only" role="status">
            Challenge expired. Destroyed.
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}

export default ChallengeExpiredAnimation;
