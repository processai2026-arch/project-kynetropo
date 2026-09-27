import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { createWheelAxisLock, touchAxis as decideTouchAxis, type Axis } from "@/lib/gestureAxis";

interface ScrollableXProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a wide table and renders a floating scrollbar via a portal, fixed at
 * the bottom of the viewport, shown only while the table is wider than its
 * container and on screen.
 *
 * The wrapper clips its own horizontal overflow (overflow-x: hidden still
 * allows setting scrollLeft from code), so it draws no second scrollbar and
 * the browser never slides it sideways by itself. Sideways movement comes
 * from the floating bar, or from a gesture over the table that is locked to
 * one direction when it starts: a mostly-vertical touchpad/wheel/finger swipe
 * only scrolls the page, a mostly-horizontal one only moves the table. A
 * slightly diagonal swipe down therefore no longer drifts the table sideways.
 */

export function ScrollableX({ children, className }: ScrollableXProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const mirrorRef  = useRef<HTMLDivElement>(null);
  const syncing    = useRef(false);

  const [bar, setBar] = useState<{
    visible: boolean;
    left: number;
    width: number;
    scrollWidth: number;
  }>({ visible: false, left: 0, width: 0, scrollWidth: 0 });

  const refresh = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh   = window.innerHeight;
    const hasH = el.scrollWidth > el.clientWidth + 2;
    setBar({
      visible:     hasH && rect.top < vh - 10 && rect.bottom > 10,
      left:        rect.left,
      width:       rect.width,
      scrollWidth: el.scrollWidth,
    });
  }, []);

  // Sync content → mirror
  const onContentScroll = useCallback(() => {
    if (!syncing.current && mirrorRef.current && contentRef.current) {
      syncing.current = true;
      mirrorRef.current.scrollLeft = contentRef.current.scrollLeft;
      syncing.current = false;
    }
    refresh();
  }, [refresh]);

  // Sync mirror → content
  const onMirrorScroll = useCallback(() => {
    if (!syncing.current && mirrorRef.current && contentRef.current) {
      syncing.current = true;
      contentRef.current.scrollLeft = mirrorRef.current.scrollLeft;
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    const el   = contentRef.current;
    const main = document.querySelector("main");
    if (!el) return;

    el.addEventListener("scroll", onContentScroll, { passive: true });
    main?.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);

    const ro = new ResizeObserver(refresh);
    ro.observe(el);

    const canScrollX = () => el.scrollWidth > el.clientWidth + 2;

    // Touchpad / mouse wheel: lock each gesture to the axis it starts on.
    const wheelAxis = createWheelAxisLock();
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      if (wheelAxis(e.deltaX, e.deltaY, e.timeStamp) !== "x" || !canScrollX()) return; // the page scrolls; the table cannot drift
      e.preventDefault(); // keep a sideways swipe from also scrolling the page or going Back
      el.scrollLeft += e.deltaX;
    };

    // Touch screens: the same rule for a finger swipe.
    let touchAxis: Axis | null = null;
    let startX = 0, startY = 0, startLeft = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { touchAxis = "y"; return; }
      touchAxis = null;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startLeft = el.scrollLeft;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchAxis === "y" || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (touchAxis === null) {
        const decided = decideTouchAxis(dx, dy);
        if (decided === null) return;
        touchAxis = decided === "x" && canScrollX() ? "x" : "y";
        if (touchAxis === "y") return;
      }
      e.preventDefault();
      el.scrollLeft = startLeft - dx;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    refresh();

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("scroll", onContentScroll);
      main?.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      ro.disconnect();
    };
  }, [onContentScroll, refresh]);

  return (
    <>
      <div ref={contentRef} className={cn("overflow-x-hidden", className)}>
        {children}
      </div>

      {bar.visible && createPortal(
        <div
          style={{
            position:     "fixed",
            bottom:       6,
            left:         bar.left,
            width:        bar.width,
            height:       16,
            zIndex:       9999,
            background:   "rgba(255,255,255,0.92)",
            borderRadius: 8,
            border:       "1px solid rgba(0,0,0,0.12)",
            boxShadow:    "0 1px 4px rgba(0,0,0,0.10)",
            padding:      "2px 0",
          }}
        >
          <div
            ref={mirrorRef}
            onScroll={onMirrorScroll}
            className="eco-float-scroll"
            style={{
              overflowX:      "auto",
              overflowY:      "hidden",
              height:         "100%",
              borderRadius:   8,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(0,0,0,0.35) transparent",
            } as React.CSSProperties}
          >
            <div style={{ width: bar.scrollWidth, height: 1 }} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
