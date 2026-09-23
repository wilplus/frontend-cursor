"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { availableWaitingTips } from "./processingWaitingTips";
import {
  clampPlace,
  openingPlace,
  placeFromScroll,
  rememberPlace,
} from "./waitingTipsDeck";
import { WAITING_TIPS } from "./waitingTips";
import { VoiceMark } from "./LoadingState";
import { IDLE_WHEEL_GESTURE, wheelGestureStep } from "@/lib/willab/deckScroll";
import type { WheelGestureState } from "@/lib/willab/deckScroll";

/* -------------------------------------------------------------------------- */
/*  RecordingAnalysisPresentation — post-recording analysis, and only that.   */
/*                                                                            */
/*  This is the single richer waiting state: real pipeline stage, real          */
/*  percentage, orange progress rail, and the advice. Generic route/auth/data   */
/*  waits use LoadingState and therefore cannot inherit this analysis-only      */
/*  information architecture by accident.                                      */
/*                                                                            */
/*  THE ADVICE NO LONGER MOVES ON ITS OWN (founder 2026-09-23: "we want them   */
/*  to be static with a scroll, the same scroll like you have on the ideal     */
/*  text, so that you can scroll as you wait, from one advice to another"),    */
/*  BUT EACH WAIT OPENS SOMEWHERE NEW ("it should start randomly with          */
/*  different advices, but then you can scroll through it"). Static is about   */
/*  what happens while someone reads; the opening advice is about not showing  */
/*  the same one to the same person on every take for the rest of time.        */
/*                                                                            */
/*  It used to cross-fade one tip to the next on a timer. Reading is not on a  */
/*  timer: a tip could leave mid-sentence, and there was no way back to one    */
/*  that had gone. `waitingTips.ts` had said so from the start — "a stable,    */
/*  scrollable collection: nothing moves while the person is reading" — so     */
/*  this restores the behaviour the collection was written for.               */
/*                                                                            */
/*  ONE GESTURE, ONE TIP, by the Ideal Text deck's own rule and its own code   */
/*  (`wheelGestureStep`). A trackpad flick emits a decaying tail for up to a   */
/*  second and a half; left to the browser, mandatory snap flies through       */
/*  several tips the reader never saw. Reusing the deck's state machine is     */
/*  what makes "the same scroll" true rather than merely similar, and means    */
/*  there is one place to fix if the feel is ever wrong again.                 */
/* -------------------------------------------------------------------------- */

export interface RecordingAnalysisPresentationProps {
  /** Truthful lifecycle label supplied by the recording-analysis pipeline. */
  readonly label: string;
  /** Real percentage, or null while the pipeline exposes no measurable value. */
  readonly percent: number | null;
  /** Stable epoch keeps the tip cycle continuous across overlay remounts. */
  readonly cycleStartedAt?: number | null;
}

export default function RecordingAnalysisPresentation({
  label,
  percent: measuredPercent,
  cycleStartedAt = null,
}: RecordingAnalysisPresentationProps) {
  const waitingTips = useMemo(() => availableWaitingTips(WAITING_TIPS), []);
  const localCycleRef = useRef<number | null>(null);
  if (localCycleRef.current === null) localCycleRef.current = Date.now();
  const cycleEpoch =
    typeof cycleStartedAt === "number" && Number.isFinite(cycleStartedAt)
      ? cycleStartedAt
      : localCycleRef.current;

  /* A scroll this screen performs is motion like any other, and `scrollTo`
     with an explicit behavior ignores the CSS preference — so it has to be
     asked here. Read at call time rather than captured: the setting can change
     under a long wait, and a wait is exactly long enough for that to happen. */
  const motionReduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const moveBehavior = (): ScrollBehavior =>
    motionReduced() ? ("instant" as ScrollBehavior) : "smooth";

  /* `scrollTo` IS NOT EVERYWHERE, and this screen is the live loop. A throw
     inside the ref callback below would take the whole waiting screen with it,
     leaving someone mid-recording staring at nothing — so the movement falls
     back to `scrollTop`, which every engine has had for decades and which
     lands in exactly the same place, just without the easing.
     (Found by the test suite: jsdom has no `scrollTo`, and until the opening
     advice became random the call never fired, because the place was always
     zero. A guard that only matters once a value stops being zero is the kind
     that is missing until the day it is needed.) */
  const scrollTo = (node: HTMLDivElement, top: number, behavior: ScrollBehavior) => {
    if (typeof node.scrollTo === "function") {
      node.scrollTo({ top, behavior });
      return;
    }
    node.scrollTop = top;
  };

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<WheelGestureState>(IDLE_WHEEL_GESTURE);
  /* ZERO ON THE FIRST RENDER, ALWAYS. Where this wait opens is decided below,
     in the ref callback, and deliberately not here: the opening advice is
     random, and a random value chosen while rendering would have the server
     draw one advice and the client another. The correction lands in the same
     commit, before the browser paints, so nothing is seen to move. */
  const [place, setPlace] = useState(0);

  /* WHERE THE WAIT OPENS, AND WHERE IT RESUMES — one path, because they are
     the same question asked twice. A job that has not been seen rolls a
     starting advice and remembers it; a job that has been seen gets back
     exactly where its reader was, which is what makes a phase handover
     invisible. `instant` either way: this is placement, not movement, and
     animating into position would look like the screen moving by itself —
     the behaviour this change exists to remove. */
  const placedFor = useRef<number | null>(null);
  const attachScroller = useCallback(
    (node: HTMLDivElement | null) => {
      scrollerRef.current = node;
      if (!node || placedFor.current === cycleEpoch) return;
      placedFor.current = cycleEpoch;
      const at = openingPlace(cycleEpoch, waitingTips.length);
      setPlace(at);
      if (at > 0) {
        scrollTo(node, at * node.clientHeight, "instant" as ScrollBehavior);
      }
    },
    [cycleEpoch, waitingTips.length],
  );

  const goTo = useCallback(
    (next: number) => {
      const node = scrollerRef.current;
      const at = clampPlace(next, waitingTips.length);
      setPlace(at);
      rememberPlace(cycleEpoch, at);
      if (node) scrollTo(node, at * node.clientHeight, moveBehavior());
    },
    [cycleEpoch, waitingTips.length],
  );

  /* THE DECK'S RULE, NOT THE BROWSER'S. See the header: a trackpad's momentum
     tail would otherwise carry several tips past the reader in one flick. */
  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (waitingTips.length < 2) return;
      const step = wheelGestureStep(gestureRef.current, {
        deltaY: event.deltaY,
        now: Date.now(),
        innerCanScroll: false,
      });
      gestureRef.current = step.state;
      event.preventDefault();
      if (step.action === "advance-screen") {
        goTo(place + (event.deltaY > 0 ? 1 : -1));
      }
    },
    [goTo, place, waitingTips.length],
  );

  /* Touch and the keyboard scroll the container natively — mandatory snap
     already lands them one tip at a time, and taking that over would only
     break momentum people expect from a phone. This just records where they
     ended up, so the dots agree and the place survives the next remount. */
  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      const at = placeFromScroll(node.scrollTop, node.clientHeight, waitingTips.length);
      if (at === place) return;
      setPlace(at);
      rememberPlace(cycleEpoch, at);
    },
    [cycleEpoch, place, waitingTips.length],
  );

  const percent =
    typeof measuredPercent === "number" && Number.isFinite(measuredPercent)
      ? Math.max(0, Math.min(100, measuredPercent))
      : null;

  return (
    <div className="flex w-full max-w-[34rem] flex-1 flex-col justify-center pb-[12vh] text-left">
      <div className="mb-10 flex justify-center">
        <VoiceMark size={64} />
      </div>

      <div className="mb-14 w-full">
        <div className="mb-4 flex items-center justify-between gap-4 text-[0.95rem] font-medium text-foreground">
          <span>{label}</span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {percent === null ? "…" : `${percent}%`}
          </span>
        </div>
        <div
          className="h-[3px] overflow-hidden bg-border"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-valuetext={
            percent === null ? `${label}, in progress` : `${percent}%`
          }
          aria-busy={percent === null ? true : undefined}
        >
          <div
            className="h-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: percent === null ? "0%" : `${percent}%` }}
          />
        </div>
      </div>

      {/* NO aria-live. It belonged to a screen whose text changed on its own
          with nobody asking; announcing a tip the reader deliberately scrolled
          to would talk over them. The region is labelled and reachable
          instead, so a screen reader walks it like any other text. */}
      <div>
        <p
          id="while-you-wait"
          className="mb-6 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
        >
          While you wait
        </p>

        <div
          ref={attachScroller}
          onWheel={onWheel}
          onScroll={onScroll}
          tabIndex={0}
          role="group"
          aria-labelledby="while-you-wait"
          className="h-[clamp(9rem,26vh,13rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {waitingTips.map((entry, at) => (
            <p
              key={entry}
              aria-posinset={at + 1}
              aria-setsize={waitingTips.length}
              className="flex min-h-full snap-start items-start text-balance text-[clamp(1.45rem,5.2vw,2.05rem)] font-medium leading-[1.28] tracking-[-0.015em] text-foreground"
            >
              {entry}
            </p>
          ))}
        </div>

        {/* The affordance the rotation used to be. A tip that never moves and
            carries no mark of the others reads as the only one there is. */}
        {waitingTips.length > 1 ? (
          <div className="mt-6 flex gap-1.5" aria-hidden>
            {waitingTips.map((entry, at) => (
              <span
                key={entry}
                className={`h-[3px] flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                  at === place ? "bg-foreground" : "bg-border"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
