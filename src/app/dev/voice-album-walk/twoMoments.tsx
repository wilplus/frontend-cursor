"use client";

/* -------------------------------------------------------------------------- */
/*  DEV ONLY — "listen before your talk" in two moments, both in Will's chat:  */
/*                                                                            */
/*    the last practice   after its Take and walk, just before the plan's     */
/*                        last two ratings (the-plan.md §D1, §I1): their best  */
/*                        moment, "Does this sound confident to you?", the     */
/*                        coach's line after their answer, then the ratings    */
/*    the talk day        the deadline-morning line (§I3) with the clip inside */
/*                        the chat, playable all day, nothing asked            */
/*                                                                            */
/*    ?screen=m-last&step=0..3 · m-notify · m-talk · m-after                   */
/*                                                                            */
/*  Built from the chat's own parts: TapRow (the plan's answers), the clip    */
/*  bubble's markup with SnippetWavePlayer, the plan's scale and its locked   */
/*  "Answered". Fixtures only; nothing is fetched. Words marked PROPOSED wait  */
/*  for the founder's OK (Never 4); the rest are shipped.                      */
/* -------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import SnippetWavePlayer from "@/components/willab/SnippetWavePlayer";
import { TapRow } from "@/components/willab/WillQuestion";
import { CHUNK_SHEET_COPY } from "@/components/willab/idealEditCopy";

/* Shipped words (backend services/plan.py COPY; the walk; today's album). */
const SHIPPED = {
  stressQ: "How stressed do you feel about it right now?",
  stressLo: "Calm",
  stressHi: "Very stressed",
  readyQ: "How ready do you feel for it right now?",
  readyLo: "Not ready",
  readyHi: "Fully ready",
  answered: "Answered",
  question: CHUNK_SHEET_COPY.confidenceQuestion,
  coach: "Your coach: heard the same thing",
  done: "9 of 9 practices done.",
  howDidItGo: "How did it go? Tell me in a voice message.",
};

/* PROPOSED words: none of these is on any screen today. */
export const PROPOSED_TWO = {
  lastIntro: "Tomorrow is the day. Before my last two questions, listen to yourself at your best.",
  lastEnd: "It will be here for you tomorrow.",
  talk: "Good luck today. Listen to yourself at your best before you go on.",
};

/** Their words in the clip and where it is from (fixtures). */
const WORDS = "The window closes once the incumbents catch up with pricing.";
const FROM = "Take 3 · Nov 2";
export const FACES = ["Audio unclear", "👎 No", "😐 In-between", "👍 Yes"];

function ChatFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="text-[22px] leading-none">‹</span>
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[13px] font-bold tracking-[-1px]">•••</span>
        <span className="text-[17px] font-semibold">Will</span>
      </div>
      <div data-chat-body className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6 pt-4">
        <div className="flex-1" />
        {children}
      </div>
    </div>
  );
}

function Day({ text }: { text: string }) {
  return <div className="self-center py-1.5 text-[12.5px] text-[#737373]">{text}</div>;
}

function Will({ children }: { children: ReactNode }) {
  return (
    <div data-row="app" className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
      {children}
    </div>
  );
}

function Me({ children }: { children: ReactNode }) {
  return (
    <div data-row="me" data-said className="ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-[15px] text-primary-foreground">
      {children}
    </div>
  );
}

/** The speaker's own clip in the chat, as the Lounge's ClipBubble draws it:
 *  their words over the player. */
function Clip({ src }: { src: string | null }) {
  return (
    <div data-row="me" data-clip className="flex justify-end">
      <div data-bubble="" className="flex w-[78%] flex-col gap-1 rounded-[16px] bg-primary px-3 py-2 text-primary-foreground">
        <span className="text-[12.5px] opacity-80">{FROM}</span>
        <span className="text-[13px] leading-[1.45] opacity-[0.92]">{WORDS}</span>
        <SnippetWavePlayer seed="s2" src={src} durationMs={7000} size="compact" tone="me" label={FROM} />
      </div>
    </div>
  );
}

/** The plan's 1 to 10 scale (PlanDock's, not exported there). */
function Scale({ lo, hi }: { lo: string; hi: string }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex justify-between gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" data-scale={n} aria-label={`${n} of 10`} className="h-8 w-8 rounded-full border-[1.5px] border-[#DCDCDC] bg-white p-0 text-[13.5px] font-semibold text-[#121212]">
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12.5px] text-[#737373]">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}

/** A rating said back without its number (PlanRows LockedAnswer, N339). */
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

/** The last practice, after its walk: `step` 0..3. */
export function LastPractice({ step, src }: { step: number; src: string | null }) {
  return (
    <ChatFrame>
      <Day text="Fri 13 Nov" />
      <Will>{SHIPPED.done}</Will>
      <Will>{PROPOSED_TWO.lastIntro}</Will>
      <Clip src={src} />
      <Will>{SHIPPED.question}</Will>
      {step === 0 ? <TapRow labels={FACES} onTap={() => {}} dataAttr={{ "data-listen-ask": "" }} /> : <Me>{FACES[3]}</Me>}
      {step >= 1 ? <div data-coach><Will>{SHIPPED.coach}</Will></div> : null}
      {step >= 1 ? <Will>{SHIPPED.stressQ}</Will> : null}
      {step === 1 ? <Scale lo={SHIPPED.stressLo} hi={SHIPPED.stressHi} /> : null}
      {step >= 2 ? <Locked /> : null}
      {step >= 2 ? <Will>{SHIPPED.readyQ}</Will> : null}
      {step === 2 ? <Scale lo={SHIPPED.readyLo} hi={SHIPPED.readyHi} /> : null}
      {step >= 3 ? <Locked /> : null}
      {step >= 3 ? <Will>{PROPOSED_TWO.lastEnd}</Will> : null}
    </ChatFrame>
  );
}

/** The talk day: the line with the clip in the chat; `after`: the next day. */
export function TalkDay({ src, after = false }: { src: string | null; after?: boolean }) {
  return (
    <ChatFrame>
      <Day text="Sat 14 Nov" />
      <Will>{PROPOSED_TWO.talk}</Will>
      <Clip src={src} />
      {after ? (
        <>
          <Day text="Sun 15 Nov" />
          <Will>{SHIPPED.howDidItGo}</Will>
        </>
      ) : null}
    </ChatFrame>
  );
}

/** The opt-in reminder (§I11–12): the chat line's words only. */
export function TalkNotify() {
  return (
    <div className="flex h-full flex-col items-center bg-[linear-gradient(160deg,#2b2623,#5a3a26)] px-4 pt-16 text-white">
      <div className="text-[15px] opacity-80">Saturday 14 November</div>
      <div className="mt-1 text-[76px] font-light leading-none tracking-tight">9:00</div>
      <button type="button" data-notify className="mt-10 w-full rounded-[22px] bg-white/85 p-3.5 text-left text-[#111] shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-[12.5px] text-[#555]">
          <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-[#111] text-[9px] font-bold text-white">W</span>
          <span className="flex-1">Will · WillpowerLab</span>
          <span>now</span>
        </div>
        <div className="mt-1.5 text-[15px] leading-snug">{PROPOSED_TWO.talk}</div>
      </button>
    </div>
  );
}
