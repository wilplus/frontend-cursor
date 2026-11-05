"use client";

/* -------------------------------------------------------------------------- */
/*  DEV ONLY — a study of "listen before your talk", end to end: the Voice     */
/*  Album's self-modelling moment (backend docs/SPEC.md §9.2–9.3) on the       */
/*  plan's deadline morning (frontend docs/flows/the-plan.md §I3, its         */
/*  reminder rules §I11–12), drawn from the walk's and the plan's own parts.  */
/*  Fixtures only; nothing is fetched.                                         */
/*                                                                            */
/*    ?screen=notify            the reminder outside the app (opt-in)          */
/*    ?screen=morning           Will's line in his chat, with its link        */
/*    ?screen=listen&step=N     the lens, N = 0..5                             */
/*    ?screen=after             the chat the next morning                     */
/*                                                                            */
/*  Order matters (contract 32): the speaker answers before the coach's Yes   */
/*  is shown, so their leg stays independent. Words marked PROPOSED are new   */
/*  and wait for the founder's OK (Never 4); every other word is shipped.     */
/* -------------------------------------------------------------------------- */

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
  howDidItGo: "How did it go? Tell me in a voice message.",
};

/* PROPOSED words: none of these is on any screen today. */
export const PROPOSED = {
  morning: "Good luck today. Before you go on, listen to yourself at your best.",
  link: "Listen to yourself",
  again: "Listen again",
  bar: "Before your talk",
  predictTitle: "Before you listen",
  predictWhen: "On Nov 2, in Take 3, you said:",
  predictAsk: "How do you remember sounding?",
  gapLower: "You remembered it shakier than it sounds.",
  gapSame: "You remembered it right.",
  end: "That is how you sound. Go and enjoy it.",
  another: "Hear another",
};

/** The memory cue: the speaker's own words in that clip, from the Take's
 *  transcript (the Ideal Text holds them). Fixture words. */
const CUE_WORDS = "The window closes once the incumbents catch up with pricing.";

const FACE: Record<string, string> = { yes: "👍 Yes", in_between: "😐 In-between", no: "👎 No" };

/** The plan's 1 to 10 scale, as PlanDock draws it (not exported there). */
function Scale() {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex justify-between gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            data-scale={n}
            aria-label={`${n} of 10`}
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

/** The opt-in reminder outside the app (§I11–12): the chat's own words, a
 *  link that opens the chat at the day line; never the words or the clip.
 *  Drawn as a plain phone notification; the channel is WhatsApp or email. */
export function Notify() {
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
        <div className="mt-1.5 text-[15px] leading-snug">{PROPOSED.morning}</div>
      </button>
    </div>
  );
}

/** Will's chat (the Lounge's look). `after`: the next morning. */
export function MorningLounge({ after = false }: { after?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="text-[22px] leading-none">‹</span>
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[13px] font-bold tracking-[-1px]">•••</span>
        <span className="text-[17px] font-semibold">Will</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 px-4 pb-6">
        <div className="self-center py-1.5 text-[12.5px] text-[#737373]">Sat 14 Nov</div>
        <div data-row="app" className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
          {PROPOSED.morning}
        </div>
        <ChatLinks>
          <ChatLink label={after ? PROPOSED.again : PROPOSED.link} />
        </ChatLinks>
        {after ? (
          <>
            <div className="self-center py-1.5 text-[12.5px] text-[#737373]">Sun 15 Nov</div>
            <div data-row="app" className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
              {SHIPPED.howDidItGo}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** The lens, `step` 0..5: ready → guess → it plays → own answer → the gap,
 *  the coach, ready again → the end. */
export function ListenBefore({ step, src }: { step: number; src: string | null }) {
  // The guess has no "Audio unclear": nothing has played yet.
  const dock =
    step === 1 ? (
      <WalkFooter>
        <WalkFaces answered={null} onPick={() => {}} />
      </WalkFooter>
    ) : step === 3 ? (
      <WalkFooter>
        <WalkFaces answered={null} onPick={() => {}} />
        <WalkUnclear onPick={() => {}} />
      </WalkFooter>
    ) : step === 5 ? (
      <WalkFooter pill={{ label: SHIPPED.close, onClick: () => {} }} links={[{ label: PROPOSED.another, onClick: () => {} }]} />
    ) : null;
  return (
    <WalkOverlay caption={PROPOSED.bar} onClose={() => {}} footer={dock}>
      <WalkThreadMark label="Q3 Board pitch · Sat 14 Nov" />
      <div data-ready="before" className="flex flex-col gap-4">
        <WalkMessage>{SHIPPED.readyQ}</WalkMessage>
        {step === 0 ? <Scale /> : <Locked />}
      </div>
      {step >= 1 ? (
        <WalkMessage>
          <span>{PROPOSED.predictTitle}</span>
          <span className="mt-1.5">{PROPOSED.predictWhen}</span>
          <span className="my-1.5 italic">&ldquo;{CUE_WORDS}&rdquo;</span>
          <span>{PROPOSED.predictAsk}</span>
        </WalkMessage>
      ) : null}
      {step >= 2 ? <WalkSpeakerBubble>{FACE.in_between}</WalkSpeakerBubble> : null}
      {step >= 2 ? (
        <div data-reveal>
          <WalkPlayer look="me" seed="s2" src={src} durationMs={7000} label="Take 3 · Slide 2 · Nov 2" />
        </div>
      ) : null}
      {step >= 3 ? (
        <div data-own className="flex flex-col gap-4">
          <WalkMessage>{SHIPPED.question}</WalkMessage>
          {step >= 4 ? <WalkSpeakerBubble>{FACE.yes}</WalkSpeakerBubble> : null}
        </div>
      ) : null}
      {step >= 4 ? (
        <WalkMessage>
          <span data-gap>{PROPOSED.gapLower}</span>
        </WalkMessage>
      ) : null}
      {step >= 4 ? (
        <div data-coach>
          <WalkMessage coach>
            <span>{SHIPPED.coachLine}</span>
            <span>{SHIPPED.coachHeard}</span>
          </WalkMessage>
        </div>
      ) : null}
      {step >= 4 ? (
        <div data-ready="after" className="flex flex-col gap-4">
          <WalkMessage>{SHIPPED.readyQ}</WalkMessage>
          {step === 4 ? <Scale /> : <Locked />}
        </div>
      ) : null}
      {step >= 5 ? <WalkMessage>{PROPOSED.end}</WalkMessage> : null}
    </WalkOverlay>
  );
}
