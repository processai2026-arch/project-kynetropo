import { describe, expect, it } from "vitest";
import { createWheelAxisLock, dominantAxis, touchAxis, GESTURE_GAP_MS } from "@/lib/gestureAxis";

describe("gesture axis lock", () => {
  it("picks the dominant direction, vertical on a tie", () => {
    expect(dominantAxis(10, 2)).toBe("x");
    expect(dominantAxis(-10, 2)).toBe("x");
    expect(dominantAxis(2, 10)).toBe("y");
    expect(dominantAxis(5, 5)).toBe("y");
  });

  it("keeps a vertical touchpad swipe vertical even when it drifts sideways", () => {
    const lock = createWheelAxisLock();
    expect(lock(1, 12, 0)).toBe("y");
    // later events in the same swipe lean sideways: still vertical, so no drift
    expect(lock(9, 3, 16)).toBe("y");
    expect(lock(14, 0, 32)).toBe("y");
  });

  it("keeps a sideways touchpad swipe sideways", () => {
    const lock = createWheelAxisLock();
    expect(lock(-15, 2, 0)).toBe("x");
    expect(lock(-4, 8, 16)).toBe("x");
  });

  it("starts a new gesture after a pause", () => {
    const lock = createWheelAxisLock();
    expect(lock(0, 10, 0)).toBe("y");
    expect(lock(10, 0, GESTURE_GAP_MS + 1)).toBe("x");
  });

  it("waits for a movement before deciding", () => {
    const lock = createWheelAxisLock();
    expect(lock(0, 0, 0)).toBeNull();
    expect(lock(12, 1, 10)).toBe("x");
  });

  it("decides a finger swipe only after it moves past the slop", () => {
    expect(touchAxis(3, 4)).toBeNull();
    expect(touchAxis(20, 5)).toBe("x");
    expect(touchAxis(5, 20)).toBe("y");
  });
});
