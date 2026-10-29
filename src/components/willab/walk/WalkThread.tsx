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
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import OverlayCloseButton from "../OverlayCloseButton";
import { CHUNK_DELAY_MS, TypingGlyph } from "../TypingDots";
import WalkFooter from "./WalkFooter";

/* -------------------------------------------------------------------------- */
/*  WalkThread — the lens as one chat (founder 2026-10-20, WIL-89; prototype   */
/*  https://claude.ai/artifact/P5fHFguyCgjhMGPsmH7UaD, "build it that way").  */
/*                                                                            */
/*  The walk no longer swaps screens. Every step reached is a part of one     */
/*  thread that grows downwards: the step's bubbles land under the ones       */
/*  before, the speaker's answer as their own orange bubble, and the earlier  */
/*  steps stay above to scroll back to. The part the walk stands on has the   */
/*  dock: its footer is the buttons under the thread and its ✕ is the bar's.  */
/*  There is no message box.                                                  */
/*                                                                            */
/*  A walk already answered, opened on one of its steps (a Lounge bubble,     */
/*  the orange words, a paragraph; founder 2026-10-21, the prototype's "this  */
/*  step is brought to the top"): the whole walk is in the thread, that step  */
/*  at the top with its own buttons, the parts before and after it there to   */
/*  scroll. Next moves on to the next part; at the end, onto the page.        */
/*                                                                            */
/*  Each step opens with its name as a small line (a mark): "Slide 2",        */
/*  "Slide 2 · helper words", "Other speakers · 1 of 2", "Take 2". The bar    */
/*  shows the mark of the part in view; ‹ › scroll to the mark before or      */
/*  after.                                                                    */
/*                                                                            */
/*  New bubbles land at the bottom (founder 2026-10-23, N122: "the 3 dots     */
/*  loading should be at the bottom"): each new bubble, and the typing dots   */
/*  before it, land right above the buttons, as in the Lounge, and the thread */
/*  follows them down. After every tap in the dock the thread goes back to    */
/*  the newest bubble, and it keeps following until the speaker scrolls up by */
/*  hand. Scrolled back to an answered step, the dock reads Next, which       */
/*  brings the newest step back; the recorder never gives way. (From 20 to   */
/*  23 October the newest step came to the top, its name at the top of the   */
/*  thread, with a room under the thread to let it get there.) A door into a  */
/*  step already answered still brings that step's name to the top (N91).    */
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
/*                                                                            */
/*  A walk opened again once done is a scroll (founder 2026-10-29, N259: "on */
/*  the reopened walk there is only a scroll there should be no buttons!"):  */
/*  with `buttons` off there is no dock and no Next; the bar stays.          */
/* -------------------------------------------------------------------------- */

type Frame = {
  dock: HTMLElement | null;
  close: MutableRefObject<(() => void) | null>;
  ghost: boolean;
};

/** One part of the thread, as the screen inside it sees it. */
export type WalkPartSlot = Frame & {
  /** The part the walk stands on: its footer is the dock, its ✕ the bar's. */
  now: boolean;
  /** The newest part, last in the thread. First drawn as the one the walk
   *  stands on, its bubbles land one by one; a part already given shows at
   *  once. */
  fresh: boolean;
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

export function WalkPart({ now, fresh = now, children }: { now: boolean; fresh?: boolean; children: ReactNode }) {
  const frame = useContext(FrameContext);
  if (!frame) return <>{children}</>;
  return (
    <PartContext.Provider value={{ ...frame, now: now && !frame.ghost, fresh: fresh && !frame.ghost }}>
      {children}
    </PartContext.Provider>
  );
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
export function WalkSpeakerBubble({ children, edited = false }: { children: ReactNode; edited?: boolean }) {
  return (
    <div data-walk-said className="flex justify-end">
      <span className="max-w-[88%] rounded-[22px] bg-primary px-[17px] py-[13px] text-[18.5px] leading-[1.45] text-primary-foreground">
        {children}
        {edited ? (
          <span data-walk-edited className="ml-2.5 whitespace-nowrap text-[13px] text-primary-foreground/80">
            {WALK_COPY.edited}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** "Edited" at the end of a grey bubble whose words changed after they were
 *  said, small and grey, as WhatsApp marks an edited message (founder
 *  2026-10-26, N192, B13). */
export function WalkEdited() {
  return (
    <span data-walk-edited className="self-end text-[13px] text-muted-foreground">
      {WALK_COPY.edited}
    </span>
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

/** How long the typing dots show before a grey bubble lands: the Lounge's
 *  beat (founder 2026-10-20, "there is a lag between the steps": 350 ms in
 *  place of the prototype's 520), how long before the speaker's own bubble
 *  lands. */
export const WALK_TYPING_MS = CHUNK_DELAY_MS;
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
  for (const name of ["data-testid", "data-walk-now", "data-walk-part"]) {
    copy.querySelectorAll(`[${name}]`).forEach((n) => n.removeAttribute(name));
  }
  return copy.innerHTML;
}

export default function WalkThread({
  ghost = false,
  frame,
  opening = null,
  current = null,
  buttons = true,
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
  /** The step the walk stands on (its part is marked `data-walk-now`): each
   *  change brings that part to the top. */
  current?: number | null;
  /** False: a scroll, with no dock and no Next (N259, a walk opened again
   *  once done). */
  buttons?: boolean;
  /** ✕ when the standing part names none. */
  onClose: () => void;
  children: ReactNode;
}) {
  return ghost ? (
    <Still frame={frame} />
  ) : (
    <LiveThread frame={frame} opening={opening} current={current} buttons={buttons} onClose={onClose}>
      {children}
    </LiveThread>
  );
}

function LiveThread({
  frame,
  opening,
  current,
  buttons,
  onClose,
  children,
}: {
  frame: WalkThreadFrameRef;
  opening: number | null;
  current: number | null;
  buttons: boolean;
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
  // Where the thread stood at the last scroll, to tell up from down.
  const lastTop = useRef(0);
  const [following, setFollowing] = useState(true);
  const setFollow = useCallback((on: boolean) => {
    follow.current = on;
    setFollowing(on);
  }, []);
  // The bar: the mark in view, how many there are, and whether the thread
  // is scrolled away from the standing part.
  const [bar, setBar] = useState<{ label: string | null; at: number; of: number; away: boolean }>({
    label: null,
    at: -1,
    of: 0,
    away: false,
  });
  // What the dock holds: any buttons, and whether they are the recorder.
  const [docked, setDocked] = useState({ any: false, recording: false });

  // A new opening while the lens stays open: what the thread showed stays
  // above it. Read during render, while the page still holds it.
  const [kept, setKept] = useState<{ opening: number | null; html: string }>(() => ({ opening, html: "" }));
  if (kept.opening !== opening) setKept({ opening, html: pictureOf(content.current) });

  const marks = () => Array.from(body.current?.querySelectorAll<HTMLElement>("[data-walk-mark]") ?? []);
  const atEnd = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight < AT_END_PX;
  /** The part the walk stands on, as the thread marks it. */
  const nowEl = () => body.current?.querySelector<HTMLElement>("[data-walk-now]") ?? null;
  /** What of the standing part comes to the top: its name, else its first
   *  bubble; null when the thread marks no standing part. */
  const nowTarget = (): HTMLElement | null => {
    const el = nowEl();
    if (!el) return null;
    return el.querySelector<HTMLElement>("[data-walk-mark]") ?? (el.firstElementChild as HTMLElement | null);
  };
  /** True when the standing part is the thread's last: the walk follows its
   *  newest bubbles. False with parts after it (a walk opened on a step
   *  already answered): the thread follows nothing. */
  const standsLast = () => {
    const el = nowEl();
    return !el || el.nextElementSibling === null;
  };
  /** Scrolled away from the standing part (B9): none of it, from its name
   *  to its last bubble, is in view. False when the thread marks no
   *  standing part, or before the part has a size. (Until 2026-10-27 the
   *  thread read "away" as the bar's mark differing from the standing
   *  part's; the bar names the last mark above the upper 40% of the thread,
   *  or the last mark at the bottom, so a standing part shorter than that,
   *  or a thread that fits in view, counted as scrolled away the moment it
   *  opened, and the dock gave way to a Next that scrolled nowhere.) */
  const awayFromNow = useCallback((): boolean => {
    const el = body.current;
    const part = nowEl();
    const first = part?.firstElementChild as HTMLElement | null;
    const last = part?.lastElementChild as HTMLElement | null;
    if (!el || !first || !last) return false;
    const top = topIn(el, first);
    const bottom = topIn(el, last) + last.offsetHeight;
    if (bottom <= top) return false;
    return bottom <= el.scrollTop || top >= el.scrollTop + el.clientHeight;
  }, []);
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
    const away = awayFromNow();
    const label = k >= 0 ? (all[k].dataset.walkMark ?? null) : null;
    setBar((was) =>
      was.label === label && was.at === k && was.of === all.length && was.away === away ? was : { label, at: k, of: all.length, away },
    );
  }, [inView, awayFromNow]);
  /** Sizes the room under the thread so the standing step's name can reach
   *  the top, on a door into a step already answered (N91). A live walk
   *  has none: its newest bubbles sit right above the buttons (N122).
   *  False when the step is taller than the thread (no room). */
  const sizeRoom = useCallback((): boolean => {
    const el = body.current;
    const under = room.current;
    if (!el || !under) return false;
    if (standsLast()) {
      if (under.style.height !== "0px") under.style.height = "0px";
      return false;
    }
    const all = marks();
    const target = nowTarget() ?? all[all.length - 1] ?? null;
    const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    const step = target ? topIn(el, under) - topIn(el, target) + MARK_GAP_PX + pad : Infinity;
    const fits = step <= el.clientHeight;
    const height = `${fits ? Math.floor(el.clientHeight - step) : 0}px`;
    if (under.style.height !== height) under.style.height = height;
    return fits;
  }, []);
  /** The standing step in view: on a live walk its newest bubble, at the
   *  bottom (N122); with parts after it, its name at the top (founder
   *  2026-10-21). */
  const toCurrent = useCallback(
    (smooth: boolean) => {
      const el = body.current;
      if (!el) return;
      sizeRoom();
      const all = marks();
      const target = nowTarget() ?? all[all.length - 1] ?? null;
      const bottom = el.scrollHeight - el.clientHeight;
      const top = target && !standsLast() ? Math.max(0, Math.min(bottom, topIn(el, target) - MARK_GAP_PX)) : bottom;
      if (Math.abs(el.scrollTop - top) < 2) return;
      if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: smooth && !reduced() ? "smooth" : "auto" });
      else el.scrollTop = top;
    },
    [sizeRoom],
  );

  // As the walk opens and each time it moves on: the newest bubble in view
  // at the bottom (N122). With parts after it the thread follows nothing
  // and the standing step's name comes to the top (founder 2026-10-21).
  useEffect(() => {
    if (!body.current) return;
    setFollow(standsLast());
    toCurrent(false);
    readBar();
  }, [current, toCurrent, readBar, setFollow]);

  // New bubbles, and bubbles that grow (a clip loading, the AI bubble), are
  // followed while the thread follows; the room under it is kept in size.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const changed = () => {
      if (follow.current) toCurrent(true);
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
  }, [toCurrent, sizeRoom, readBar]);

  // Each redraw (a step reached, an answer laid in): the bar says the step
  // in view, and the standing step is in view while the thread follows.
  useEffect(() => {
    if (follow.current) toCurrent(true);
    else sizeRoom();
    readBar();
  });

  // Every tap in the dock: back to the standing step.
  useEffect(() => {
    if (!dock) return;
    const tapped = () => {
      setFollow(standsLast());
      toCurrent(true);
      window.requestAnimationFrame?.(() => toCurrent(true));
    };
    dock.addEventListener("click", tapped, true);
    return () => dock.removeEventListener("click", tapped, true);
  }, [dock, toCurrent, setFollow]);

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
    const k = Math.max(0, Math.min(all.length - 1, inView() + by));
    if (by > 0 && k >= all.length - 1 && standsLast()) {
      setFollow(true);
      toCurrent(true);
      return;
    }
    setFollow(false);
    const top = Math.max(0, topIn(el, all[k]) - MARK_GAP_PX);
    if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: reduced() ? "auto" : "smooth" });
    else el.scrollTop = top;
  };

  // Scrolled away from the step with the buttons, the dock reads Next:
  // back to that step (founder 2026-10-20). The recorder stays where it is.
  // A scroll has neither (N259).
  const back = buttons && !following && docked.any && !docked.recording && bar.away;

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
          if (!el) return;
          // Back to following only on the way down: a scroll up starts
          // within reach of the end too, and following again there pulled
          // the thread back down under the speaker's finger (2026-10-29).
          const down = el.scrollTop > lastTop.current;
          lastTop.current = el.scrollTop;
          if (down && atEnd(el) && !follow.current && standsLast()) setFollow(true);
          readBar();
        }}
        onWheel={(e) => {
          if (e.deltaY < 0 || !standsLast()) setFollow(false);
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
      <div ref={setDock} data-walk-dock hidden={back || !buttons} />
      {back ? (
        <div data-walk-dock-next>
          <WalkFooter
            pill={{
              label: COPY.pagerNext,
              onClick: () => {
                setFollow(standsLast());
                toCurrent(true);
              },
              testId: "walk-to-newest",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
