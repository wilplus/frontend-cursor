"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startPaceMic, type PaceMic } from "@/lib/willab/pace/paceMic";
import {
  ONE_THING_TEMPO_TRIES,
  TEMPO_COPY as W,
  TEMPO_MAX_TRIES,
  TEMPO_PATH_EVERY_MS,
  afterTry,
  closeOf,
  landed,
  oneThingTempoLines,
  readTry,
  tempoOpening,
  type TempoEvent,
  type TempoPlayed,
  type TempoStretch,
} from "@/lib/willab/tempoStep";
import PaceScale from "../pace/PaceScale";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import { ONE_THING_COPY } from "../idealEditCopy";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkFooter from "./WalkFooter";
import WalkPlayer from "./WalkPlayer";
import RecordingBar from "../RecordingBar";
import { WalkSpeakerBubble, useMountedAsPast, useWalkPart } from "./WalkThread";

/* -------------------------------------------------------------------------- */
/*  WalkTempo — the tempo step of the walk (backend N162, N166; the walk's    */
/*  page §2 "Tempo"; prototype https://claude.ai/artifact/VJd5MeFGgZy7e3Q8M1EQXV). */
/*                                                                            */
/*  The speaker's stretch with the rushed or dragged part marked; three of   */
/*  Will's bubbles (what the stretch was, the task with its topic, the quiet */
/*  spot); under them the scale, asleep, with I'm ready and Skip. I'm ready   */
/*  wakes the scale and the recording bar; nothing else lands until Stop.    */
/*  The bar is the app's one recording bar (backend N314): the trash, then   */
/*  the strip with Stop inside it, Skip under it. The trash throws the try   */
/*  away: no try counted or kept, back to before it was started.            */
/*  Each try: the dot's path as the speaker's bubble, then Will's word on it */
/*  (N245). A try that lands ends the game with Next; one that came closer   */
/*  gets a push, and Practise again; Will decides, not the speaker. After    */
/*  the third, the closing line comes by itself; Next goes on with the walk. */
/*                                                                            */
/*  Listen only: the scale reads the microphone in this tab, nothing is      */
/*  recorded or sent. Every word is signed (TEMPO_COPY, backend N179).       */
/*                                                                            */
/*  Once the walk moves on, the game stays in the thread as it was played    */
/*  (B5): the tries, their comments and the closing line, or the speaker's   */
/*  Skip; the scale shows only while the walk stands on the step.            */
/*                                                                            */
/*  As the One thing walk's fix, the Sniper on this week's level (founder    */
/*  2026-10-31, N309 item 1; `one`): "Try it" with Skip in I'm ready's place, */
/*  two tries, and the walk's own words on each ("Yes. That's it.", "Close.  */
/*  Once more.", "Good try. Take it with you."), no closing line of its own; */
/*  Skip moves the walk on at once, after a try too. Its line and the scale  */
/*  share one bubble that stays in its first place, right after the stretch, */
/*  while the walk stands on the step, the dot asleep between tries; each    */
/*  try and each of Will's lines land under it, one at a time (the locked    */
/*  prototype X4gDmGfHH7ivuoRZ9ufiy9's scale() and record(); B7, N440).      */
/*                                                                            */
/*  ✕, or the step going away, mid-game with a try made: the game ends for  */
/*  Will's note as left, with nothing said (T build step 4).                 */
/* -------------------------------------------------------------------------- */

/** A try left running stops itself after a minute, as a practise's upload does. */
const TRY_LIMIT_MS = 60_000;

type Phase = "idle" | "starting" | "listening" | "blocked" | "commented" | "closed" | "skipped";

export default function WalkTempo({
  testId,
  stretch,
  onDone,
  onClose,
  onEvent,
  one = false,
  mark = W.mark,
}: {
  testId?: string;
  stretch: TempoStretch;
  onDone: () => void;
  onClose: () => void;
  /** What happened, for the chat and for Will (N166 step 4). */
  onEvent?: (event: TempoEvent) => void;
  /** The One thing walk's fix (N309): its dock, two tries and its words. */
  one?: boolean;
  /** The bar's name for the step: its slide as the One thing walk's fix
   *  (backend N435 item 7), else "Tempo". */
  mark?: string;
}) {
  const opening = tempoOpening(stretch, one);
  const most = one ? ONE_THING_TEMPO_TRIES : TEMPO_MAX_TRIES;
  const linesFor = (t: TempoPlayed, n: number) => (one ? oneThingTempoLines(t.landed, n) : afterTry(t.result, t.landed, n));
  const past = useMountedAsPast();
  const part = useWalkPart();
  const [phase, setPhase] = useState<Phase>("idle");
  const [tries, setTries] = useState<TempoPlayed[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const activity = useRef<number | null>(null);
  const mic = useRef<PaceMic | null>(null);
  const timers = useRef<number[]>([]);
  const path = useRef<number[]>([]);
  const tell = useRef(onEvent);
  tell.current = onEvent;
  const ended = useRef(false);
  const played = useRef(tries);
  played.current = tries;
  // Each start of the microphone; a halt or the trash moves it on, so a
  // microphone that opens after the try was given up is closed again.
  const run = useRef(0);
  useEffect(() => {
    if (past) return;
    // Told once what opens its part was told, the parent's own effect after
    // this one: the chat says "And here's one moment to try another way:" first (N309).
    let on = true;
    queueMicrotask(() => {
      if (on) tell.current?.({ kind: "opened" });
    });
    return () => {
      on = false;
    };
  }, [past]);
  // The game ends once: a landed try, the closing line, a Skip, or left.
  const end = useCallback((tried: TempoPlayed[], skipped = false, left = false) => {
    if (ended.current) return;
    ended.current = true;
    tell.current?.({ kind: "ended", tries: tried, close: tried.length ? closeOf(tried.map((t) => t.result)) : null, skipped, ...(left ? { left } : {}) });
  }, []);
  // ✕, or the step going away, mid-game with a try made: kept for Will as
  // left, nothing said in the walk or the chat (T build step 4).
  const leave = useCallback(() => {
    if (!past && played.current.length > 0) end(played.current, true, true);
  }, [past, end]);
  useEffect(() => leave, [leave]);

  const halt = useCallback(() => {
    run.current += 1;
    mic.current?.stop();
    mic.current = null;
    timers.current.forEach((id) => window.clearInterval(id));
    timers.current = [];
  }, []);
  useEffect(() => halt, [halt]);

  const begin = useCallback(async () => {
    const mine = ++run.current;
    setPhase("starting");
    activity.current = null;
    path.current = [];
    const opened = await startPaceMic((read) => {
      activity.current = read.activity;
    });
    if (mine !== run.current) {
      opened?.stop();
      return;
    }
    if (!opened) {
      setPhase("blocked");
      return;
    }
    mic.current = opened;
    const started = performance.now();
    setElapsed(0);
    timers.current.push(
      window.setInterval(() => path.current.push(activity.current ?? 0), TEMPO_PATH_EVERY_MS),
      window.setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 250),
    );
    setPhase("listening");
  }, []);

  const stop = useCallback(() => {
    halt();
    const taken = path.current.slice();
    const result = readTry(taken);
    const hit = landed(taken);
    const next = [...tries, { result, path: taken, landed: hit }];
    setTries(next);
    tell.current?.({ kind: "try", n: next.length, result, path: taken, landed: hit });
    if (hit || next.length >= most) {
      setPhase("closed");
      end(next);
    } else setPhase("commented");
  }, [halt, tries, end, most]);

  useEffect(() => {
    if (phase !== "listening") return;
    const id = window.setTimeout(stop, TRY_LIMIT_MS);
    return () => window.clearTimeout(id);
  }, [phase, stop]);

  // The trash: the try is thrown away, nothing counted or told; the step is
  // back where it was before it started (I'm ready, Try it or Practise again).
  const trash = useCallback(() => {
    halt();
    setPhase(tries.length > 0 ? "commented" : "idle");
  }, [halt, tries]);

  // Skip: as the One thing walk's fix, the walk moves on at once, after a
  // try too, as the prototype's skip() does; otherwise a try made leaves
  // the game closed on Next.
  const skip = useCallback(() => {
    halt();
    end(tries, true);
    if (tries.length > 0 && !one) setPhase("closed");
    else {
      setPhase("skipped");
      onDone();
    }
  }, [halt, tries, end, onDone, one]);

  const nav: WalkNav = {
    position: mark,
    index: 0,
    total: 1,
    onBack: noop,
    onNext: onDone,
    backDisabled: true,
    nextDisabled: true,
  };

  const live = phase === "listening" || phase === "starting";
  const aTryLanded = tries.some((t) => t.landed);
  const standing = part === null || part.now;
  // As the One thing walk's fix the scale stays while the walk stands on the
  // step, in the bubble it opened in (the prototype's scale()).
  const scaleShown = standing && !past && (one || phase === "idle" || phase === "blocked" || live);
  const leadLine = opening.withScale ? <span data-walk-tempo-lead>{opening.withScale}</span> : null;
  const scale = scaleShown ? (
    <WalkMessage wide>
      {leadLine}
      <PaceScale
        activity={() => activity.current}
        asleep={!live}
        label={W.scale}
        className="h-[clamp(120px,30vw,200px)]"
      />
      {/* Its three zones named, left to right (N405). */}
      <span data-walk-scale-ends className="mt-1 flex justify-between gap-2 text-[13px] leading-snug text-muted-foreground">
        {W.ends.map((end) => (
          <span key={end}>{end}</span>
        ))}
      </span>
    </WalkMessage>
  ) : null;
  const lead = leadLine ? <WalkMessage>{leadLine}</WalkMessage> : null;

  return (
    <WalkOverlay
      testId={testId}
      nav={nav}
      onClose={() => {
        halt();
        leave();
        onClose();
      }}
      footer={past ? null : footerFor()}
    >
      {stretch.planLevel ? (
        <WalkMessage>
          <span data-walk-level>{PLAN_COPY.levelHere(stretch.planLevel)}</span>
        </WalkMessage>
      ) : null}
      <TempoStretchBubble stretch={stretch} />
      {opening.lines.map((line) => (
        <WalkMessage key={line}>
          <span>{line}</span>
        </WalkMessage>
      ))}
      {/* One place for the line: with the scale while it stands (the One
          thing walk's), alone once past; the legacy step's scale lands under
          its tries instead. */}
      {one ? (scale ?? lead) : scaleShown ? null : lead}
      {/* Each try and each of Will's lines its own bubble, landing one at a
          time (B7, N440). */}
      {tries.flatMap((t, i) => [
        <TempoTryBubble key={`try-${i}`} label={W.tryLabel(i + 1)} path={t.path} />,
        ...linesFor(t, i + 1).map((said) => (
          <WalkMessage key={`try-${i}:${said}`}>
            <span>{said}</span>
          </WalkMessage>
        )),
      ])}
      {one ? null : scale}
      {phase === "blocked" ? (
        <WalkMessage>
          <span>{W.blocked}</span>
        </WalkMessage>
      ) : null}
      {phase === "closed" && !aTryLanded && !one ? (
        <WalkMessage>
          <span>{W.close[closeOf(tries.map((t) => t.result))]}</span>
        </WalkMessage>
      ) : null}
      {/* The One thing walk's Skip adds no bubble of the speaker's (N435 item 2). */}
      {phase === "skipped" && !one ? <WalkSpeakerBubble>{W.skip}</WalkSpeakerBubble> : null}
      {/* The Sniper as the One thing walk's fix answers Skip (N405): the
          thread draws the answer at the top of what comes next, so it lands
          there (N440). */}
    </WalkOverlay>
  );

  function footerFor() {
    if (live && one) {
      // The bar alone: its trash is the Skip (backend N435 item 3).
      return (
        <WalkFooter>
          <RecordingBar elapsedMs={elapsed * 1000} onTrash={skip} onStop={phase === "listening" ? stop : undefined} />
        </WalkFooter>
      );
    }
    // Recording: the bar alone, its trash the way out (founder 2026-11-03).
    if (live) {
      return (
        <WalkFooter>
          <RecordingBar elapsedMs={elapsed * 1000} onTrash={trash} onStop={phase === "listening" ? stop : undefined} />
        </WalkFooter>
      );
    }
    if (phase === "closed") return <WalkFooter pill={{ label: W.next, onClick: onDone, testId: "walk-forward" }} />;
    if (phase === "commented" && !one) {
      return <WalkFooter dot outline pill={{ label: W.again, onClick: () => void begin(), testId: "walk-practise" }} />;
    }
    return (
      <WalkFooter
        dot
        pill={{ label: one ? ONE_THING_COPY.tryIt : W.ready, onClick: () => void begin(), testId: "walk-tempo-ready" }}
        links={[{ label: W.skip, onClick: skip, testId: "walk-tempo-skip" }]}
      />
    );
  }
}

/** The speaker's sentence with the stretch they rushed or dragged marked:
 *  their own clip, the words above its player (the locked prototype's
 *  `clip(f.text)`), as the walk's moments are; the words alone without audio. */
export function TempoStretchBubble({ stretch }: { stretch: TempoStretch }) {
  const words = (
    <>
      {stretch.said.before}{" "}
      <mark className="rounded bg-white/25 px-0.5 text-inherit">{stretch.said.stretch}</mark>{" "}
      {stretch.said.after}
    </>
  );
  if (stretch.clip) {
    return (
      <WalkPlayer
        look="me"
        seed="tempo-stretch"
        src={stretch.clip.src}
        startOffsetMs={stretch.clip.startOffsetMs}
        durationMs={stretch.clip.durationMs}
        label={W.mark}
        words={words}
      />
    );
  }
  return <WalkSpeakerBubble>{words}</WalkSpeakerBubble>;
}

/** "Try N" in the speaker's bubble, with the line the dot drew. */
export function TempoTryBubble({ label, path }: { label: string; path: readonly number[] }) {
  const points = path.length > 1 ? path : [0, 0];
  const line = points.map((v, i) => `${((i / (points.length - 1)) * 300).toFixed(1)},${(26 - v * 22).toFixed(1)}`).join(" ");
  return (
    <WalkSpeakerBubble>
      <span className="block">{label}</span>
      <svg viewBox="0 0 300 30" preserveAspectRatio="none" className="mt-1 block h-8 w-56 max-w-full" aria-hidden>
        <line x1="0" x2="300" y1="15" y2="15" stroke="rgba(255,255,255,.5)" strokeDasharray="3 5" />
        <polyline points={line} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </WalkSpeakerBubble>
  );
}

const noop = () => undefined;
