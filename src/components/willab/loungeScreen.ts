import type { ChatHistoryEntry } from "@/services/api/chatQuery";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { readOfferType } from "./loungeOffers";

/* -------------------------------------------------------------------------- */
/*  loungeScreen — the chat as Will reads it (founder 2026-10-20: "the         */
/*  conversational chat should be aware of the order of bubbles it            */
/*  displays").                                                                */
/*                                                                            */
/*  Every bubble the Lounge draws, in the order it draws them, so a reply     */
/*  answers what sits right above it: the Take's card (with the coach's       */
/*  feedback waiting on it, when the stroke and dot are on), the summary,     */
/*  the ask, the speaker's taps and words. A card is told to Will in square   */
/*  brackets; those lines are never shown to anyone. Pure.                    */
/* -------------------------------------------------------------------------- */

/** How many of the screen's bubbles Will reads (the backend keeps 40). */
export const SCREEN_TURNS = 40;

export interface ScreenFacts {
  /** A Take's Feedback walk (N192): the Take and its summary, which is
   *  inside the walk and no longer a bubble of its own. Null: not one. */
  walkOf?: (message: LoungeMessage) => { take: number | null; summary: string | null } | null;
  /** A review's end card: the talk's title and the Take, as the card shows. */
  cardOf: (message: LoungeMessage) => { title: string; take: number | null } | null;
  /** The card wears the orange stroke and dot: the coach's feedback waits. */
  coachWaits: (message: LoungeMessage) => boolean;
}

/** Version bubbles that are not the project's Ideal Text card. */
const NOT_A_CARD = new Set(["instant", "ideal_text_unconfirmed", "coach_feedback_published", "take_processed"]);

function cardLine(title: string | null, take: string | null, coach: boolean): string {
  const name = title ? `"${title}"` : "their talk";
  const card = `[On screen: the Ideal Text card of ${name}${take ? `, ${take}` : ""}.`;
  return coach
    ? `${card} It wears the orange stroke and dot: the coach's feedback is in and not opened yet; a tap opens it.]`
    : `${card} A tap opens the text.]`;
}

function versionOf(meta: Record<string, unknown>): string | null {
  const v = typeof meta.version === "number" ? meta.version : Number(meta.version);
  return Number.isFinite(v) && v > 0 ? `version ${v}.0` : null;
}

function walkLine(walk: { take: number | null; summary: string | null }): string {
  const name = walk.take ? `Take ${walk.take}` : "the Take";
  const line = `[On screen: the Feedback walk of ${name}, one bubble holding its feedback; a tap opens the walk.]`;
  return walk.summary ? `${line}\n[Inside it, the Take's summary:]\n${walk.summary}` : line;
}

/** The summary's signed line, as Will reads it: shown when the written
 *  summary failed (founder 2026-10-20), so Will knows the specifics are
 *  missing and can add them; while `writing` is true it is "not yet", never
 *  failed (WILL-07): the backend writes it at once and GPT-4o's words
 *  replace it in place. Null: not the signed line. */
function signedSummaryLine(meta: Record<string, unknown>, body: string): ChatHistoryEntry | null {
  if (meta.summary !== true || meta.written !== false || !body) return null;
  const take = typeof meta.take_index === "number" ? `Take ${meta.take_index}` : "this Take";
  const state = meta.writing === true ? "the written summary is not in yet" : "the written summary failed";
  return { role: "assistant", content: `[The app's fixed message after ${take}; ${state}]\n${body}` };
}

function lineOf(message: LoungeMessage, facts: ScreenFacts): ChatHistoryEntry | null {
  const meta = message.metadata ?? {};
  const walk = facts.walkOf?.(message);
  if (walk) return { role: "assistant", content: walkLine(walk) };
  const role = message.role === "user" ? "user" : "assistant";
  const body = message.body.trim();
  if (readOfferType(meta)) return body ? { role: "assistant", content: body } : null;
  if (message.kind === "walk_step" && meta.step === "end") {
    const card = facts.cardOf(message);
    const take = card?.take ? `Take ${card.take}` : null;
    return { role: "assistant", content: cardLine(card?.title ?? null, take, facts.coachWaits(message)) };
  }
  if (message.kind === "ideal_text") {
    if (typeof meta.variant === "string" && NOT_A_CARD.has(meta.variant)) return null;
    const title = typeof meta.topic === "string" && meta.topic.trim() ? meta.topic.trim() : null;
    return { role: "assistant", content: cardLine(title, versionOf(meta), facts.coachWaits(message)) };
  }
  const signed = signedSummaryLine(meta, body);
  if (signed) return signed;
  if (message.kind === "recording_summary") {
    const title = typeof meta.topic === "string" && meta.topic.trim() ? ` of "${meta.topic.trim()}"` : "";
    const take = typeof meta.take_index === "number" ? `, Take ${meta.take_index}` : "";
    return { role: "user", content: `[On screen: their recording${title}${take}.]` };
  }
  if (["text", "joke", "cadence", "walk_step"].includes(message.kind) && body) return { role, content: body };
  return null;
}

/** The screen, oldest first, as {role, content}: `messages` in the order the
 *  Lounge draws them. */
export function screenHistory(messages: readonly LoungeMessage[], facts: ScreenFacts): ChatHistoryEntry[] {
  const lines: ChatHistoryEntry[] = [];
  for (const message of messages) {
    const line = lineOf(message, facts);
    if (line) lines.push(line);
  }
  return lines.slice(-SCREEN_TURNS);
}
