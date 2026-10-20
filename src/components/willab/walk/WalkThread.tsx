"use client";

import {
  Children,
  createContext,
  isValidElement,
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
import { TypingGlyph } from "../TypingDots";
import WalkFooter from "./WalkFooter";

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
/*  after.                                                                    */
/*                                                                            */
/*  The newest step comes to the top (founder 2026-10-20: "the bubbles in the */
/*  lenses should not disappear but be brought to the top"; prototype         */
/*  https://claude.ai/artifact/MpiAtrUz4DNBKm3EvhA6fm): its name moves to the */
/*  top of the thread and its bubbles land under it, the steps before it      */
/*  above, to scroll back to. A room under the thread lets the name reach the */
/*  top; a step taller than the thread follows down to its newest bubble.    */
/*  After every tap in the dock the thread goes back to the newest step, and  */
/*  it keeps following until the speaker scrolls up by hand. Scrolled back   */
/*  to an answered step, the dock reads Next, which brings the newest step    */
/*  back; the recorder never gives way.                                       */
/*                                                                            */
/*  A new opening while the lens stays open (Next from a step played again   */
/*  to the step that waits) keeps what the thread showed above it, as a still */
/*  picture: nothing leaves the thread while the lens is open.                */
/*                                                                            */
/*  A step's bubbles land one after another (WalkLanding): the typing dots    */
/*  before each grey bubble, as in the Lounge, the speaker's own bubble       */
/*  without them; its buttons come once they have all landed (founder         */
/*  2026-10-20: "add the typing dots").                                       */
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

/** How long the typing dots show before a grey bubble lands (the approved
 *  prototype's beat), how long before the speaker's own bubble lands. */
export const WALK_TYPING_MS = 520;
const WALK_OWN_MS = 200;

/** Bubbles land one by one only where the page can tell motion is welcome:
 *  a browser that answers the reduce-motion question with no. */
const landingWelcome = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The typing dots, as a grey bubble of the walk's size. */
function WalkTyping() {
  return (
    <div data-walk-typing aria-hidden="true" className="flex">
      <span className="rounded-[22px] bg-muted px-[17px] py-[19px]">
        <TypingGlyph />
      </span>
    </div>
  );
}

/** What a landing item is: a grey bubble (the dots first), one that brings
 *  its own dots (the AI bubble), the speaker's own or anything else (a short
 *  beat), or nothing drawn (no wait). */
function landingKind(el: HTMLElement | null | undefined): "app" | "self" | "own" | "none" {
  if (!el || el.childNodes.length === 0) return "none";
  if (el.querySelector("[data-walk-ai-voice], [data-walk-ai-typing]")) return "self";
  if (el.querySelector("[data-walk-message]")) return "app";
  return "own";
}

/** A part's bubbles, landing one after another: each grey one after the
 *  typing dots, the speaker's own after a short beat. On while the part is
 *  the newest and was first drawn as the newest, with motion welcome; what
 *  the part adds later (another speaker's next moment, a reason written
 *  late) lands the same way. Off, or once the part is no longer the newest,
 *  everything shows at once. `onSettled`: false while something waits to
 *  land, so the dock waits with it. */
export function WalkLanding({
  on,
  onSettled,
  children,
}: {
  on: boolean;
  onSettled: (settled: boolean) => void;
  children: ReactNode;
}) {
  const kids = Children.toArray(children);
  const keys = kids.map((k, i) => (isValidElement(k) && k.key != null ? String(k.key) : `#${i}`));
  const [active] = useState(() => on && landingWelcome());
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(() => (active ? new Set(keys) : new Set()));
  const [typing, setTyping] = useState<string | null>(null);
  const known = useRef(new Set(keys));
  const boxes = useRef(new Map<string, HTMLDivElement | null>());
  const timer = useRef<number | null>(null);
  const live = active && on;

  // What the part adds later lands too, while it lands at all.
  const keyList = keys.join("\u0000");
  useLayoutEffect(() => {
    const fresh = keys.filter((k) => !known.current.has(k));
    fresh.forEach((k) => known.current.add(k));
    if (live && fresh.length > 0) setWaiting((w) => new Set([...w, ...fresh]));
    // keys is read through keyList
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyList, live]);

  // One at a time, in order.
  useEffect(() => {
    if (!live || timer.current !== null) return;
    const next = keys.find((k) => waiting.has(k));
    if (next === undefined) return;
    const kind = landingKind(boxes.current.get(next));
    if (kind === "app") setTyping(next);
    const wait = kind === "app" ? WALK_TYPING_MS : kind === "own" ? WALK_OWN_MS : 0;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setTyping(null);
      setWaiting((w) => {
        const left = new Set(w);
        left.delete(next);
        return left;
      });
    }, wait);
    // keys is read through keyList
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, keyList, waiting]);
  useEffect(
    () => () => {
      // Cleared and forgotten, so a part drawn again starts its landing again.
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  const settled = !live || !keys.some((k) => waiting.has(k));
  useEffect(() => onSettled(settled), [settled, onSettled]);

  if (!active) return <>{children}</>;
  return (
    <>
      {kids.map((kid, i) => {
        const key = keys[i];
        const hidden = live && waiting.has(key);
        return (
          <div key={key} className="contents">
            {live && typing === key ? <WalkTyping /> : null}
            <div
              ref={(el) => {
                boxes.current.set(key, el);
              }}
              data-walk-land
              hidden={hidden}
              className="walk-bubble-in"
            >
              {kid}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Within this of the bottom counts as at the bottom. */
const AT_END_PX = 24;
/** Room above a step's name brought to the top. */
const MARK_GAP_PX = 8;

/** Where `node` sits in the scrolling `el`, in its scroll coordinates. */
const topIn = (el: HTMLElement, node: HTMLElement) =>
  node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;

/** The thread as it was, kept above a new opening: a still picture, with
 *  nothing in it that waits, lands or answers to a test id. */
function pictureOf(el: HTMLElement | null): string {
  if (!el) return "";
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("[data-walk-typing], [data-walk-loading]").forEach((n) => n.remove());
  copy.querySelectorAll("[hidden]").forEach((n) => n.removeAttribute("hidden"));
  for (const name of ["data-testid", "data-walk-start", "data-walk-part"]) {
    copy.querySelectorAll(`[${name}]`).forEach((n) => n.removeAttribute(name));
  }
  return copy.innerHTML;
}

export default function WalkThread({
  ghost = false,
  frame,
  opening = null,
  onClose,
  children,
}: {
  /** The stage's leaving copy: a still picture of `frame`. */
  ghost?: boolean;
  /** Where the live thread keeps its root, for the leaving copy. */
  frame: WalkThreadFrameRef;
  /** Which opening of the walk the thread shows (the request's seq): a new
   *  one while the lens stays open keeps the thread above it. */
  opening?: number | null;
  /** ✕ when the newest part names none. */
  onClose: () => void;
  children: ReactNode;
}) {
  return ghost ? (
    <Still frame={frame} />
  ) : (
    <LiveThread frame={frame} opening={opening} onClose={onClose}>
      {children}
    </LiveThread>
  );
}

function LiveThread({
  frame,
  opening,
  onClose,
  children,
}: {
  frame: WalkThreadFrameRef;
  opening: number | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const close = useRef<(() => void) | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const room = useRef<HTMLDivElement | null>(null);
  // Following the newest step: from the start, and again after every tap.
  const follow = useRef(true);
  const [following, setFollowing] = useState(true);
  const setFollow = useCallback((on: boolean) => {
    follow.current = on;
    setFollowing(on);
  }, []);
  const [bar, setBar] = useState<{ label: string | null; at: number; of: number }>({ label: null, at: -1, of: 0 });
  // What the dock holds: any buttons, and whether they are the recorder.
  const [docked, setDocked] = useState({ any: false, recording: false });

  // A new opening while the lens stays open: what the thread showed stays
  // above it. Read during render, while the page still holds it.
  const [kept, setKept] = useState<{ opening: number | null; html: string }>(() => ({ opening, html: "" }));
  if (kept.opening !== opening) setKept({ opening, html: pictureOf(content.current) });

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
      if (topIn(el, m) <= line) k = i;
    });
    return k;
  }, []);
  const readBar = useCallback(() => {
    const all = marks();
    const k = inView();
    const label = k >= 0 ? (all[k].dataset.walkMark ?? null) : null;
    setBar((was) => (was.label === label && was.at === k && was.of === all.length ? was : { label, at: k, of: all.length }));
  }, [inView]);
  /** Sizes the room under the thread so the newest step's name can reach
   *  the top. False when the step is taller than the thread (no room). */
  const sizeRoom = useCallback((): boolean => {
    const el = body.current;
    const under = room.current;
    if (!el || !under) return false;
    const all = marks();
    const last = all[all.length - 1];
    const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    const step = last ? topIn(el, under) - topIn(el, last) + MARK_GAP_PX + pad : Infinity;
    const fits = step <= el.clientHeight;
    const height = `${fits ? Math.floor(el.clientHeight - step) : 0}px`;
    if (under.style.height !== height) under.style.height = height;
    return fits;
  }, []);
  /** The newest step in view: its name at the top while it fits under it,
   *  else down to its newest bubble. */
  const toNewest = useCallback(
    (smooth: boolean) => {
      const el = body.current;
      if (!el) return;
      const fits = sizeRoom();
      const all = marks();
      const last = all[all.length - 1];
      const bottom = el.scrollHeight - el.clientHeight;
      const top = last && fits ? Math.max(0, Math.min(bottom, topIn(el, last) - MARK_GAP_PX)) : bottom;
      if (Math.abs(el.scrollTop - top) < 2) return;
      if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: smooth && !reduced() ? "smooth" : "auto" });
      else el.scrollTop = top;
    },
    [sizeRoom],
  );

  // New bubbles, and bubbles that grow (a clip loading, the AI bubble), are
  // followed while the thread follows; the room under it is kept in size.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    // The whole finished walk opens at its paragraph's part, and follows
    // nothing (founder 2026-10-20); every other opening on the newest step.
    const start = el.querySelector<HTMLElement>("[data-walk-start] > *");
    if (start) {
      setFollow(false);
      sizeRoom();
      el.scrollTop = Math.max(0, topIn(el, start) - MARK_GAP_PX);
    } else toNewest(false);
    readBar();
    const changed = () => {
      if (follow.current) toNewest(true);
      else sizeRoom();
      readBar();
    };
    const seen = typeof MutationObserver !== "undefined" ? new MutationObserver(changed) : null;
    seen?.observe(el, { childList: true, subtree: true });
    const sized = typeof ResizeObserver !== "undefined" ? new ResizeObserver(changed) : null;
    if (sized && content.current) sized.observe(content.current);
    sized?.observe(el);
    return () => {
      seen?.disconnect();
      sized?.disconnect();
    };
  }, [toNewest, sizeRoom, readBar, setFollow]);

  // Each redraw (a step reached, an answer laid in): the bar says the step
  // in view, and the newest step is in view while the thread follows.
  useEffect(() => {
    if (follow.current) toNewest(true);
    else sizeRoom();
    readBar();
  });

  // Every tap in the dock: back to the newest step.
  useEffect(() => {
    if (!dock) return;
    const tapped = () => {
      setFollow(true);
      toNewest(true);
      window.requestAnimationFrame?.(() => toNewest(true));
    };
    dock.addEventListener("click", tapped, true);
    return () => dock.removeEventListener("click", tapped, true);
  }, [dock, toNewest, setFollow]);

  // What the dock holds, for the Next that stands in for it.
  useEffect(() => {
    if (!dock) return;
    const read = () => {
      const any = dock.childElementCount > 0;
      const recording = dock.querySelector("[data-walk-recording-strip]") !== null;
      setDocked((was) => (was.any === any && was.recording === recording ? was : { any, recording }));
    };
    read();
    const seen = typeof MutationObserver !== "undefined" ? new MutationObserver(read) : null;
    seen?.observe(dock, { childList: true, subtree: true });
    return () => seen?.disconnect();
  }, [dock]);

  /** ‹ ›: the mark before or after the one in view. */
  const jump = (by: -1 | 1) => {
    const el = body.current;
    const all = marks();
    if (!el || all.length === 0) return;
    const k = inView() + by;
    if (by > 0 && k >= all.length - 1) {
      setFollow(true);
      toNewest(true);
      return;
    }
    setFollow(false);
    const top = Math.max(0, topIn(el, all[Math.max(0, k)]) - MARK_GAP_PX);
    if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: reduced() ? "auto" : "smooth" });
    else el.scrollTop = top;
  };

  // Scrolled back to an answered step, the dock reads Next: back to the
  // newest step (founder 2026-10-20). The recorder stays where it is.
  const back = !following && docked.any && !docked.recording && bar.at >= 0 && bar.at < bar.of - 1;

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
      {/* No scrollbar (founder 2026-10-20): the thread scrolls by wheel,
          trackpad or finger. */}
      <div
        ref={body}
        data-walk-thread-body
        onScroll={() => {
          const el = body.current;
          if (el && atEnd(el) && !follow.current) setFollow(true);
          readBar();
        }}
        onWheel={(e) => {
          if (e.deltaY < 0) setFollow(false);
        }}
        onTouchMove={() => {
          setFollow(false);
        }}
        className="scrollbar-none relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-3.5"
      >
        <div ref={content} className="flex flex-col gap-4">
          {kept.html ? (
            <div
              data-walk-kept
              aria-hidden="true"
              className="pointer-events-none flex flex-col gap-4"
              dangerouslySetInnerHTML={{ __html: kept.html }}
            />
          ) : null}
          <FrameContext.Provider value={{ dock, close, ghost: false }}>{children}</FrameContext.Provider>
        </div>
        <div ref={room} data-walk-room aria-hidden="true" className="shrink-0" />
      </div>
      <div ref={setDock} data-walk-dock hidden={back} />
      {back ? (
        <div data-walk-dock-next>
          <WalkFooter
            pill={{
              label: COPY.pagerNext,
              onClick: () => {
                setFollow(true);
                toNewest(true);
              },
              testId: "walk-to-newest",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
