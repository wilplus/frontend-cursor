/* The talk's finished chat, kept on this device. Nothing here calls the
   network, so a draft cannot reach production. Recording, Ideal Text and
   the walk read it through usePublishedCoach. */

import { speakingCoachSeed } from "./seed";
import { markTileStep } from "./tileSteps";
import type { CoachDefinition, PluginType } from "./types";

export const TALK_DRAFT_KEY = "wlp-talk-draft";
export const TALK_DRAFT_EVENT = "wlp-talk-draft";

export type TalkWho = "shadow" | "you" | "assistant";
export type TalkSend = "rec" | "text" | "photo" | "file";

export type TalkPlugin = { id: string; hash: string; interventionType: PluginType };

/** What the talk has decided. The definition is built from this. */
export type TalkSnap = {
  spec: string;
  send: TalkSend[];
  walk: string[];
  who: TalkWho;
  pay: boolean;
  price: number;
  machine: boolean;
  connect: boolean;
  model: string;
  otherModels: string[];
  code: boolean;
  paste: string;
  plugin: TalkPlugin | null;
  /** The first line people hear. Empty means the document's own line. */
  hello: string;
};

export type TalkBuilt = {
  definition: CoachDefinition;
  sends: TalkSend[];
  models: string[];
  otherModels: string[];
  pricing: { pay: boolean; price: number };
  api: boolean;
  machine: boolean;
  code: string;
  interaction: TalkWho;
  /** True only after Publish. A draft is never sent to production. */
  published: boolean;
  /** The talk has reached the preview. An unfinished draft stays false. */
  ready?: boolean;
  /** The host answered the code question, including No. */
  codeAsked?: boolean;
};

let memory: TalkBuilt | null = null;

function speakingCoach(snap: TalkSnap): boolean {
  return snap.spec === "Speaking coach"
    && snap.send.join(",") === "rec,text"
    && snap.walk.join(",") === "best,fix,words"
    && snap.who === "shadow"
    && !snap.pay && snap.price === 0
    && !snap.connect && snap.model === ""
    && snap.otherModels.length === 0
    && !snap.code && snap.paste === "" && snap.plugin === null
    && (snap.hello === "" || snap.hello === "Hi. Record a short talk, and I'll tell you what worked.");
}

/** The coach document for a finished talk. The speaking-coach answers
    are the fixture's document, field for field. */
export function talkBuilt(snap: TalkSnap): TalkBuilt {
  const definition = speakingCoach(snap) ? speakingCoachSeed() : shop(snap);
  return {
    definition,
    sends: [...snap.send],
    models: snap.model ? [snap.model] : [],
    otherModels: [...snap.otherModels],
    pricing: { pay: snap.pay, price: snap.price },
    api: snap.connect,
    machine: snap.machine,
    code: snap.paste,
    interaction: snap.who,
    published: false,
  };
}

function shop(snap: TalkSnap): CoachDefinition {
  const base = speakingCoachSeed();
  const plugins = snap.plugin
    ? [{ id: snap.plugin.id, hash: snap.plugin.hash, role: "detector" as const, interventionType: snap.plugin.interventionType }]
    : [];
  return {
    ...base,
    name: snap.spec || base.name,
    chat: {
      ...base.chat,
      spec: snap.spec || base.chat.spec,
      name: snap.spec || null,
      send: snap.send.length ? [...snap.send] : base.chat.send,
      who: snap.who,
      hello: snap.hello || (snap.spec === "Speaking coach" ? base.chat.hello : "Your chat is ready."),
    },
    plugins,
  };
}

function rememberDraftSteps(): void {
  markTileStep("build", memory?.ready === true);
  markTileStep("ai", Boolean(memory && (memory.models.length > 0 || memory.otherModels.length > 0)));
  if (!memory) markTileStep("settings", false);
}

function persist(): void {
  try {
    if (memory) sessionStorage.setItem(TALK_DRAFT_KEY, JSON.stringify(memory));
  } catch {
    /* a private window keeps the draft in memory for this page */
  }
  rememberDraftSteps();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TALK_DRAFT_EVENT));
}

export function saveTalkDraft(built: TalkBuilt): void {
  memory = {
    ...built,
    published: memory?.published === true,
    ready: built.ready === true || memory?.ready === true,
    codeAsked: built.codeAsked === true || memory?.codeAsked === true,
  };
  persist();
}

/** The talk setup is finished, or it has been undone. Stays on this device. */
export function markTalkReady(on: boolean): void {
  const current = readTalkDraft();
  if (!current) return;
  memory = { ...current, ready: on };
  persist();
}

/** Marks the draft live on this device. Does not call the network. */
export function publishTalkDraft(): void {
  const current = readTalkDraft();
  if (!current) return;
  memory = { ...current, published: true };
  persist();
}

export function readTalkDraft(): TalkBuilt | null {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(TALK_DRAFT_KEY);
    if (!raw) return null;
    const built = JSON.parse(raw) as TalkBuilt;
    if (built?.definition?.schema !== 1) return null;
    memory = built;
    return built;
  } catch {
    return null;
  }
}

export function readTalkDefinition(): CoachDefinition | null {
  return readTalkDraft()?.definition ?? null;
}

/** Keeps a piece of code on this device. Does not call the network. */
export function saveTalkCode(paste: string): void {
  const current = readTalkDraft();
  if (!current) return;
  memory = { ...current, code: paste, codeAsked: true };
  persist();
}

export function clearTalkDraft(): void {
  memory = null;
  try {
    sessionStorage.removeItem(TALK_DRAFT_KEY);
  } catch {
    /* already gone */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TALK_DRAFT_EVENT));
}
