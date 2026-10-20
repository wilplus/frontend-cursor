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

function lineOf(message: LoungeMessage, facts: ScreenFacts): ChatHistoryEntry | null {
  const meta = message.metadata ?? {};
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
  if (meta.summary === true && meta.written === false && body) {
    // The signed fallback, shown when the written summary failed (founder
    // 2026-10-20): Will knows the specifics are missing and can add them.
    const take = typeof meta.take_index === "number" ? `Take ${meta.take_index}` : "this Take";
    return { role: "assistant", content: `[The app's fixed message after ${take}; the written summary failed]\n${body}` };
  }
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
