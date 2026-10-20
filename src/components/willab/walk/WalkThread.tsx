"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import OverlayCloseButton from "../OverlayCloseButton";

/* -------------------------------------------------------------------------- */
/*  WalkThread — the lens as one chat (founder 2026-10-20, WIL-89; prototype   */
/*  https://claude.ai/artifact/P5fHFguyCgjhMGPsmH7UaD, "build it that way").  */
/*                                                                            */
/*  The walk no longer swaps screens. Every step reached is a part of one     */
/*  thread that grows downwards: the step's bubbles land under the ones       */
/*  before, the speaker's answer as their own orange bubble, and the earlier  */
/*  steps stay above to scroll back to. Only the newest part is live: its     */
/*  footer is the dock under the thread and its ✕ is the bar's. There is no   */
/*  message box.                                                              */
/*                                                                            */
/*  Each step opens with its name as a small line (a mark): "Slide 2",        */
/*  "Slide 2 · helper words", "Other speakers · 1 of 2", "Take 2". The bar    */
/*  shows the mark of the part in view; ‹ › scroll to the mark before or      */
/*  after. After every tap in the dock the thread scrolls to the bottom, so   */
/*  the newest bubble is always in view (founder 2026-10-20: "always after    */
/*  the click scroll to the bottom"), and it keeps following new bubbles      */
/*  until the speaker scrolls up by hand.                                     */
/*                                                                            */
/*  The stage's leaving copy (✕, the walk's end) is a still picture of the    */
/*  thread as it was, at the same scroll: nothing in it fetches, posts or     */
/*  moves.                                                                    */
/* -------------------------------------------------------------------------- */

type Frame = {
  dock: HTMLElement | null;
  close: MutableRefObject<(() => void) | null>;
  ghost: boolean;
};

/** One part of the thread, as the screen inside it sees it. */
export type WalkPartSlot = Frame & {
  /** The newest part: its footer is the dock, its ✕ the bar's. */
  now: boolean;
};

const FrameContext = createContext<Frame | null>(null);
const PartContext = createContext<WalkPartSlot | null>(null);

/** The part a screen is drawn in; null outside the thread (the coach panel,
 *  the sheets), where WalkOverlay is a whole screen as before. */
export function useWalkPart(): WalkPartSlot | null {
  return useContext(PartContext);
}

/** True when the screen was first drawn as an earlier part (a walk opened
 *  further on, the leaving copy): it shows what it holds and fetches,
 *  posts and asks nothing. */
export function useMountedAsPast(): boolean {
  const part = useWalkPart();
  const [past] = useState(() => part !== null && !part.now);
  return past;
}

export function WalkPart({ now, children }: { now: boolean; children: ReactNode }) {
  const frame = useContext(FrameContext);
  if (!frame) return <>{children}</>;
  return <PartContext.Provider value={{ ...frame, now: now && !frame.ghost }}>{children}</PartContext.Provider>;
}

/** A step's name at the top of its part. */
export function WalkThreadMark({ label }: { label: string }) {
  return (
    <p data-walk-mark={label} className="m-0 pt-1 text-center text-[12.5px] text-muted-foreground">
      {label}
    </p>
  );
}

/** The speaker's own answer: their orange bubble on the right. */
export function WalkSpeakerBubble({ children }: { children: ReactNode }) {
  return (
    <div data-walk-said className="flex justify-end">
      <span className="max-w-[88%] rounded-[22px] bg-primary px-[17px] py-[13px] text-[18.5px] leading-[1.45] text-primary-foreground">
        {children}
      </span>
    </div>
  );
}

/** The live thread's root, for the leaving copy's picture. */
export type WalkThreadFrameRef = MutableRefObject<HTMLDivElement | null>;

/** The leaving copy: the thread as the live one last drew it. */
function Still({ frame }: { frame: WalkThreadFrameRef }) {
  // Read while the live thread is still in the page (this render comes
  // before the commit that takes it away).
  const [picture] = useState(() => {
    const el = frame.current;
    const body = el?.querySelector<HTMLElement>("[data-walk-thread-body]");
    return { html: el?.innerHTML ?? "", top: body?.scrollTop ?? 0 };
  });
  const root = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const body = root.current?.querySelector<HTMLElement>("[data-walk-thread-body]");
    if (body) body.scrollTop = picture.top;
  }, [picture]);
  return (
    <div
      ref={root}
      data-walk-thread
      className="walk-ov flex h-full w-full flex-col bg-background pt-[env(safe-area-inset-top)] text-[17px] leading-[1.55] text-foreground"
      dangerouslySetInnerHTML={{ __html: picture.html }}
    />
  );
}

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Within this of the bottom counts as at the bottom. */
const AT_END_PX = 24;

export default function WalkThread({
  ghost = false,
  frame,
  onClose,
  children,
}: {
  /** The stage's leaving copy: a still picture of `frame`. */
  ghost?: boolean;
  /** Where the live thread keeps its root, for the leaving copy. */
  frame: WalkThreadFrameRef;
  /** ✕ when the newest part names none. */
  onClose: () => void;
  children: ReactNode;
}) {
  return ghost ? <Still frame={frame} /> : <LiveThread frame={frame} onClose={onClose}>{children}</LiveThread>;
}

function LiveThread({ frame, onClose, children }: { frame: WalkThreadFrameRef; onClose: () => void; children: ReactNode }) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const close = useRef<(() => void) | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  // Following the newest bubble: from the start, and again after every tap.
  const follow = useRef(true);
  const [bar, setBar] = useState<{ label: string | null; at: number; of: number }>({ label: null, at: -1, of: 0 });

  const marks = () => Array.from(body.current?.querySelectorAll<HTMLElement>("[data-walk-mark]") ?? []);
  const atEnd = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight < AT_END_PX;
  /** The mark of the part in view: the last one above the upper 40% of the
   *  thread; at the bottom, the last one. -1 with none. */
  const inView = useCallback((): number => {
    const el = body.current;
    const all = marks();
    if (!el || all.length === 0) return -1;
    if (atEnd(el)) return all.length - 1;
    const line = el.scrollTop + el.clientHeight * 0.4;
    let k = 0;
    all.forEach((m, i) => {
      if (m.offsetTop <= line) k = i;
    });
    return k;
  }, []);
  const readBar = useCallback(() => {
    const all = marks();
    const k = inView();
    const label = k >= 0 ? (all[k].dataset.walkMark ?? null) : null;
    setBar((was) => (was.label === label && was.at === k && was.of === all.length ? was : { label, at: k, of: all.length }));
  }, [inView]);
  const toEnd = useCallback((smooth: boolean) => {
    const el = body.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced() ? "smooth" : "auto" });
    else el.scrollTop = el.scrollHeight;
  }, []);

  // New bubbles, and bubbles that grow (a clip loading, the AI bubble), are
  // followed to the bottom while the thread follows.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    toEnd(false);
    readBar();
    const changed = () => {
      if (follow.current && !atEnd(el)) toEnd(true);
      readBar();
    };
    const seen = typeof MutationObserver !== "undefined" ? new MutationObserver(changed) : null;
    seen?.observe(el, { childList: true, subtree: true });
    const sized = typeof ResizeObserver !== "undefined" && content.current ? new ResizeObserver(changed) : null;
    if (sized && content.current) sized.observe(content.current);
    return () => {
      seen?.disconnect();
      sized?.disconnect();
    };
  }, [toEnd, readBar]);

  // Each redraw (a step reached, an answer laid in): the bar says the step
  // in view, and the newest bubble is in view while the thread follows.
  useEffect(() => {
    const el = body.current;
    if (el && follow.current && !atEnd(el)) toEnd(true);
    readBar();
  });

  // Every tap in the dock: down to the newest bubble.
  useEffect(() => {
    if (!dock) return;
    const tapped = () => {
      follow.current = true;
      toEnd(true);
      window.requestAnimationFrame?.(() => toEnd(true));
    };
    dock.addEventListener("click", tapped, true);
    return () => dock.removeEventListener("click", tapped, true);
  }, [dock, toEnd]);

  /** ‹ ›: the mark before or after the one in view. */
  const jump = (by: -1 | 1) => {
    const el = body.current;
    const all = marks();
    if (!el || all.length === 0) return;
    const k = inView() + by;
    if (by > 0 && k >= all.length - 1) {
      follow.current = true;
      toEnd(true);
      return;
    }
    follow.current = false;
    const top = Math.max(0, all[Math.max(0, k)].offsetTop - 8);
    if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: reduced() ? "auto" : "smooth" });
    else el.scrollTop = top;
  };

  const label = bar.label ?? undefined;
  return (
    <div
      ref={frame}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-walk-thread
      className="walk-ov flex h-full w-full flex-col bg-background pt-[env(safe-area-inset-top)] text-[17px] leading-[1.55] text-foreground"
    >
      <div className="walk-ovtop flex min-h-[44px] items-center justify-between px-2.5 pt-2">
        <nav data-walk-nav aria-label={label} className="flex min-w-0 items-center gap-0.5 text-[13.5px] font-semibold">
          <button
            type="button"
            onClick={() => jump(-1)}
            disabled={bar.at <= 0}
            aria-label={COPY.pagerBack}
            className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:cursor-default disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="min-w-0 truncate">{label}</span>
          <button
            type="button"
            onClick={() => jump(1)}
            disabled={bar.at < 0 || bar.at >= bar.of - 1}
            aria-label={COPY.pagerNext}
            className="walk-press-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground disabled:cursor-default disabled:opacity-25"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </nav>
        <OverlayCloseButton onClick={() => (close.current ?? onClose)()} className="walk-press-sm mr-2.5" />
      </div>
      <div
        ref={body}
        data-walk-thread-body
        onScroll={() => {
          const el = body.current;
          if (el && atEnd(el)) follow.current = true;
          readBar();
        }}
        onWheel={(e) => {
          if (e.deltaY < 0) follow.current = false;
        }}
        onTouchMove={() => {
          follow.current = false;
        }}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-3.5"
      >
        <div ref={content} className="mt-auto flex flex-col gap-4">
          <FrameContext.Provider value={{ dock, close, ghost: false }}>{children}</FrameContext.Provider>
        </div>
      </div>
      <div ref={setDock} data-walk-dock />
    </div>
  );
}
