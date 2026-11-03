import { useEffect, useRef } from "react";

/* -------------------------------------------------------------------------- */
/*  The swipe from the left edge, back from a chat (backend N378 item 3).      */
/*                                                                            */
/*  In the iPhone app the system's own back swipe is off, so a chat follows    */
/*  the finger here: a touch that starts at the left edge and moves right      */
/*  drags the screen (`onMove`), and on release goes back when it went far     */
/*  enough or fast enough (`onEnd(true)`), else springs back (`onEnd(false)`). */
/*  Safari has its own swipe, so this is for the app only (the caller says).   */
/* -------------------------------------------------------------------------- */

const EDGE_PX = 24;
const DECIDE_PX = 8;

export function useEdgeSwipe(enabled: boolean, onMove: (dx: number) => void, onEnd: (back: boolean) => void): void {
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let start: { x: number; y: number; at: number } | null = null;
    let dragging = false;
    let dx = 0;
    const stop = () => {
      start = null;
      dragging = false;
      dx = 0;
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t || t.clientX > EDGE_PX) return;
      start = { x: t.clientX, y: t.clientY, at: Date.now() };
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      dx = Math.max(0, t.clientX - start.x);
      if (!dragging) {
        // Up or down first: a scroll, not a swipe.
        if (Math.abs(t.clientY - start.y) > DECIDE_PX && Math.abs(t.clientY - start.y) > dx) return stop();
        if (dx < DECIDE_PX) return;
        dragging = true;
      }
      e.preventDefault();
      moveRef.current(dx);
    };
    const onFinish = (e: TouchEvent) => {
      if (dragging && start) {
        const speed = dx / Math.max(1, Date.now() - start.at);
        endRef.current(e.type === "touchend" && (dx > window.innerWidth / 3 || (speed > 0.5 && dx > 30)));
      }
      stop();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onFinish);
    window.addEventListener("touchcancel", onFinish);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onFinish);
      window.removeEventListener("touchcancel", onFinish);
    };
  }, [enabled]);
}
