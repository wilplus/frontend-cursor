"use client";

import { useRef } from "react";
import WalkPlayer from "./walk/WalkPlayer";
import WalkMessage from "./walk/WalkMessage";
import PaceScale from "./pace/PaceScale";
import { WALK_COPY } from "./idealEditCopy";
import { TEMPO_COPY } from "@/lib/willab/tempoStep";

/* -------------------------------------------------------------------------- */
/*  WelcomeExample — "See an example", over the whole page (founder           */
/*  2026-10-30, backend N277, on its prototype). The founder's own Take, as   */
/*  the walk drew it: his clip and its words, the walk's line with the AI     */
/*  version of his voice, then the tempo step's two lines and the Sniper (the */
/*  pace scale). Published with his consent. Nothing is agreed, recorded or   */
/*  sent; "Try it with your talk" does what Enter the lab does.               */
/*                                                                            */
/*  THE SNIPER PLAYS A SET PACE. The page has no microphone, so the dot moves */
/*  as a rushed speaker's does: right into the orange, back in a breath, then */
/*  even in the green, and again.                                             */
/* -------------------------------------------------------------------------- */

export const WELCOME_EXAMPLE_COPY = {
  title: "An example",
  /** What the founder said in that moment, as he confirmed it. */
  said: "“All around actors, their costumes, all that was really great.”",
  /** The walk's line before the AI version of the voice. */
  better: "That was good. But what if you said it more like this?",
  topic: "the actors",
  tryIt: "Try it with your talk",
  close: "Close",
} as const;

const SAID_SRC = "/examples/founder-take-said.mp3";
const AI_SRC = "/examples/founder-take-ai.mp3";

/** [seconds, the meter's activity 0..1, or null for silence]: a rushed start,
 *  a breath, then an even pace in the green; it loops. */
const PACE: readonly (readonly [number, number | null])[] = [
  [0, null], [0.6, 0.55], [1.6, 0.85], [2.6, 0.95], [3.4, 0.9], [3.9, 0.15], [4.6, 0.05],
  [5.2, 0.5], [6.4, 0.6], [7.6, 0.45], [8.6, 0.55], [9.6, 0.5], [10.4, null], [11.4, null],
];

/** The set pace at a moment of the loop. Pure. */
export function setPaceAt(seconds: number): number | null {
  const t = seconds % PACE[PACE.length - 1][0];
  for (let i = PACE.length - 1; i >= 0; i--) if (t >= PACE[i][0]) return PACE[i][1];
  return null;
}

export default function WelcomeExample({
  onTry,
  onClose,
}: {
  onTry: () => void;
  onClose: () => void;
}) {
  const startedAt = useRef<number | null>(null);
  const activity = () => {
    const now = typeof performance === "undefined" ? 0 : performance.now();
    if (startedAt.current === null) startedAt.current = now;
    return setPaceAt((now - startedAt.current) / 1000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={WELCOME_EXAMPLE_COPY.title}
      className="fixed inset-0 z-[90] flex flex-col bg-background"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={WELCOME_EXAMPLE_COPY.close}
        className="absolute right-3 top-[max(10px,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[30rem] flex-col gap-3 px-5 pb-6">
          {/* "An example" sits level with the ✕ (the founder, on the prototype). */}
          <p className="flex min-h-14 items-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {WELCOME_EXAMPLE_COPY.title}
          </p>
          <WalkPlayer
            look="me"
            seed="welcome-example-said"
            src={SAID_SRC}
            label={WELCOME_EXAMPLE_COPY.title}
          />
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {WELCOME_EXAMPLE_COPY.said}
          </p>
          <WalkMessage wide>
            <span>{WELCOME_EXAMPLE_COPY.better}</span>
            <span className="mt-2 flex items-center gap-[7px] text-[14px] font-semibold">
              <span
                aria-hidden
                className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-[5px] bg-foreground text-[9.5px] font-bold text-background"
              >
                {WALK_COPY.aiVoiceBadge}
              </span>
              {WALK_COPY.aiVoiceLabel}
            </span>
            <div className="mt-2">
              <WalkPlayer look="bare" seed="welcome-example-ai" src={AI_SRC} label={WALK_COPY.aiVoiceLabel} />
            </div>
          </WalkMessage>
          <WalkMessage>
            <span>{TEMPO_COPY.game.rushed}</span>
          </WalkMessage>
          <WalkMessage>
            <span>{TEMPO_COPY.task(WELCOME_EXAMPLE_COPY.topic)}</span>
          </WalkMessage>
          <WalkMessage wide>
            <PaceScale activity={activity} label={TEMPO_COPY.scale} className="h-[clamp(92px,24vw,140px)]" />
          </WalkMessage>
        </div>
      </div>

      <div className="flex shrink-0 justify-center px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onTry}
          className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90 active:scale-[0.98]"
        >
          {WELCOME_EXAMPLE_COPY.tryIt}
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-primary transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </div>
  );
}
