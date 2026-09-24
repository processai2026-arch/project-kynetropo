import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ChallengeTimerProps {
  /** Seconds left according to the SERVER at the moment this payload was built. */
  secondsRemaining: number;
  /** Re-seeds the countdown whenever a fresh payload arrives. */
  seedKey?: string | number;
  /**
   * Fired once when the local countdown reaches zero. The parent should use
   * this to RE-FETCH the challenge, never to decide that it has expired —
   * only the backend may declare expiry.
   */
  onReachZero?: () => void;
  className?: string;
  size?: "sm" | "lg";
}

function format(total: number): string {
  const s = Math.max(0, total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * The visual countdown (spec §24). It is decoration: the device clock has no
 * authority over the challenge lifecycle. The value is seeded from the server's
 * own `seconds_remaining` and ticks down locally only so the number moves; when
 * it hits zero the parent asks the server what actually happened.
 */
export function ChallengeTimer({
  secondsRemaining,
  seedKey,
  onReachZero,
  className,
  size = "sm",
}: ChallengeTimerProps) {
  const [remaining, setRemaining] = useState(secondsRemaining);
  const firedRef = useRef(false);

  // Re-seed from the server on every refresh, so local drift never accumulates.
  useEffect(() => {
    setRemaining(secondsRemaining);
    firedRef.current = false;
  }, [secondsRemaining, seedKey]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onReachZero?.();
      }
      return;
    }
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(id);
  }, [remaining, onReachZero]);

  const urgent = remaining > 0 && remaining < 3600;

  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight",
        size === "lg" ? "text-3xl font-semibold" : "text-sm font-medium",
        remaining <= 0 ? "text-muted-foreground" : urgent ? "text-[#FF5A1F]" : "text-foreground",
        className,
      )}
      // Announced politely rather than on every tick.
      aria-label={`Time remaining ${format(remaining)}`}
    >
      {format(remaining)}
    </span>
  );
}

export default ChallengeTimer;
