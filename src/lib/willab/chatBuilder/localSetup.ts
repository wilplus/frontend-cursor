/* The talk's draft, as the Build table reads it. Nothing here calls the
   network. A host who finished on this device still has rows to open. */

import { useEffect, useState } from "react";
import { OUT, SEND, W, WHO_LINE } from "@/components/willab/chats/hostsetup/hostSetupCopy";
import type { HostRecipe, SendKind, SetupPart, SetupRead } from "@/services/api/hostSetup";
import { OWN_CHAT_EVENT, readOwnChat } from "./ownChat";
import { markTileStep } from "./tileSteps";
import { readTalkDraft, TALK_DRAFT_EVENT, type TalkBuilt } from "./talkDraft";

const SENDS = ["rec", "text", "photo", "file"] as const;
const OUTS = ["answer", "words", "todo", "mark"] as const;

export function setupFromTalk(built: TalkBuilt | null): SetupRead | null {
  const chat = built?.definition.chat;
  if (!chat?.spec) return null;
  const name = readOwnChat().name || chat.name || chat.spec;
  const hello = chat.hello || "Hi.";
  const fallback: SendKind[] = ["rec", "text"];
  const send = chat.send.length ? chat.send : fallback;
  const questions = chat.questions.length ? chat.questions : [{ q: "What do you want to know?" }];
  const taps = chat.taps.length ? chat.taps : ["Ask"];
  const walk = send.includes("rec") ? (["best", "fix", "words"] as const) : [];
  const recipe: HostRecipe = {
    spec: chat.spec,
    suggest: {
      line: [chat.line || chat.spec],
      name: [name],
      send: [...SENDS],
      out: [...OUTS],
      hello: [hello],
      qs: questions.map((item) => item.q),
      taps: [taps],
      models: [{ q: "Ok?", opts: ["Yes", "No"], says: "" }],
      sample_in: "",
      sample_out: "",
      walk: { steps: ["best", "fix", "words"], out: "ideal_text" },
    },
    line: chat.line || chat.spec,
    name,
    send: [...send],
    out: chat.out,
    hello,
    questions,
    taps,
    starters: taps.slice(0, 3),
    smart: false,
    way: "own",
    models: [],
    who: chat.who,
    share: false,
    price: 0,
    cost: { people: 0, sends: 0 },
    live: false,
    care: chat.care,
  };
  const parts: SetupPart[] = [
    { part: "what", title: "What you do", value: chat.spec },
    { part: "name", title: "Name", value: name },
    { part: "hello", title: "First line", value: hello },
    { part: "send", title: "They send", value: send.map((kind) => SEND[kind][0]).join(" · ") },
    { part: "questions", title: "Questions", value: questions.map((item) => item.q).join(" · ") },
    { part: "taps", title: "Taps", value: taps.join(" · ") },
    { part: "starters", title: "Questions people tap first", value: taps.slice(0, 3).join(" · ") },
    { part: "out", title: "They get back", value: OUT[chat.out][0] },
    { part: "who", title: "Who answers", value: WHO_LINE[chat.who] },
  ];
  if (walk.length) {
    parts.push({ part: "walk", title: "The walk", value: walk.map((id) => W.walkSteps[id]).join(" · ") });
  }
  parts.push({
    part: "code",
    title: W.codeTitle,
    value: built?.codeLine?.trim()
      ? built.codeLine
      : built?.code?.trim()
        ? W.codeAdded
        : built?.codeAsked
          ? W.codeNone
          : W.codeHint,
  });
  return {
    recipe,
    parts,
    own_chat: { title: name, line: hello, link: null },
    cost: null,
    skipped_models: [],
    spec_guess: null,
    price_changes: [],
    can_try: false,
  };
}

/** Every settings row has an answer. The code hint is still a question. */
export function settingsAnswered(built: TalkBuilt | null): boolean {
  const parts = setupFromTalk(built)?.parts ?? [];
  if (!parts.length) return false;
  return parts.every((part) => {
    const value = part.value.trim();
    return Boolean(value) && value !== W.notSet && value !== W.codeHint;
  });
}

/** The draft on this device, refreshed when the talk saves. */
export function useLocalSetup(): SetupRead | null {
  const [read, setRead] = useState<SetupRead | null>(null);
  useEffect(() => {
    const sync = () => {
      const built = readTalkDraft();
      setRead(setupFromTalk(built));
      markTileStep("settings", settingsAnswered(built));
    };
    sync();
    window.addEventListener(TALK_DRAFT_EVENT, sync);
    window.addEventListener(OWN_CHAT_EVENT, sync);
    return () => {
      window.removeEventListener(TALK_DRAFT_EVENT, sync);
      window.removeEventListener(OWN_CHAT_EVENT, sync);
    };
  }, []);
  return read;
}
