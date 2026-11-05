"use client";

/* -------------------------------------------------------------------------- */
/*  DEV ONLY — a study of "listen before your talk": the Voice Album's         */
/*  self-modelling moment (backend docs/SPEC.md §9.2–9.3) folded into the      */
/*  plan's deadline morning (frontend docs/flows/the-plan.md §I3), drawn from  */
/*  the walk's and the plan's own parts. Fixtures only; nothing is fetched.    */
/*                                                                            */
/*    ?screen=morning        Will's deadline-morning line in the Lounge        */
/*    ?screen=listen&step=N  the thread, N = 0..5                              */
/*                                                                            */
/*  Words marked PROPOSED are new and wait for the founder's OK (Never 4).    */
/*  Every other word is one the app already shows.                            */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import WalkOverlay from "@/components/willab/walk/WalkOverlay";
import WalkMessage from "@/components/willab/walk/WalkMessage";
import WalkPlayer from "@/components/willab/walk/WalkPlayer";
import WalkFooter from "@/components/willab/walk/WalkFooter";
import WalkFaces, { WalkUnclear } from "@/components/willab/walk/WalkFaces";
import { WalkSpeakerBubble, WalkThreadMark } from "@/components/willab/walk/WalkThread";
import { ChatLink, ChatLinks } from "@/components/willab/WillQuestion";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";

/* Shipped words (backend services/plan.py COPY; today's album; the walk). */
const SHIPPED = {
  readyQ: "How ready do you feel for it right now?",
  readyLo: "Not ready",
  readyHi: "Fully ready",
  answered: "Answered",
  coachLine: CHUNK_SHEET_COPY.titleCoachLine,
  coachHeard: "heard the same thing",
  question: CHUNK_SHEET_COPY.confidenceQuestion,
  close: "Close",
};

/* PROPOSED words: none of these is on any screen today. */
export const PROPOSED = {
  morning: "Good luck today. Before you go on, listen to yourself at your best.",
  link: "Listen to yourself",
  bar: "Before your talk",
  predict: "Before you listen: how do you think you sounded on Slide 2?",
  end: "That is how you sound. Go and enjoy it.",
};

const FACE: Record<string, string> = { yes: "👍 Yes", in_between: "😐 In-between", no: "👎 No" };

/** The plan's 1 to 10 scale, as PlanDock draws it (not exported there). */
function Scale({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex justify-between gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            data-scale={n}
            aria-label={`${n} of 10`}
            onClick={onPick}
            className="h-8 w-8 rounded-full border-[1.5px] border-[#DCDCDC] bg-white p-0 text-[13.5px] font-semibold text-[#121212]"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12.5px] text-[#737373]">
        <span>{SHIPPED.readyLo}</span>
        <span>{SHIPPED.readyHi}</span>
      </div>
    </div>
  );
}

/** The tap said back without its number (PlanRows LockedAnswer, N339). */
function Locked() {
  return (
    <div data-row="me" data-plan-answered className="ml-auto inline-flex w-max items-center gap-1.5 rounded-full border-[1.5px] border-[#E6E6E6] bg-white py-1 pl-2.5 pr-3 text-[13.5px] text-[#737373]">
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {SHIPPED.answered}
    </div>
  );
}

/** Will's deadline-morning line in his chat (the Lounge's look). */
export function MorningLounge({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" aria-label="Close" onClick={onClose} className="text-[22px] leading-none">‹</button>
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[13px] font-bold tracking-[-1px]">•••</span>
        <span className="text-[17px] font-semibold">Will</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 px-4 pb-6">
        <div className="self-center py-1.5 text-[12.5px] text-[#737373]">Sat 14 Nov</div>
        <div data-row="app" className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
          {PROPOSED.morning}
        </div>
        <ChatLinks>
          <ChatLink label={PROPOSED.link} onClick={onOpen} />
        </ChatLinks>
      </div>
    </div>
  );
}

/** The thread, `step` 0..5: ready → predict → listen → own answer → ready → end. */
export function ListenBefore({ step, src, onStep, onClose }: { step: number; src: string | null; onStep: (n: number) => void; onClose: () => void }) {
  const [predicted] = useState("in_between");
  const next = () => onStep(step + 1);
  const dock =
    step === 0 || step === 4 ? null
    : step === 1 || step === 3 ? (
      <WalkFooter>
        <WalkFaces answered={null} onPick={next} />
        <WalkUnclear onPick={next} />
      </WalkFooter>
    )
    : step === 2 ? <WalkFooter pill={{ label: CHUNK_SHEET_COPY.pagerNext, onClick: next }} />
    : <WalkFooter pill={{ label: SHIPPED.close, onClick: onClose }} />;
  return (
    <WalkOverlay caption={PROPOSED.bar} onClose={onClose} footer={dock}>
      <WalkThreadMark label="Q3 Board pitch · Sat 14 Nov" />
      <WalkMessage>{SHIPPED.readyQ}</WalkMessage>
      {step === 0 ? <Scale onPick={next} /> : <Locked />}
      {step >= 1 ? <WalkMessage>{PROPOSED.predict}</WalkMessage> : null}
      {step >= 2 ? <WalkSpeakerBubble>{FACE[predicted]}</WalkSpeakerBubble> : null}
      {step >= 2 ? (
        <>
          <WalkThreadMark label="Take 3 · Slide 2 · Nov 2" />
          <WalkPlayer look="me" seed="s2" src={src} durationMs={7000} label="Take 3 · Slide 2 · Nov 2" />
          <WalkMessage coach>
            <span>{SHIPPED.coachLine}</span>
            <span>{SHIPPED.coachHeard}</span>
          </WalkMessage>
        </>
      ) : null}
      {step >= 3 ? <WalkMessage>{SHIPPED.question}</WalkMessage> : null}
      {step >= 4 ? <WalkSpeakerBubble>{FACE.yes}</WalkSpeakerBubble> : null}
      {step >= 4 ? <WalkMessage>{SHIPPED.readyQ}</WalkMessage> : null}
      {step === 4 ? <Scale onPick={next} /> : null}
      {step >= 5 ? <Locked /> : null}
      {step >= 5 ? <WalkMessage>{PROPOSED.end}</WalkMessage> : null}
    </WalkOverlay>
  );
}
