"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Linkified from "../Linkified";
import { ChatLink, ChatLinks, TapRow } from "../WillQuestion";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { answerChatSetupStep, beginChatSetup, getBuilder, offerChatSetup } from "@/services/api/assistants";
import { readSetup } from "@/services/api/hostSetup";
import AssistantBuilder from "./AssistantBuilder";
import { joinSetupWaiting } from "./JoinSetup";

/* -------------------------------------------------------------------------- */
/*  The setup of a person's own chat, in Will's chat (backend N578 item 4,    */
/*  N580 item 2, N582 item 1, N586 items 1 and 5; `services/chat_setup.py`,   */
/*  metadata.chat_setup), drawn as Will's setup for the one who shares is     */
/*  (JoinSetup.tsx): Will's lines, his question with its answers to tap while */
/*  it is the newest bubble, the words box when he asks for words, and what   */
/*  someone new will meet before "Go live". Every word is the backend's.      */
/*  Behind the ring row `chat_builder`: without it the backend writes none of */
/*  these rows, so nothing here is ever drawn.                                */
/* -------------------------------------------------------------------------- */

export type ChatSetup = { step: string; chips: string[] };

/** The steps that wait for an answer (backend `chat_setup.WAITS`). */
const WAITS = new Set(["offer", "welcome", "nav", "spec", "spec_own", "learn", "kind", "needs", "automate", "peek"]);

/** The steps answered by a tap alone (backend `chat_setup.TAPPED`): typed
 *  words there are refused, so they go to Will as an ordinary message. */
const TAPPED = new Set(["offer", "nav", "kind", "needs", "automate", "peek"]);

/** Will's row of the chat's setup, else null (one's own answers are drawn
 *  as any message of theirs). `retired`: the new setup has taken over (N632
 *  item 1), so the row is one of Will's plain lines. */
export function chatSetupOf(message: Pick<LoungeMessage, "role" | "metadata">, retired = false): ChatSetup | null {
  const raw = message.metadata?.chat_setup;
  if (retired || message.role !== "bot" || !raw || typeof raw !== "object") return null;
  const setup = raw as Record<string, unknown>;
  const chips = Array.isArray(setup.chips) ? setup.chips.filter((c): c is string => typeof c === "string") : [];
  return { step: typeof setup.step === "string" ? setup.step : "say", chips };
}

/** Will's setup question waiting for typed words: the newest bubble drawn,
 *  unless it takes taps only (then typed words are an ordinary message to
 *  Will, never sent to the setup and lost). `words`: he asks for words
 *  alone (the welcome, what people learn), so the box stays open. */
export function chatSetupWaiting(
  drawn: readonly Pick<LoungeMessage, "client_id" | "role" | "metadata">[],
): { to: string; words: boolean } | null {
  const last = drawn[drawn.length - 1];
  const setup = last ? chatSetupOf(last) : null;
  if (!last || !setup || !WAITS.has(setup.step) || TAPPED.has(setup.step)) return null;
  return { to: last.client_id, words: setup.chips.length === 0 };
}

/** The setup can begin again from Will's offer once it is no longer the
 *  newest bubble: until the assistant is live. */
export function chatSetupCanBegin(drawn: readonly Pick<LoungeMessage, "role" | "metadata">[]): boolean {
  return !drawn.some((m) => chatSetupOf(m)?.step === "live");
}

/** A tap, typed words or the setup begun again; each then reads Will's chat
 *  again, with the typing dots while it does. */
export function useChatSetup(reload: () => Promise<void>, setThinking: (on: boolean) => void) {
  /** True when the backend took it (the caller keeps typed words otherwise). */
  const run = async (work: () => Promise<boolean>): Promise<boolean> => {
    setThinking(true);
    try {
      const took = await work();
      if (took) await reload();
      return took;
    } finally {
      setThinking(false);
    }
  };
  return {
    tap: (to: string, picked: string) => run(() => answerChatSetupStep(to, { picked })),
    say: (to: string, said: string) => run(() => answerChatSetupStep(to, { said })),
    begin: () => run(beginChatSetup),
  };
}

/** One of Will's setup rows: his line (the preview before "Go live" keeps
 *  its lines), and, while it is the newest bubble, the answers to tap; after
 *  "Your assistant is live.", the way into the builder when there is one. */
export function ChatSetupBubble({
  message,
  setup,
  open,
  onTap,
  builder = null,
  onBegin,
}: {
  message: LoungeMessage;
  setup: ChatSetup;
  open: boolean;
  onTap: (picked: string) => Promise<unknown>;
  /** The builder's way in, drawn under the "live" row. */
  builder?: ReactNode;
  /** Will's offer, once newer bubbles came under it: "Set up my chat ›"
   *  begins the setup again (or asks its open question again). */
  onBegin?: () => void;
}) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const tap = (label: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    void onTap(label).finally(() => {
      sending.current = false;
      setBusy(false);
    });
  };
  // The likely answer comes first from the backend and sits nearest the
  // thumb (N371), as in Will's setup for the one who shares.
  const labels = [...setup.chips].reverse();
  return (
    <>
      {message.body ? (
        <div data-row="app" data-chat-setup-step={setup.step} className="mr-auto flex max-w-[85%] flex-col">
          <div data-bubble="" className="whitespace-pre-wrap break-words rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
            <Linkified text={message.body} />
          </div>
        </div>
      ) : null}
      {setup.step === "live" ? builder : null}
      {open && labels.length > 0 ? (
        <TapRow labels={labels} disabled={busy} onTap={tap} dataAttr={{ "data-chat-setup-answers": "" }} />
      ) : null}
      {!open && setup.step === "offer" && onBegin ? (
        <ChatLinks>
          <ChatLink label={SET_UP_MY_CHAT} onClick={onBegin} />
        </ChatLinks>
      ) : null}
    </>
  );
}

/** Whichever of Will's two setups waits for an answer (the questions for
 *  people who join, N503; one's own chat, N582), with how to answer it in
 *  words. One reader for both, so Will's chat asks it once. */
export function willSetupWaiting(
  shown: readonly Pick<LoungeMessage, "client_id" | "role" | "metadata">[],
  join: { say: (to: string, said: string) => Promise<void> },
  chat: { say: (to: string, said: string) => Promise<boolean> },
  /** The new setup has taken over: the earlier one waits for nothing (N632 item 1). */
  retired = false,
): { to: string; words: boolean; say: (said: string) => Promise<boolean | void> } | null {
  const joining = joinSetupWaiting(shown);
  if (joining) return { ...joining, say: (said) => join.say(joining.to, said) };
  const own = retired ? null : chatSetupWaiting(shown);
  return own ? { ...own, say: (said) => chat.say(own.to, said) } : null;
}

/** Will's line on what you know is worth comes once on this device (N586
 *  item 5), and only while you have no chat of your own set up. */
const OFFERED = "willab.assistant.offered";
let offerAsked = false;
let builderRead: ReturnType<typeof getBuilder> | null = null;
let newSetupRead: Promise<boolean> | null = null;

/** For tests: forget this page load's read and offer. */
export function resetAssistantInWill(): void {
  offerAsked = false;
  builderRead = null;
  newSetupRead = null;
}

/** Whoever the new setup answers for (GET /v2/chats/setup, the ring row
 *  `chat_builder`) sets their chat up there alone (backend N632 item 1). */
function hasNewSetup(): Promise<boolean> {
  newSetupRead = newSetupRead ?? readSetup().then((read) => read !== null);
  return newSetupRead;
}

function offeredHere(): boolean {
  try {
    return window.localStorage.getItem(OFFERED) === "1";
  } catch {
    return true;
  }
}

function markOffered(): void {
  try {
    window.localStorage.setItem(OFFERED, "1");
  } catch {
    // Not kept: asked of the backend again, which writes it once anyway.
  }
}

/** A host's own chat in Will's chat, for the chat builder's ring (N579 item
 *  2): Will's offer, once, when there is no recipe yet (the backend writes
 *  it, and only once while it waits); the builder's way in under "Your
 *  assistant is live.", in the backend's own words ("Set up my chat"); the
 *  builder over the screen. Without the ring the read is 404: nothing is
 *  offered and the way in draws nothing.
 *
 *  `retired`: the new setup answers for this person (N632 item 1). Then
 *  none of this is read or drawn: no offer, no way in, no sheet; Will's
 *  earlier setup rows are his plain lines and take no answer. The way in
 *  is "Your chat" in Will's lines. */
export function useAssistantInWill(
  signedIn: boolean | undefined,
  reload: () => Promise<void>,
): { builder: ReactNode; sheet: ReactNode; retired: boolean } {
  const [label, setLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [retired, setRetired] = useState(false);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const readBuilder = async () => {
      // One read per page load, shared by every mount of Will's chat.
      builderRead = builderRead ?? getBuilder();
      const builder = await builderRead;
      if (!alive || !builder) return;
      setLabel(SET_UP_MY_CHAT);
      if (builder.recipe || offerAsked || offeredHere()) return;
      offerAsked = true;
      if (await offerChatSetup()) {
        markOffered();
        await reload().catch(() => undefined);
      }
    };
    void hasNewSetup().then((yes) => {
      if (!alive) return;
      if (yes) setRetired(true);
      else void readBuilder();
    });
    return () => {
      alive = false;
    };
  }, [signedIn, reload]);
  const close = useCallback(() => setOpen(false), []);
  return {
    retired,
    builder: label && !retired ? (
      <button type="button" data-assistant-builder-open="" onClick={() => setOpen(true)} className="mr-auto flex items-center gap-1.5 px-0.5 py-1.5 text-[15px] font-medium text-foreground">
        {label}
        <span aria-hidden className="text-[20px] leading-none text-muted-foreground">›</span>
      </button>
    ) : null,
    sheet: open && !retired ? <AssistantBuilder onClose={close} /> : null,
  };
}

/** The backend's own words for the setup's first tap (`chat_setup.SET_UP_MY_CHAT`). */
export const SET_UP_MY_CHAT = "Set up my chat";
