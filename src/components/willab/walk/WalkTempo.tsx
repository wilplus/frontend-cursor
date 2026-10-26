"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startPaceMic, type PaceMic } from "@/lib/willab/pace/paceMic";
import {
  TEMPO_DRAFT_COPY as W,
  TEMPO_MAX_TRIES,
  closeOf,
  readTry,
  type TempoStretch,
  type TempoTry,
} from "@/lib/willab/tempoStep";
import PaceScale from "../pace/PaceScale";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkFooter from "./WalkFooter";
import RecordingStrip from "./RecordingStrip";
import { WalkSpeakerBubble, useMountedAsPast } from "./WalkThread";

/* -------------------------------------------------------------------------- */
/*  WalkTempo — the tempo step of the walk (backend N162, N166; the walk's    */
/*  page §2 "Tempo"; prototype https://claude.ai/artifact/VJd5MeFGgZy7e3Q8M1EQXV). */
/*                                                                            */
/*  The speaker's stretch with the rushed or dragged part marked; three of   */
/*  Will's bubbles (what the stretch was, the task with its topic, the quiet */
/*  spot); under them the scale, asleep, with I'm ready and Skip. I'm ready   */
/*  wakes the scale and the recording bar; nothing else lands until Stop.    */
/*  Each try: the dot's path as the speaker's bubble, then one comment;       */
/*  Practise again, and after the second try See how it went; after the      */
/*  third, the closing line comes by itself; Next goes on with the walk.     */
/*                                                                            */
/*  Listen only: the scale reads the microphone in this tab, nothing is      */
/*  recorded or sent. The words are drafts (TEMPO_DRAFT_COPY): the step is   */
/*  shown only behind the founder's switch until they are signed.            */
/* -------------------------------------------------------------------------- */

/** One point of a try's path every 200 ms. */
const PATH_EVERY_MS = 200;
/** A try left running stops itself after a minute, as a practise's upload does. */
const TRY_LIMIT_MS = 60_000;

type Phase = "idle" | "starting" | "listening" | "blocked" | "commented" | "closed";

export default function WalkTempo({
  testId,
  stretch,
  onDone,
  onClose,
}: {
  testId?: string;
  stretch: TempoStretch;
  onDone: () => void;
  onClose: () => void;
}) {
  const past = useMountedAsPast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [tries, setTries] = useState<{ result: TempoTry; path: number[] }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const activity = useRef<number | null>(null);
  const mic = useRef<PaceMic | null>(null);
  const timers = useRef<number[]>([]);
  const path = useRef<number[]>([]);

  const halt = useCallback(() => {
    mic.current?.stop();
    mic.current = null;
    timers.current.forEach((id) => window.clearInterval(id));
    timers.current = [];
  }, []);
  useEffect(() => halt, [halt]);

  const begin = useCallback(async () => {
    setPhase("starting");
    activity.current = null;
    path.current = [];
    const opened = await startPaceMic((read) => {
      activity.current = read.activity;
    });
    if (!opened) {
      setPhase("blocked");
      return;
    }
    mic.current = opened;
    const started = performance.now();
    setElapsed(0);
    timers.current.push(
      window.setInterval(() => path.current.push(activity.current ?? 0), PATH_EVERY_MS),
      window.setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 250),
    );
    setPhase("listening");
  }, []);

  const stop = useCallback(() => {
    halt();
    const taken = path.current.slice();
    setTries((had) => {
      const next = [...had, { result: readTry(taken), path: taken }];
      setPhase(next.length >= TEMPO_MAX_TRIES ? "closed" : "commented");
      return next;
    });
  }, [halt]);

  useEffect(() => {
    if (phase !== "listening") return;
    const id = window.setTimeout(stop, TRY_LIMIT_MS);
    return () => window.clearTimeout(id);
  }, [phase, stop]);

  const skip = useCallback(() => {
    halt();
    if (tries.length > 0) setPhase("closed");
    else onDone();
  }, [halt, tries.length, onDone]);

  const nav: WalkNav = {
    position: W.mark,
    index: 0,
    total: 1,
    onBack: noop,
    onNext: onDone,
    backDisabled: true,
    nextDisabled: true,
  };

  const live = phase === "listening" || phase === "starting";
  const scaleShown = !past && (phase === "idle" || phase === "blocked" || live);

  return (
    <WalkOverlay
      testId={testId}
      nav={nav}
      onClose={() => {
        halt();
        onClose();
      }}
      footer={past ? null : footerFor()}
    >
      <WalkSpeakerBubble>
        {stretch.said.before}{" "}
        <mark className="rounded bg-white/25 px-0.5 text-inherit">{stretch.said.stretch}</mark>{" "}
        {stretch.said.after}
      </WalkSpeakerBubble>
      <WalkMessage>
        <span>{W.game[stretch.reading]}</span>
      </WalkMessage>
      <WalkMessage>
        <span>{W.task(stretch.topic)}</span>
      </WalkMessage>
      <WalkMessage>
        <span>{W.room}</span>
      </WalkMessage>
      {tries.map((t, i) => (
        <TryParts key={i} n={i + 1} path={t.path} result={t.result} />
      ))}
      {scaleShown ? (
        <WalkMessage wide>
          <PaceScale
            activity={() => activity.current}
            asleep={!live}
            label={W.scale}
            className="h-[clamp(120px,30vw,200px)]"
          />
        </WalkMessage>
      ) : null}
      {phase === "blocked" ? (
        <WalkMessage>
          <span>{W.blocked}</span>
        </WalkMessage>
      ) : null}
      {phase === "closed" ? (
        <WalkMessage>
          <span>{W.close[closeOf(tries.map((t) => t.result))]}</span>
        </WalkMessage>
      ) : null}
    </WalkOverlay>
  );

  function footerFor() {
    if (live) {
      return (
        <WalkFooter links={[{ label: W.skip, onClick: skip, testId: "walk-tempo-skip" }]}>
          <RecordingStrip elapsed={elapsed} stopLabel={W.stop} onStop={phase === "listening" ? stop : undefined} />
        </WalkFooter>
      );
    }
    if (phase === "closed") return <WalkFooter pill={{ label: W.next, onClick: onDone, testId: "walk-forward" }} />;
    if (phase === "commented") {
      const finish = tries.length >= 2 ? [{ label: W.finish, onClick: () => setPhase("closed"), testId: "walk-tempo-finish" }] : [];
      return (
        <WalkFooter
          dot
          outline
          pill={{ label: W.again, onClick: () => void begin(), testId: "walk-practise" }}
          links={finish}
        />
      );
    }
    return (
      <WalkFooter
        dot
        pill={{ label: W.ready, onClick: () => void begin(), testId: "walk-tempo-ready" }}
        links={[{ label: W.skip, onClick: skip, testId: "walk-tempo-skip" }]}
      />
    );
  }
}

/** A try: the dot's path in the speaker's bubble, then its comment. */
function TryParts({ n, path, result }: { n: number; path: readonly number[]; result: TempoTry }) {
  const points = path.length > 1 ? path : [0, 0];
  const line = points.map((v, i) => `${((i / (points.length - 1)) * 300).toFixed(1)},${(26 - v * 22).toFixed(1)}`).join(" ");
  return (
    <>
      <WalkSpeakerBubble>
        <span className="block">{W.tryLabel(n)}</span>
        <svg viewBox="0 0 300 30" preserveAspectRatio="none" className="mt-1 block h-8 w-56 max-w-full" aria-hidden>
          <line x1="0" x2="300" y1="15" y2="15" stroke="rgba(255,255,255,.5)" strokeDasharray="3 5" />
          <polyline points={line} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      </WalkSpeakerBubble>
      <WalkMessage>
        <span>{W.comment[result]}</span>
      </WalkMessage>
    </>
  );
}

const noop = () => undefined;
