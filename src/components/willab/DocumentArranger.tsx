"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";
import {
  insertSegment,
  joinSegments,
  moveSegment,
  removeSegment,
  splitSegments,
} from "@/lib/willab/documentSegments";
import { RichText } from "./RichText";
import { IDEAL_EDIT_COPY as C } from "./idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  DocumentArranger — add and move parts of the ideal text (T1 · 1.2)         */
/*                                                                            */
/*  Two interactions, both on the student's OWN words:                        */
/*   - tap a gap between (or after) parts → an inline input → the words are    */
/*     in the document immediately;                                           */
/*   - drag a part by its handle to a new position.                           */
/*                                                                            */
/*  Every action emits the WHOLE joined document through onChange; the host    */
/*  owns persistence (the user-edit PUT) exactly as it owns the textarea's.    */
/*  Nothing here rewrites, improves or generates words: the machine's only     */
/*  route into this text stays the star/tracked-change lanes (L1).            */
/*                                                                            */
/*  Dragging is POINTER-based, not HTML5 drag-and-drop, so it works on touch.  */
/*  The parts do NOT visually reorder mid-drag: a drop line marks the landing  */
/*  slot instead, which keeps the measured rects stable (and the code honest   */
/*  about where the part will actually land). Move up / move down mirror the   */
/*  same operation for keyboard and for anyone who would rather not drag.      */
/* -------------------------------------------------------------------------- */

/** The nearest ancestor that actually scrolls — the arranger renders inside an
 *  overlay's own scroller, not the window, so a drag near the edge has to
 *  nudge THAT element. Falls back to the document scroller. */
function scrollParent(el: HTMLElement | null): HTMLElement {
  let node: HTMLElement | null = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (
      /(auto|scroll|overlay)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : document.documentElement;
}

export default function DocumentArranger({
  text,
  onChange,
  textSizeClass = "text-[17px]",
}: {
  /** The served (or locally edited) document. */
  text: string;
  /** The whole resulting document after an add / move / remove. Fires ONLY
   *  when the text actually changed. */
  onChange: (next: string) => void;
  textSizeClass?: string;
}) {
  const segments = useMemo(() => splitSegments(text), [text]);
  // The gap whose inline input is open, and its draft words.
  const [openGap, setOpenGap] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  // The lifted part and the slot it would land in (0…segments.length).
  const [drag, setDrag] = useState<{ from: number; slot: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  // The live pointer Y, read by the auto-scroll loop without re-rendering.
  const pointerYRef = useRef(0);
  const dragRef = useRef<{ from: number; slot: number } | null>(null);
  dragRef.current = drag;

  const commit = useCallback(
    (next: string[]) => {
      const joined = joinSegments(next);
      // Never emit an empty document (that would overwrite the assembled text
      // with nothing), and never emit an unchanged one (that would mark the
      // document dirty for a no-op drag).
      if (!joined.trim() || joined === text) return;
      onChange(joined);
    },
    [onChange, text]
  );

  /* --- adding ----------------------------------------------------------- */

  const openAdd = useCallback((gap: number) => {
    setOpenGap(gap);
    setDraft("");
  }, []);

  const confirmAdd = useCallback(() => {
    if (openGap === null) return;
    commit(insertSegment(segments, openGap, draft));
    setOpenGap(null);
    setDraft("");
  }, [commit, draft, openGap, segments]);

  useEffect(() => {
    if (openGap !== null) draftRef.current?.focus();
  }, [openGap]);

  // Grow the draft input with its words (same behaviour as the main editor).
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, openGap]);

  /* --- moving ----------------------------------------------------------- */

  /** The slot the pointer is currently over: the first part whose midpoint
   *  sits below the pointer, else past the end. Re-measured each move, so
   *  scrolling during a drag needs no bookkeeping. */
  const slotAt = useCallback((clientY: number): number => {
    const rects = itemRefs.current;
    for (let i = 0; i < segments.length; i++) {
      const r = rects[i]?.getBoundingClientRect();
      if (r && clientY < r.top + r.height / 2) return i;
    }
    return segments.length;
  }, [segments.length]);

  // Auto-scroll while a drag hovers near the top/bottom of the scroller,
  // otherwise a part can only ever move as far as one screenful.
  useEffect(() => {
    if (!drag) return;
    const scroller = scrollParent(rootRef.current);
    let frame = 0;
    const step = () => {
      const y = pointerYRef.current;
      const isWindow =
        scroller === document.documentElement ||
        scroller === document.scrollingElement;
      const top = isWindow ? 0 : scroller.getBoundingClientRect().top;
      const bottom = isWindow
        ? window.innerHeight
        : scroller.getBoundingClientRect().bottom;
      const EDGE = 72;
      if (y > 0 && y - top < EDGE) scroller.scrollTop -= 12;
      else if (y > 0 && bottom - y < EDGE) scroller.scrollTop += 12;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [drag]);

  const startDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, from: number) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerYRef.current = e.clientY;
      setOpenGap(null);
      setDrag({ from, slot: from });
    },
    []
  );

  const moveDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      pointerYRef.current = e.clientY;
      const slot = slotAt(e.clientY);
      setDrag((d) => (d && d.slot !== slot ? { ...d, slot } : d));
    },
    [slotAt]
  );

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    setDrag(null);
    if (!d) return;
    // A landing SLOT is not a destination index: dropping below your own
    // position closes the hole you left behind.
    const to = d.slot > d.from ? d.slot - 1 : d.slot;
    commit(moveSegment(segments, d.from, to));
  }, [commit, segments]);

  /* --- render ------------------------------------------------------------ */

  const gap = (index: number) => {
    const dropping = drag !== null && drag.slot === index;
    if (drag !== null) {
      return (
        <li key={`gap-${index}`} aria-hidden className="py-1">
          <div
            className={`h-0.5 rounded-full transition-colors ${
              dropping ? "bg-primary" : "bg-transparent"
            }`}
          />
        </li>
      );
    }
    if (openGap === index) {
      return (
        <li key={`gap-${index}`} className="flex flex-col gap-2 py-2">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpenGap(null);
                setDraft("");
              }
              // Enter commits; Shift+Enter keeps the line break, because a
              // part can legitimately run to several lines.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                confirmAdd();
              }
            }}
            placeholder={C.addPlaceholder}
            rows={2}
            className={`w-full resize-none overflow-hidden rounded-2xl border border-primary bg-background px-4 py-3 leading-relaxed outline-none ${textSizeClass}`}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmAdd}
              disabled={!draft.trim()}
              className="rounded-full bg-foreground px-4 py-1.5 text-[13px] font-medium text-background transition-opacity disabled:opacity-40"
            >
              {C.addConfirm}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenGap(null);
                setDraft("");
              }}
              className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              {C.addCancel}
            </button>
          </div>
        </li>
      );
    }
    return (
      <li key={`gap-${index}`} className="group/gap py-0.5">
        <button
          type="button"
          onClick={() => openAdd(index)}
          aria-label={C.addHere}
          className="flex w-full items-center gap-2 rounded-full py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border transition-colors group-hover/gap:border-foreground">
            <Plus className="h-3 w-3" aria-hidden />
          </span>
          <span className="h-px flex-1 bg-border transition-colors group-hover/gap:bg-foreground/30" />
        </button>
      </li>
    );
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {gap(0)}
        {segments.map((segment, i) => (
          <Fragment key={`part-${i}`}>
            <li
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`flex items-start gap-2 rounded-2xl border bg-background px-2.5 py-2.5 transition-opacity ${
                drag?.from === i
                  ? "border-primary opacity-50"
                  : "border-border"
              }`}
            >
              <button
                type="button"
                aria-label={C.dragHandle}
                onPointerDown={(e) => startDrag(e, i)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="mt-0.5 flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" aria-hidden />
              </button>
              <div
                className={`min-w-0 flex-1 whitespace-pre-line leading-relaxed text-foreground ${textSizeClass}`}
              >
                <RichText text={segment} />
              </div>
              {/* A ROW, not a column: a stacked trio would force every card
                  as tall as three buttons, which looks like dead space under
                  a one-line part. */}
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={C.moveUp}
                  disabled={i === 0}
                  onClick={() => commit(moveSegment(segments, i, i - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={C.moveDown}
                  disabled={i === segments.length - 1}
                  onClick={() => commit(moveSegment(segments, i, i + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
                {/* The LAST part can't be removed: an emptied document would
                    PUT "" over the assembled text, and the same rule already
                    blocks an emptied draft in the notebook editor. */}
                <button
                  type="button"
                  aria-label={C.removePart}
                  disabled={segments.length <= 1}
                  onClick={() => commit(removeSegment(segments, i))}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
            {gap(i + 1)}
          </Fragment>
        ))}
      </ul>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        {C.persistenceNote}
      </p>
    </div>
  );
}
