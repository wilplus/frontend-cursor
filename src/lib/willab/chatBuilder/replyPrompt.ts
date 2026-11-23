import { chatArtifactContent } from "@/lib/willab/chatArtifact";

/* How a visitor's message becomes a reply. The OpenAI call stays on the
   backend. This module is the rule the patch copies: who answers, the
   prompt, and what the visitor is allowed to see. No key lives here. */

export const ASSISTANT_READY = 20;
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const FILE_MAX_BYTES = 8 * 1024 * 1024;

export type ReplyOut = "answer" | "words" | "todo" | "mark";
export type ReplyWho = "shadow" | "you" | "assistant";
export type ReplyAct = "none" | "wait" | "draft" | "send";

export type ReplyExample = { ask: string; answer: string };
export type ReplyPick = { q: string; opts: string[] };

export type ReplySetup = {
  spec: string;
  hello: string;
  questions: string[];
  taps: string[];
  out: ReplyOut;
  who: ReplyWho;
  /** Health, law or money: the host sees the draft. The visitor does not. */
  care: boolean;
  examples: ReplyExample[];
  /** Answers the host has already sent. An assistant waits until 20. */
  hostAnswers: number;
};

export type ReplyExtra = {
  fileText?: string;
  hasImage?: boolean;
  picks?: ReplyPick[];
  /** Plain facts about a recording. No feeling is named. */
  voice?: string[];
};

const OUT_LINE: Record<ReplyOut, string> = {
  answer: "Answer in the host's own words. One short message.",
  words: "Tidy what the person said. Keep their meaning.",
  todo: "Give a short list of next steps.",
  mark: "Point at the spot in words.",
};

/** Who may see a model reply. "you" never calls the model. */
export function replyAct(setup: ReplySetup): ReplyAct {
  if (setup.who === "you") return "none";
  if (setup.care || setup.who === "shadow") return "draft";
  if (setup.hostAnswers < ASSISTANT_READY) return "wait";
  return "send";
}

function lines(name: string, items: string[]): string[] {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (!clean.length) return [];
  return [name, ...clean.map((item) => `- ${item}`)];
}

/** The prompt. It forbids a score or a number about the person. */
export function buildPrompt(setup: ReplySetup, message: string, extra: ReplyExtra = {}): string {
  const parts = [
    `You write for the host, who does this: ${setup.spec.trim() || "help people"}.`,
    `Their first line to a visitor is: ${setup.hello.trim() || "Hello."}`,
    OUT_LINE[setup.out],
    "Never give a score, a mark out of ten, or any number about the person.",
    "Do not name a feeling. Do not say the person is confident, nervous, calm, or anxious.",
    "Write the way a careful person speaks. Short sentences. No jargon.",
  ];
  parts.push(...lines("Questions the host asks:", setup.questions));
  parts.push(...lines("Taps a visitor can choose:", setup.taps));
  if (setup.examples.length) {
    parts.push("Examples of how the host answered:");
    for (const example of setup.examples) {
      parts.push(`Person: ${example.ask.trim()}`);
      parts.push(`Host: ${example.answer.trim()}`);
    }
  }
  if (extra.voice?.length) {
    parts.push("Facts about the recording. Use these, and do not invent a feeling:");
    parts.push(...extra.voice);
  }
  if (extra.picks?.length) {
    parts.push("Also choose one option for each question below. Use the person's photo, document, or recording when one is attached.");
    for (const pick of extra.picks) {
      parts.push(`${pick.q} Options: ${pick.opts.join(", ")}.`);
    }
  }
  if (extra.hasImage) parts.push("A photo is attached. Look at it before you answer.");
  if (extra.fileText?.trim()) {
    parts.push("Text from the file they sent:");
    parts.push(extra.fileText.trim());
  }
  parts.push(`The person sent: ${message.trim()}`);
  return parts.filter(Boolean).join("\n");
}

/** Drop a score or a number that is about the person. A step count may stay. */
export function stripPersonScores(text: string): string {
  return text
    .replace(/\b\d{1,3}\s*\/\s*10\b/g, "")
    .replace(/\b\d{1,3}\s*%/g, "")
    .replace(/\bscore\s*(of|is|:)?\s*\d+(\.\d+)?\b/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.!?])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
}

export function fileTooBig(kind: "photo" | "file", bytes: number): boolean {
  return bytes > (kind === "photo" ? PHOTO_MAX_BYTES : FILE_MAX_BYTES);
}

export type ServerReply = {
  preview?: boolean;
  shown?: boolean;
  held?: boolean;
  quiet?: boolean;
  wait?: boolean;
  reply?: string | null;
  error?: "too-big" | "unreadable" | "too-long" | null;
  walk?: { key: string; text: string; at: number | null }[];
  artifact?: unknown;
};

export type VisitorKind = "preview" | "reply" | "held" | "host" | "wait" | "too-big" | "unreadable" | "too-long";

/** What the visitor may see. A draft is never the model text. */
export function visitorKind(body: ServerReply | null): VisitorKind {
  if (!body || body.preview) return "preview";
  if (body.error === "too-big") return "too-big";
  if (body.error === "too-long") return "too-long";
  if (body.error === "unreadable") return "unreadable";
  if (body.held) return "held";
  if (body.quiet) return "host";
  if (body.wait) return "wait";
  if (body.shown && (body.reply?.trim() || body.walk?.length || chatArtifactContent(body.artifact))) return "reply";
  return "preview";
}
