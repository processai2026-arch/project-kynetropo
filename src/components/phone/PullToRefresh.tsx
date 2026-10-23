/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL = 70;

/**
 * Pull down at the top of a phone-app screen to reload it, as in other apps (an installed app
 * has no browser refresh). Reloading also loads a newer version when one is deployed. Only a
 * downward drag that starts at the very top counts, so lists, sideways swipes and inner
 * scrollers work as before. (Diamond Fencing's, following the page scroll instead of a box.)
 */
export function usePullToRefresh(enabled: boolean): { pull: number; busy: boolean } {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;
    let dist = 0;
    const atTop = (t: EventTarget | null) => {
      for (let n = t as HTMLElement | null; n && n !== document.body; n = n.parentElement) if (n.scrollTop > 0) return false;
      return window.scrollY <= 0;
    };
    // A dialog or sheet is open: its own scrolling, not the page's.
    const inLayer = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('[role="dialog"], [data-radix-popper-content-wrapper]');
    const down = (e: TouchEvent) => {
      start = e.touches.length === 1 && !inLayer(e.target) && atTop(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      const dy = e.touches[0].clientY - start.y;
      const dx = e.touches[0].clientX - start.x;
      if (dy <= 0 || window.scrollY > 0 || (dist === 0 && Math.abs(dx) > dy)) {
        if (dist === 0 && dy !== 0) start = null;
        if (dist) { dist = 0; setPull(0); }
        return;
      }
      dist = Math.min(dy * 0.5, PULL * 1.4);
      setPull(dist);
      if (e.cancelable) e.preventDefault();
    };
    const up = () => {
      if (start && dist >= PULL) {
        setPull(PULL);
        setBusy(true);
        window.location.reload();
        return;
      }
      start = null;
      dist = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [enabled]);
  return { pull, busy };
}

/** The round arrow that follows the finger down and spins once released. */
export function PullIndicator({ pull, busy }: { pull: number; busy: boolean }) {
  if (pull <= 0 && !busy) return null;
  const ready = pull >= PULL;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ transform: `translateY(${Math.max(pull - 36, 8)}px)`, transition: pull === 0 ? "transform .2s" : undefined }}
    >
      <div className={cn("flex size-9 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-border", ready ? "text-primary" : "text-muted-foreground")}>
        <RefreshCw className={cn("size-4", busy && "animate-spin")} style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }} />
      </div>
    </div>
  );
}
