"use client";

import { TEMPO_COPY as W, type TempoStretch } from "@/lib/willab/tempoStep";
import type { WalkTempoLine } from "@/lib/willab/walkThread";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkFooter from "./WalkFooter";
import { WalkSpeakerBubble } from "./WalkThread";

/* -------------------------------------------------------------------------- */
/*  WalkTempoSaid — the tempo step in a walk played again (founder            */
/*  2026-10-28, N247: "the whole feedback walk with all the things that are   */
/*  there that we went through, ... the sniper").                             */
/*                                                                            */
/*  Read only, as the chat kept it (N166 step 4): the speaker's stretch when  */
/*  the page still has it, Will's opening lines, each "Try N" as the          */
/*  speaker's bubble and its comment, the closing line or the Skip; then      */
/*  Next. No scale, no microphone, nothing recorded or posted. Every word was */
/*  said in the walk (TEMPO_COPY, signed, N179).                              */
/* -------------------------------------------------------------------------- */

export default function WalkTempoSaid({
  testId,
  stretch,
  lines,
  onNext,
  onClose,
}: {
  testId?: string;
  /** The Take's stretch, when the page has it; null: left out. */
  stretch: TempoStretch | null;
  /** The step as the chat kept it, in order. */
  lines: readonly WalkTempoLine[];
  onNext: () => void;
  onClose: () => void;
}) {
  const nav: WalkNav = {
    position: W.mark,
    index: 0,
    total: 1,
    onBack: noop,
    onNext,
    backDisabled: true,
    nextDisabled: true,
  };
  return (
    <WalkOverlay
      testId={testId}
      nav={nav}
      onClose={onClose}
      footer={<WalkFooter pill={{ label: W.next, onClick: onNext, testId: "walk-forward" }} />}
    >
      {stretch ? (
        <WalkSpeakerBubble>
          {stretch.said.before}{" "}
          <mark className="rounded bg-white/25 px-0.5 text-inherit">{stretch.said.stretch}</mark>{" "}
          {stretch.said.after}
        </WalkSpeakerBubble>
      ) : null}
      {lines.flatMap((line, i) =>
        line.author === "speaker"
          ? [<WalkSpeakerBubble key={i}>{line.body}</WalkSpeakerBubble>]
          : // Will's opening is kept as one message, its lines one bubble each, as said.
            line.body.split("\n").filter((said) => said.trim()).map((said, j) => (
              <WalkMessage key={`${i}:${j}`}>
                <span>{said}</span>
              </WalkMessage>
            )),
      )}
    </WalkOverlay>
  );
}

const noop = () => undefined;
