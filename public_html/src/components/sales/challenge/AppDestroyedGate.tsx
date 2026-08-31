import { useEffect, useMemo, useState } from "react";
import type { SalesLockoutInfo } from "@/types/sales";
import "./app-destroyed.css";

/**
 * The destruction gate.
 *
 * A salesperson who accepted a challenge and let the deadline pass loses their
 * access to the sales app. They can still sign in — they have to, to be told
 * what happened — but this is the only thing the app will show them until an
 * administrator restores them from the desktop. The server enforces the same
 * thing: every sales endpoint answers them with 423, so removing this component
 * from the page would gain them nothing.
 *
 * It replays on every entry, deliberately. That is the point of it.
 *
 * The sequence: the interface glitches, tears apart, and spirals into a
 * colourful singularity, leaving the message. `prefers-reduced-motion` drops
 * straight to the message, which carries the whole meaning on its own.
 */

type Phase = "crash" | "spiral" | "void";

const TIMINGS: Record<Exclude<Phase, "crash">, number> = { spiral: 1400, void: 3150 };
const REDUCED: Record<Exclude<Phase, "crash">, number> = { spiral: 80, void: 260 };

const SPARK_COLOURS = ["#38e0ff", "#2ea0da", "#8b5cf6", "#ff4fa3", "#ffb020"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatStamp(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Sparks streaming in from the edges toward the centre. Placed once, not animated from JS. */
function Sparks() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const angle = (i / 26) * Math.PI * 2 + Math.random();
        const radius = 42 + Math.random() * 14;
        const left = 50 + Math.cos(angle) * radius;
        const top = 50 + Math.sin(angle) * radius;
        return {
          id: i,
          left: `${left}%`,
          top: `${top}%`,
          // Travel back toward the middle of the screen.
          dx: `${-Math.cos(angle) * radius * 0.9}vw`,
          dy: `${-Math.sin(angle) * radius * 0.9}vh`,
          colour: SPARK_COLOURS[i % SPARK_COLOURS.length],
          delay: `${(Math.random() * 1.6).toFixed(2)}s`,
          duration: `${(1.2 + Math.random() * 1.4).toFixed(2)}s`,
        };
      }),
    [],
  );

  return (
    <div className="kyn-void__sparks" aria-hidden="true">
      {sparks.map((s) => (
        <span
          key={s.id}
          className="kyn-void__spark"
          style={
            {
              left: s.left,
              top: s.top,
              "--spark-dx": s.dx,
              "--spark-dy": s.dy,
              "--spark-colour": s.colour,
              "--spark-delay": s.delay,
              "--spark-duration": s.duration,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** A recognisable stand-in for the app being destroyed — not a screenshot. */
function MockApp() {
  return (
    <div className="kyn-void__app" aria-hidden="true">
      <div className="kyn-void__panel">
        <div className="kyn-void__bar kyn-void__bar--short" />
        <div className="kyn-void__bar kyn-void__bar--mid" />
      </div>
      <div className="kyn-void__panel">
        <div className="kyn-void__tiles">
          <div className="kyn-void__tile">
            <b>08</b>
            <span>Follow-ups today</span>
          </div>
          <div className="kyn-void__tile">
            <b>03</b>
            <span>Overdue</span>
          </div>
        </div>
      </div>
      <div className="kyn-void__panel">
        <div className="kyn-void__bar kyn-void__bar--wide" />
        <div className="kyn-void__bar kyn-void__bar--mid" />
        <div className="kyn-void__bar kyn-void__bar--short" />
      </div>
      <div className="kyn-void__panel">
        <div className="kyn-void__bar kyn-void__bar--mid" />
        <div className="kyn-void__bar kyn-void__bar--wide" />
      </div>
      <div className="kyn-void__panel kyn-void__tabs">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function AppDestroyedGate({
  lockout,
  userName,
  onSignOut,
}: {
  lockout: SalesLockoutInfo;
  userName?: string;
  onSignOut?: () => void;
}) {
  const reduced = useMemo(prefersReducedMotion, []);
  const [phase, setPhase] = useState<Phase>("crash");

  useEffect(() => {
    const t = reduced ? REDUCED : TIMINGS;
    const timers = [
      window.setTimeout(() => setPhase("spiral"), t.spiral),
      window.setTimeout(() => setPhase("void"), t.void),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  return (
    <div className="kyn-void" data-phase={phase} role="alertdialog" aria-labelledby="kyn-void-title">
      {phase !== "void" && (
        <>
          <div className="kyn-void__stage">
            <MockApp />
          </div>
          <div className="kyn-void__hole" aria-hidden="true">
            <div className="kyn-void__disk" />
            <div className="kyn-void__disk kyn-void__disk--inner" />
            <div className="kyn-void__horizon">
              <span className="kyn-void__lens" />
            </div>
          </div>
          {!reduced && <Sparks />}
        </>
      )}

      {phase === "void" && (
        <>
          <div className="kyn-void__hole" aria-hidden="true">
            <div className="kyn-void__disk" />
            <div className="kyn-void__disk kyn-void__disk--inner" />
            <div className="kyn-void__horizon">
              <span className="kyn-void__lens" />
            </div>
          </div>

          <div className="kyn-void__message">
            <h1 className="kyn-void__title" id="kyn-void-title">
              Your app is <em>destroyed</em>
            </h1>
            <p className="kyn-void__lede">
              {userName ? `${userName}, you ` : "You "}
              accepted a challenge and the deadline passed without it being finished. Your access to
              the Kynetropo sales app has been destroyed.
            </p>

            <p className="kyn-void__contact">Contact your Kynetropo administrator to be restored.</p>

            <dl className="kyn-void__facts">
              {lockout.challenge_title && (
                <div className="kyn-void__fact">
                  <dt>Challenge</dt>
                  <dd>
                    {lockout.challenge_code ? `${lockout.challenge_code} — ` : ""}
                    {lockout.challenge_title}
                  </dd>
                </div>
              )}
              {lockout.deadline && (
                <div className="kyn-void__fact">
                  <dt>Deadline</dt>
                  <dd>{formatStamp(lockout.deadline)}</dd>
                </div>
              )}
              <div className="kyn-void__fact">
                <dt>Destroyed at</dt>
                <dd>{formatStamp(lockout.locked_at)}</dd>
              </div>
            </dl>

            {onSignOut && (
              <button type="button" className="kyn-void__signout" onClick={onSignOut}>
                Sign out
              </button>
            )}
          </div>

          {/* The state is announced regardless of how much motion was shown. */}
          <p className="sr-only" role="status">
            Your sales app access was destroyed after a missed challenge. Contact your Kynetropo
            administrator.
          </p>
        </>
      )}
    </div>
  );
}

export default AppDestroyedGate;
