"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { feedbackWalkOn } from "@/lib/willab/feedbackWalkSwitch";
import { WALK_LEAVE_MS, type WalkDir, type WalkMove, type WalkScreen } from "@/lib/willab/walkMotion";
import { useWalkMotion } from "./useWalkMotion";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";

/* -------------------------------------------------------------------------- */
/*  WalkSheetFrame — a sheet the host mounts and unmounts, in the walk's look  */
/*  and motion (build plan D-IT-6; founder 2026-10-07, Q-B3 A, N63; walk lock  */
/*  "UI and UX" and "How screens move").                                       */
/*                                                                            */
/*  The paragraph's own screens ("This paragraph", "Helper words saved") and  */
/*  the helper-words overlay are opened by the deck, which mounts one sheet   */
/*  at a time: a new paragraph, or the next screen of the same paragraph, is  */
/*  a new component. So, unlike WalkStage (one stage for the whole walk),     */
/*  each frame carries its own stage, and the screens hand over through a     */
/*  copy of the DOM, exactly as the prototype's ghost() does:                 */
/*                                                                            */
/*    open    a frame mounts with nothing handed over: the overlay rises      */
/*            (0.38 s);                                                       */
/*    next    a frame mounts in the same commit another one left (‹ ›, Next,  */
/*            Edit), or its own screen changes: the top bar stays still, the  */
/*            old content slips 22 px away (0.14 s), the new slides in (0.3 s */
/*            after 0.1 s); back mirrors it, by the moment's place;           */
/*    close   a frame leaves and nothing takes its place: its copy sinks      */
/*            (0.28 s) with the page already underneath.                      */
/*                                                                            */
/*  Which move is useWalkMotion's (walkMotion.ts); how it is drawn is         */
/*  globals.css's "feedback walk motion". With the phone's reduce-motion      */
/*  setting nothing moves and no copy is drawn at all.                        */
/*                                                                            */
/*  Only the container: the content is the caller's, word for word.           */
/* -------------------------------------------------------------------------- */

const REDUCE = "(prefers-reduced-motion: reduce)";

/** The phone's reduce-motion setting. */
export function reducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia?.(REDUCE).matches === true;
  } catch {
    return false;
  }
}

/** A frame that left, for a frame mounting in the same commit to take. */
type Handoff = { screen: WalkScreen; copy: HTMLElement; sink: HTMLElement | null; at: number };
let handoff: Handoff | null = null;

/** How long a leaving frame waits for one to take its place: the same
 *  commit, give or take a frame. */
const HANDOFF_MS = 120;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Take it: it slides away instead of sinking. */
function takeHandoff(): Handoff | null {
  const taken = handoff && now() - handoff.at <= HANDOFF_MS ? handoff : null;
  handoff = null;
  taken?.sink?.remove();
  return taken;
}

/** Tests: forget a frame that left. */
export function forgetWalkHandoff(): void {
  handoff = null;
}

/** A still copy of the overlay for its out-move: no ids, no test ids, no
 *  media that could play (the prototype's ghost()). */
function stillCopy(node: Element | null | undefined): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  const copy = node.cloneNode(true) as HTMLElement;
  for (const el of [copy, ...Array.from(copy.querySelectorAll<HTMLElement>("*"))]) {
    el.removeAttribute("id");
    el.removeAttribute("data-testid");
    el.removeAttribute("autoplay");
  }
  return copy;
}

function leaveClass(move: WalkMove): string {
  return move === "close" ? "walk-layer walk-ghost walk-m-close" : `walk-layer walk-ghost walk-m-swap walk-m-${move}`;
}

function arriveClass(move: WalkMove): string {
  return move === "open" || move === "next" || move === "back" || move === "fade" ? `walk-m-${move}` : "";
}

/** The copy that sinks when the frame closes, over everything, for its
 *  0.28 s; it takes no pointer and no reader. */
function sinkOf(copy: HTMLElement): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const stage = document.createElement("div");
  stage.className = "walk-stage pointer-events-none fixed inset-0 z-50 overflow-hidden";
  stage.setAttribute("aria-hidden", "true");
  stage.setAttribute("data-walk-sink", "");
  const layer = document.createElement("div");
  layer.className = leaveClass("close");
  layer.setAttribute("data-walk-ghost", "");
  layer.appendChild(copy);
  stage.appendChild(layer);
  document.body.appendChild(stage);
  window.setTimeout(() => stage.remove(), WALK_LEAVE_MS);
  return stage;
}

/** Back when the moment sits before the one that left; forward otherwise. */
function dirBetween(from: WalkScreen, to: WalkScreen): WalkDir | undefined {
  if (typeof from.moment === "number" && typeof to.moment === "number" && to.moment < from.moment) return "back";
  return undefined;
}

const PAGE: WalkScreen = { key: "page", overlay: false };

export default function WalkSheetFrame({
  screen,
  title,
  nav = null,
  caption = null,
  note = null,
  footer = null,
  onClose,
  testId,
  children,
}: {
  /** Which screen this is, and the moment it is about (the walk's place),
   *  for the motion only. */
  screen: { key: string; moment?: number | null };
  title: string;
  nav?: WalkNav | null;
  /** The bar's text alone when there is nowhere to walk ("Slide 2"). */
  caption?: string | null;
  /** A grey line at the top of the content (the Take 1 note). */
  note?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  testId?: string;
  children: ReactNode;
}) {
  const current: WalkScreen = { key: screen.key, moment: screen.moment ?? null };
  const [reduce] = useState(reducedMotion);
  // Mounting takes three commits, all before the first paint: the frame
  // waits (nothing drawn); it stands where the motion starts (the screen a
  // frame just left in the same commit, or the page); then the motion runs
  // from there to this screen. The screen that left is only known in the
  // commit that removes it, after this frame's first render.
  const [start, setStart] = useState<WalkScreen | null>(null);
  const [arrived, setArrived] = useState(false);
  const shown = arrived ? current : start ?? PAGE;
  const last = useRef<WalkScreen>(PAGE);
  const dir: WalkDir | undefined = reduce ? "none" : dirBetween(last.current, shown);
  const { id, move, leaving } = useWalkMotion(shown, reduce || !arrived ? "none" : dir);

  const layer = useRef<HTMLDivElement | null>(null);
  const ghost = useRef<HTMLDivElement | null>(null);
  const handed = useRef<HTMLElement | null>(null);
  const lastCopy = useRef<HTMLElement | null>(null);
  const live = useRef<WalkScreen>(current);
  live.current = current;

  // Taken once, even where effects run twice (React's strict mode).
  const took = useRef<WalkScreen | null>(null);
  useLayoutEffect(() => {
    if (start === null) {
      if (took.current === null) {
        const taken = takeHandoff();
        if (taken) handed.current = taken.copy;
        took.current = taken?.screen ?? PAGE;
      }
      setStart(took.current);
    } else if (!arrived) {
      setArrived(true);
    }
  }, [start, arrived]);

  // Every commit: fill a new leaving copy, then keep a copy of this screen
  // for the next move.
  const filled = useRef<number | null>(null);
  useLayoutEffect(() => {
    last.current = shown;
    if (leaving && filled.current !== leaving.id && ghost.current) {
      filled.current = leaving.id;
      const copy = handed.current ?? lastCopy.current;
      handed.current = null;
      if (copy) ghost.current.replaceChildren(copy);
    }
    lastCopy.current = stillCopy(layer.current?.firstElementChild);
  });

  // Leaving (a layout cleanup, so it runs before the next frame mounts in
  // the same commit): hand the copy over; it sinks unless taken at once.
  useLayoutEffect(
    () => () => {
      const copy = lastCopy.current;
      if (!copy) return;
      handoff = { screen: live.current, copy, sink: reducedMotion() ? null : sinkOf(copy), at: now() };
    },
    [],
  );

  return (
    <div data-walk-stage className="walk-stage pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {arrived ? (
        <div
          key={`layer-${id}`}
          ref={layer}
          data-walk-move={move}
          className={cn("walk-layer", arriveClass(move))}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        >
          <WalkOverlay nav={nav} caption={caption} onClose={onClose} title={title} footer={footer} testId={testId}>
            {note ? <p className="text-[14.5px] leading-snug text-muted-foreground">{note}</p> : null}
            {children}
          </WalkOverlay>
        </div>
      ) : null}
      {leaving && !reduce ? (
        <div
          key={`ghost-${leaving.id}`}
          ref={ghost}
          aria-hidden="true"
          data-walk-ghost
          className={leaveClass(leaving.move)}
        />
      ) : null}
    </div>
  );
}

/** Is a sheet drawn in the walk's look? Only while the Feedback walk's one
 *  switch is on (feedbackWalkOn; Q-B3 A: "when the walk goes live"), read
 *  once when the sheet opens; `explicit` decides instead when given. With
 *  the switch off every sheet keeps today's look. */
export function useWalkLook(explicit?: boolean): boolean {
  const [on] = useState(feedbackWalkOn);
  return explicit ?? on;
}

/** The walk's ‹ Slide n › bar from the deck's pager: the same text the
 *  sheets' own bar shows (the slide, else "moment N of M"), Back off on the
 *  first. */
export function walkNavOfPager(
  pager: {
    index: number;
    total: number;
    label?: string | null;
    onBack: () => void;
    onNext: () => void;
  } | null,
  slideLabel: string | null,
): WalkNav | null {
  if (!pager) return null;
  return {
    label: pager.label ?? null,
    position: pager.label ?? slideLabel ?? undefined,
    index: pager.index,
    total: pager.total,
    onBack: pager.onBack,
    onNext: pager.onNext,
    backDisabled: pager.index === 0,
  };
}

/** The walk's footer box around a sheet's own buttons (WalkFooter's). */
export function WalkSheetFooter({ children }: { children: ReactNode }) {
  return (
    <div data-walk-footer className="flex flex-col gap-1 px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-2">
      {children}
    </div>
  );
}
