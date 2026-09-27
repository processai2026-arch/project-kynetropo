/**
 * Locks a scroll gesture to the direction it starts in, so a slightly
 * diagonal swipe down a wide table does not also slide it sideways.
 * Used by ScrollableX for touchpad/mouse-wheel and finger swipes.
 */
export type Axis = "x" | "y";

/** Wheel events further apart than this start a new gesture. */
export const GESTURE_GAP_MS = 180;
/** A finger must move this far before its direction is decided. */
export const TOUCH_SLOP_PX = 8;

/** The dominant direction of a movement; ties go to vertical (page scroll). */
export function dominantAxis(dx: number, dy: number): Axis {
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/**
 * Wheel events arrive as a stream with no start/end, so a gesture is a run of
 * events closer together than GESTURE_GAP_MS. Its axis is decided by the first
 * event that moves at all, and kept until the run ends.
 */
export function createWheelAxisLock(gapMs = GESTURE_GAP_MS) {
  let axis: Axis | null = null;
  let last = -Infinity;
  return (dx: number, dy: number, now: number): Axis | null => {
    if (now - last > gapMs) axis = null;
    last = now;
    if (axis === null && (dx !== 0 || dy !== 0)) axis = dominantAxis(dx, dy);
    return axis;
  };
}

/**
 * A finger's direction is decided once it has moved TOUCH_SLOP_PX from where
 * it started; until then it is undecided (null).
 */
export function touchAxis(dx: number, dy: number, slop = TOUCH_SLOP_PX): Axis | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return dominantAxis(dx, dy);
}
