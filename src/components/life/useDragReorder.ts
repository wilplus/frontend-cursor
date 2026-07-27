"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  useDragReorder — press, hold, move                                         */
/*                                                                            */
/*  Founder 2026-07-27: the up/down arrows are gone; the order changes by      */
/*  dragging the row, on mobile AND desktop.                                    */
/*                                                                            */
/*  Built on POINTER events, which is what makes one implementation cover      */
/*  both. The HTML5 drag-and-drop API would have been less code and is the     */
/*  obvious reach, but it does not fire for touch at all — it would have meant */
/*  shipping the interaction on desktop and leaving the phone with nothing.    */
/*                                                                            */
/*  Two ways in, one engine:                                                    */
/*    - the GRIP starts the drag on contact (`touch-action: none` on it means  */
/*      the browser never claims that touch for a pan);                        */
/*    - anywhere else on the row starts it after a HOLD, which is the gesture  */
/*      the founder asked for. The hold is what disambiguates it from a scroll */
/*      and from putting a caret in the textarea inside the row.                */
/*                                                                            */
/*  Nothing is reordered mid-drag. The rows are only TRANSFORMED while the     */
/*  finger is down and the real move is committed once, on release — so the    */
/*  indices this is reasoning about cannot shift under it, and a drag that is  */
/*  cancelled (Escape, a phone call, the browser stealing the pointer) leaves  */
/*  the data exactly as it was.                                                */
/* -------------------------------------------------------------------------- */

/** Long enough not to fire while the user is starting a scroll, short enough
 *  that it does not feel broken. Matches the platform long-press feel. */
const HOLD_MS = 220;
/** Movement before the hold fires = this was a scroll or a text selection, not
 *  a drag. Generous enough for a thumb that is never perfectly still. */
const HOLD_SLOP_PX = 8;

/** Where row `index` ends up once the row at `from` is moved to `to`.
 *
 *  Pure, and exported so the off-by-one has somewhere to be caught: this drives
 *  the visible position number during a drag, and the two directions are not
 *  symmetric — moving down pulls the rows between UP by one, moving up pushes
 *  them DOWN by one, and the moved row lands on `to` either way. */
export function projectAfterMove(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (to > from && index > from && index <= to) return index - 1;
  if (to < from && index >= to && index < from) return index + 1;
  return index;
}

interface DragState {
  /** The row under the finger, by its index when the drag began. */
  from: number;
  pointerId: number;
  startY: number;
  y: number;
  /** Row geometry captured at drag start. Rows do not move in the DOM during a
   *  drag, so these stay valid for its whole life. */
  rects: { top: number; height: number }[];
  /** Where it would land if released now. */
  to: number;
}

export interface DragReorderApi {
  /** The row currently under the finger, or null. */
  draggingIndex: number | null;
  /** Where the dragged row would land if released now, or null. */
  targetIndex: number | null;
  /** The position a row would hold if the drag were released now, 0-based.
   *  Outside a drag this is just the row's own index.
   *
   *  Rows carry a visible number here, and nothing is reordered until release,
   *  so without this the numbers keep reading the pre-drag order while the
   *  cards are visibly somewhere else — the screen contradicting itself at the
   *  exact moment the user is deciding whether to let go. */
  projectedIndex: (index: number) => number;
  /** Spread onto each row's outer element. */
  rowProps: (index: number) => {
    ref: (el: HTMLElement | null) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
  };
  /** Spread onto the grip inside a row. */
  handleProps: (index: number) => {
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    style: React.CSSProperties;
  };
}

export function useDragReorder(
  count: number,
  onMove: (from: number, to: number) => void
): DragReorderApi {
  const rowsRef = useRef<(HTMLElement | null)[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  // The pending hold: a row was pressed but has not yet become a drag.
  const holdRef = useRef<{
    index: number;
    pointerId: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const cancelHold = useCallback(() => {
    if (!holdRef.current) return;
    clearTimeout(holdRef.current.timer);
    holdRef.current = null;
  }, []);

  /** Distance a displaced row travels: exactly the dragged row's outer height.
   *  Exact for any row heights — pulling one row out of the list and putting it
   *  back somewhere else shifts everything strictly between it and its
   *  destination by that one row's height plus the gap, and nothing else. */
  const outerHeight = (rects: DragState["rects"], from: number): number => {
    const gap =
      rects.length > 1
        ? Math.max(0, rects[1].top - (rects[0].top + rects[0].height))
        : 0;
    return rects[from].height + gap;
  };

  const begin = useCallback(
    (index: number, pointerId: number, clientY: number) => {
      const rects = rowsRef.current.slice(0, count).map((el) => {
        const r = el?.getBoundingClientRect();
        return { top: r?.top ?? 0, height: r?.height ?? 0 };
      });
      if (rects.some((r) => r.height === 0)) return; // not laid out — bail
      setDrag({ from: index, pointerId, startY: clientY, y: clientY, rects, to: index });
      // A held row on a phone otherwise gets the OS text-selection callout.
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(8);
        } catch {
          /* not fatal, and unsupported on desktop */
        }
      }
    },
    [count]
  );

  /* --- the live drag: window listeners, so leaving the row does not drop it - */
  useEffect(() => {
    if (!drag) return;

    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dy = e.clientY - d.startY;
      const center = d.rects[d.from].top + d.rects[d.from].height / 2 + dy;
      // Land past a neighbour once the dragged row's centre has crossed that
      // neighbour's centre — the position everyone reads as "past it".
      let to = d.from;
      if (dy < 0) {
        for (let j = d.from - 1; j >= 0; j--) {
          if (center < d.rects[j].top + d.rects[j].height / 2) to = j;
          else break;
        }
      } else {
        for (let j = d.from + 1; j < d.rects.length; j++) {
          if (center > d.rects[j].top + d.rects[j].height / 2) to = j;
          else break;
        }
      }
      setDrag({ ...d, y: e.clientY, to });
    };

    const finish = (commit: boolean) => (e?: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (e && e.pointerId !== d.pointerId) return;
      if (commit && d.to !== d.from) onMove(d.from, d.to);
      setDrag(null);
    };
    const up = finish(true);
    const cancel = finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false)();
    };

    // Non-passive, and this is the whole reason a hold can work on touch: the
    // browser has not started panning yet (the hold cancels on movement), and
    // this is what stops it from starting now that the finger is moving.
    const blockScroll = (e: TouchEvent) => e.preventDefault();

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onKey);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("touchmove", blockScroll);
      document.body.style.userSelect = prevSelect;
    };
  }, [drag, onMove]);

  useEffect(() => () => cancelHold(), [cancelHold]);

  /* ------------------------------- row props ------------------------------- */

  const rowProps = (index: number) => {
    let style: React.CSSProperties = {};
    if (drag) {
      if (index === drag.from) {
        style = {
          transform: `translateY(${drag.y - drag.startY}px)`,
          zIndex: 30,
          position: "relative",
          transition: "none",
          // Reads as picked up, without changing the row's footprint.
          filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.14))",
          touchAction: "none",
        };
      } else {
        const shift = outerHeight(drag.rects, drag.from);
        const dy =
          drag.to > drag.from && index > drag.from && index <= drag.to
            ? -shift
            : drag.to < drag.from && index >= drag.to && index < drag.from
              ? shift
              : 0;
        style = {
          transform: `translateY(${dy}px)`,
          transition: "transform 160ms cubic-bezier(0.2, 0, 0, 1)",
        };
      }
    }

    return {
      ref: (el: HTMLElement | null) => {
        rowsRef.current[index] = el;
      },
      style,
      onPointerDown: (e: React.PointerEvent) => {
        if (drag) return;
        if (e.button !== undefined && e.button !== 0) return; // left / touch only
        // The row holds a textarea and a grip. Pressing either is that
        // control's business: a hold on the textarea is how you select text,
        // and the grip has its own, immediate, path in.
        const el = e.target as HTMLElement | null;
        if (el?.closest("textarea, input, select, button, a, [data-drag-handle]")) {
          return;
        }
        const { pointerId, clientX, clientY } = e;
        cancelHold();
        holdRef.current = {
          index,
          pointerId,
          x: clientX,
          y: clientY,
          timer: setTimeout(() => {
            holdRef.current = null;
            begin(index, pointerId, clientY);
          }, HOLD_MS),
        };

        const watch = (ev: PointerEvent) => {
          const h = holdRef.current;
          if (!h || ev.pointerId !== h.pointerId) return;
          if (
            Math.abs(ev.clientX - h.x) > HOLD_SLOP_PX ||
            Math.abs(ev.clientY - h.y) > HOLD_SLOP_PX
          ) {
            cancelHold();
            detach();
          }
        };
        const release = () => {
          cancelHold();
          detach();
        };
        const detach = () => {
          window.removeEventListener("pointermove", watch);
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
        };
        window.addEventListener("pointermove", watch);
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
      },
    };
  };

  const handleProps = (index: number) => ({
    // The browser must not claim this touch for a pan, or the grip would need
    // a hold too and there would be no immediate way in on a phone.
    style: { touchAction: "none" as const },
    onPointerDown: (e: React.PointerEvent) => {
      if (drag) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); // no focus-steal, no text selection from the grip
      begin(index, e.pointerId, e.clientY);
    },
    // The arrows were also the only way to reorder from a keyboard. They are
    // gone from the screen, not from the product: the grip is a real button, so
    // it takes focus, and Up/Down move the row it belongs to. Focus rides along
    // because the button moves with its row.
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        onMove(index, index - 1);
      } else if (e.key === "ArrowDown" && index < count - 1) {
        e.preventDefault();
        onMove(index, index + 1);
      }
    },
  });

  const projectedIndex = (index: number): number =>
    drag ? projectAfterMove(index, drag.from, drag.to) : index;

  return {
    draggingIndex: drag?.from ?? null,
    targetIndex: drag?.to ?? null,
    projectedIndex,
    rowProps,
    handleProps,
  };
}
