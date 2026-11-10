"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { wayIn, wayInVoice, type Plan, type PlanState, type WayInAnswer } from "@/services/api/plan";
import {
  COMMUNITY_OFFER_SIGNED,
  COMMUNITY_OFFER_WORDS,
  communityOfferDue,
  communityOfferLine,
  linkLabel,
  profileOf,
  rowLinks,
  WAY_IN_POLL_GIVE_UP_MS,
  WAY_IN_POLL_MS,
  nextWayInPoll,
  WAY_IN_WORDS,
  wayInAsk,
  wayInBeat,
  wayInPollKey,
  wayInPolls,
  type WayInAsk,
  type WayInProfile,
} from "@/lib/willab/wayIn";
import { ChatLink, ChatLinks, PickRow, TapRow } from "@/components/willab/WillQuestion";
import { CopyLinkLine } from "@/components/willab/chats/JoinSetup";
import { SEND_PICKED } from "@/components/willab/chats/joinCopy";
import { TypingGlyph } from "@/components/willab/TypingDots";
import { answerCommunityOffer, getCommunityOffer, type CommunityOffer } from "@/services/api/communityOffer";
import { DatePickSheet, usePlanVoice } from "./PlanDock";

/* -------------------------------------------------------------------------- */
/*  The speaking way in, in Will's chat (rules: docs/flows/the-plan.md §2;    */
/*  backend `services/way_in.py`, N453, N564 item 1, N572, N573, N590, N592). */
/*  While Take 1 is processed: a thin row on top of the chat in place of the  */
/*  full wait, and the beats the backend writes, one at a time, drawn from   */
/*  `metadata.way_in`. Every word on screen is the backend's.                 */
/* -------------------------------------------------------------------------- */

/** What a way in row needs from the Lounge. */
export type WayInRowCtx = {
  /** "Open your feedback ›": Take 1's walk. */
  onOpenFeedback?: () => void;
  /** "Your questions for people who join ›": the summary again. */
  onJoinQuestions?: () => void;
  /** "Set up my chat ›" after the walk, for sharers: the setup of their own
   *  chat in Will's chat, begun (or its open question asked again). Absent
   *  without the chat builder's ring: the link is then not drawn. */
  onSetUpChat?: () => void;
};

/** "Here's how others will see you:": the card from slide 1, the name from
 *  sign-up, the role, one line of About, up to three "Ask about {topic}"
 *  (N453 item 2). Others see it only after "That's right". */
export function WayInProfileCard({ profile }: { profile: WayInProfile }) {
  return (
    <div
      data-row="app"
      data-way-in-profile=""
      className="mr-auto flex w-[85%] flex-col gap-1.5 rounded-[18px] border border-[#E6E6E6] bg-white p-4 shadow-[0_6px_20px_-14px_rgba(0,0,0,0.25)]"
    >
      {profile.name ? <div className="text-[17px] font-semibold leading-snug">{profile.name}</div> : null}
      {profile.role ? <div className="text-[14.5px] leading-[1.4] text-[#4A4A4A]">{profile.role}</div> : null}
      {profile.about ? <div className="text-[14.5px] leading-[1.4] text-[#4A4A4A]">{profile.about}</div> : null}
      {profile.topics.length ? (
        <div className="mt-1 flex flex-col items-start gap-1.5">
          {profile.topics.map((topic) => (
            <span key={topic} className="rounded-full bg-muted px-3 py-1 text-[13.5px] text-foreground">
              {topic}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WayLink({ label, ctx }: { label: string; ctx: WayInRowCtx }) {
  if (label === WAY_IN_WORDS.copyLink) return <CopyLinkLine />;
  const onClick =
    label === WAY_IN_WORDS.joinQuestions
      ? ctx.onJoinQuestions
      : label === WAY_IN_WORDS.setUpMyChat
        ? ctx.onSetUpChat
        : ctx.onOpenFeedback;
  return <ChatLink label={linkLabel(label)} onClick={onClick} />;
}

/** A row of the way in drawn its own way: the profile card, or Will's
 *  bubble with its ways to go ("You're set." for sharers, "Your feedback is
 *  ready."). Null for one drawn as any other bubble. */
export function wayInRowFor(message: LoungeMessage, ctx: WayInRowCtx): ReactNode | null {
  if (wayInBeat(message) === null || message.role === "user") return null;
  const profile = profileOf(message);
  if (profile) return <WayInProfileCard profile={profile} />;
  // "Set up my chat ›" only where the setup can begin (the builder's ring).
  const links = rowLinks(message).filter((label) => label !== WAY_IN_WORDS.setUpMyChat || ctx.onSetUpChat);
  if (links.length === 0) return null;
  return (
    <>
      <div data-row="app" data-bubble className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
        {message.body}
      </div>
      <ChatLinks>
        {links.map((label) => (
          <WayLink key={label} label={label} ctx={ctx} />
        ))}
      </ChatLinks>
    </>
  );
}

/** The thin row on top of Will's chat while Take 1 is processed, in place
 *  of the full wait (N453 item 1); orange once the walk is ready, and a tap
 *  opens it (N453 item 7, N592 item 1). */
export function WayInProcessingRow({ label, ready, onOpen }: { label: string; ready: boolean; onOpen: () => void }) {
  return ready ? (
    <button
      type="button"
      data-way-in-processing="ready"
      onClick={onOpen}
      className="flex min-h-[40px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#FF640A] px-4 text-[14px] font-medium text-white"
    >
      {WAY_IN_WORDS.ready}
      <span aria-hidden className="text-[18px] leading-none">
        ›
      </span>
    </button>
  ) : (
    <div
      data-way-in-processing="processing"
      role="status"
      className="flex min-h-[36px] w-full shrink-0 items-center justify-center gap-2.5 rounded-full bg-muted px-4 text-[13.5px] text-muted-foreground"
    >
      <TypingGlyph />
      <span>{label}</span>
    </div>
  );
}

/** The thin row while the way in's Take 1 is processed, or once its walk
 *  is ready until the walk is done; nothing for any other Take. */
export function WayInTop({
  on,
  resume,
  readyArc,
  walkReady,
  label,
  onOpen,
}: {
  /** The plan says Take 1 of the way in, its walk not yet done. */
  on: boolean;
  resume: { status: string } | null;
  /** Take 1's project, once its feedback was seen ready here. */
  readyArc: string | null;
  /** The plan says the walk is ready. */
  walkReady: boolean;
  label: string;
  onOpen: () => void;
}) {
  if (!on) return null;
  const ready = readyArc !== null || walkReady;
  if (!ready && resume?.status !== "analyzing") return null;
  return <WayInProcessingRow label={label} ready={ready} onOpen={onOpen} />;
}

/** The taps under Will's open beat: one tap answers; "Pick a date" opens the
 *  date sheet (N564 item 1); the choice takes several (N573). */
function WayInAnswers({
  ask,
  busy,
  picked,
  onToggle,
  onAnswer,
}: {
  ask: WayInAsk;
  busy: boolean;
  picked: string[];
  onToggle: (label: string) => void;
  onAnswer: (answer: WayInAnswer) => void;
}) {
  const [dating, setDating] = useState(false);
  if (ask.kind === "choice") {
    return <PickRow labels={ask.chips} picked={picked} onToggle={onToggle} dataAttr={{ "data-way-in-choice": "" }} />;
  }
  if (ask.kind !== "taps" || busy) return null;
  const tap = (label: string) => {
    if (ask.beat !== "talk_date") return onAnswer({ beat: ask.beat, picked: label });
    if (label === WAY_IN_WORDS.pickDate) return setDating(true);
    return onAnswer({ beat: ask.beat, date: null });
  };
  return (
    <>
      <TapRow labels={ask.chips} onTap={tap} dataAttr={{ "data-way-in-ask": ask.beat }} />
      {dating ? (
        <DatePickSheet
          onClose={() => setDating(false)}
          onPick={(day) => {
            setDating(false);
            onAnswer({ beat: ask.beat, date: day });
          }}
        />
      ) : null}
    </>
  );
}

/** The newcomer's one offer to join their business's community, as Will's
 *  bubble with Join and Not now (backend N559 item 1, MATCH-06). Either
 *  answer is sent once and the way in goes on; it never waits for it. */
function CommunityOfferAsk({ offer, onAnswer }: { offer: CommunityOffer; onAnswer: (answer: "join" | "not_now") => void }) {
  return (
    <>
      <div data-row="app" data-bubble data-community-offer="" className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
        {communityOfferLine(offer)}
      </div>
      <TapRow
        labels={[COMMUNITY_OFFER_WORDS.join, COMMUNITY_OFFER_WORDS.notNow]}
        onTap={(label) => onAnswer(label === COMMUNITY_OFFER_WORDS.join ? "join" : "not_now")}
        dataAttr={{ "data-community-offer-ask": "" }}
      />
    </>
  );
}

/** The offer, read once when the way in has begun; gone once answered. */
function useCommunityOffer(begun: boolean): [CommunityOffer | null, (answer: "join" | "not_now") => void] {
  const [offer, setOffer] = useState<CommunityOffer | null>(null);
  useEffect(() => {
    if (!begun || !COMMUNITY_OFFER_SIGNED) return;
    let live = true;
    void getCommunityOffer().then((got) => {
      if (live) setOffer(got);
    });
    return () => {
      live = false;
    };
  }, [begun]);
  const answer = (choice: "join" | "not_now") => {
    if (!offer) return;
    setOffer(null);
    void answerCommunityOffer(offer.id, choice);
  };
  return [offer, answer];
}

export type WayIn = {
  /** The taps under Will's open beat, in the thread. */
  asks: ReactNode;
  /** "Send" for the bar's middle while the choice has picks (N572 item 3). */
  barMiddle: ReactNode;
  /** "Tell me what to change." waits: "Record your answer" records it. */
  hear: { onTap: () => void } | null;
  /** The recording bar while that answer is said. */
  voiceBar: ReactNode;
  recording: boolean;
  /** Words wait: "Something else" picked, or Will's last question after the
   *  walk; the box stays open. */
  wordsWait: boolean;
  /** Typed words for the way in, when it waits for them; false otherwise. */
  say: (words: string) => boolean;
};

/** The way in in the Lounge: it asks the backend for the beats that are due
 *  while Take 1 is processed (each call idempotent), and sends the answers.
 *  `run` is the plan's: it sends, keeps the plan, and reads the thread
 *  again; `apply` keeps a plan read in the background. */
export function useWayIn({
  plan,
  messages,
  firstTakeInFlight,
  busy,
  run,
  apply,
  reload,
  onWords,
}: {
  plan: Plan | null;
  messages: LoungeMessage[];
  firstTakeInFlight: boolean;
  busy: boolean;
  run: (work: () => Promise<PlanState | null>) => Promise<void>;
  apply: (state: PlanState) => void;
  reload: () => Promise<void> | void;
  /** Open the box for one's own words ("Something else", N573 item 1). */
  onWords?: () => void;
}): WayIn {
  const ask = wayInAsk(messages, plan);
  const [picked, setPicked] = useState<string[]>([]);
  const askKey = ask ? `${ask.kind}:${ask.beat}` : null;
  useEffect(() => setPicked([]), [askKey]);

  // While the way in waits on the Take (its reading, the beats due), ask
  // again every few seconds; never two calls at once.
  const polls = wayInPolls(plan, firstTakeInFlight);
  const pollKey = polls ? wayInPollKey(plan) : null;
  const latest = useRef({ apply, reload, busy });
  latest.current = { apply, reload, busy };
  // A call that brings nothing waits longer (up to a minute), and after a
  // long while with nothing new the asking stops until the way in moves on.
  useEffect(() => {
    if (pollKey === null) return;
    let stopped = false;
    let delay = WAY_IN_POLL_MS;
    let quietFor = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      let wrote = false;
      if (!latest.current.busy) {
        try {
          const got = await wayIn();
          if (stopped) return;
          if (got) {
            latest.current.apply(got);
            wrote = got.wrote;
            if (got.wrote) await latest.current.reload();
          }
        } catch {
          // Asked again at the next tick.
        }
      }
      if (stopped) return;
      if (wrote) {
        delay = WAY_IN_POLL_MS;
        quietFor = 0;
      }
      if (quietFor >= WAY_IN_POLL_GIVE_UP_MS) return;
      timer = setTimeout(() => void tick(), delay);
      quietFor += delay;
      delay = nextWayInPoll(delay);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollKey]);

  const answer = (a: WayInAnswer) => void run(() => wayIn(a));
  const voice = usePlanVoice({
    open: ask?.kind === "voice" && !busy,
    onAnswer: (audio) => run(() => wayInVoice(audio, ask?.beat ?? "profile")),
  });
  const toggle = (label: string) => {
    const on = !picked.includes(label);
    setPicked((now) => (on ? [...now, label] : now.filter((p) => p !== label)));
    if (on && label === WAY_IN_WORDS.somethingElse) onWords?.();
  };
  const [offer, answerOffer] = useCommunityOffer(plan?.way_in != null && !plan.way_in.walk_done);
  // The offer comes before the first choice, which waits under it (N559 item 1).
  const offering = offer !== null && communityOfferDue(plan, ask);
  const choosing = ask?.kind === "choice" && !offering;
  const typed = choosing && picked.includes(WAY_IN_WORDS.somethingElse);
  return {
    asks: offering ? (
      <CommunityOfferAsk offer={offer} onAnswer={answerOffer} />
    ) : ask ? (
      <WayInAnswers ask={ask} busy={busy} picked={picked} onToggle={toggle} onAnswer={answer} />
    ) : null,
    barMiddle:
      choosing && picked.length > 0 && !typed ? (
        <button
          type="button"
          data-way-in-send=""
          disabled={busy}
          onClick={() => answer({ beat: "choice", picked })}
          className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background disabled:opacity-45"
        >
          {SEND_PICKED}
        </button>
      ) : null,
    hear: voice.waiting,
    voiceBar: voice.bar,
    recording: voice.recording,
    wordsWait: typed || ask?.kind === "words",
    say: (words) => {
      if (typed) answer({ beat: "choice", picked, said: words });
      else if (ask?.kind === "words") answer({ beat: "else", said: words });
      else return false;
      return true;
    },
  };
}
