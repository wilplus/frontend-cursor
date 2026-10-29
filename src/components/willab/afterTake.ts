import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { OfferType } from "./loungeOffers";

/* -------------------------------------------------------------------------- */
/*  afterTake — one action at a time after a Take (founder 2026-10-20: "You   */
/*  cannot have two actions at a time, like feedback and record"; backend     */
/*  services/after_take.py).                                                   */
/*                                                                            */
/*  After the Feedback walk the chat shows the Take's card and its summary,   */
/*  then the asks one at a time, then the closing message with "Record Take  */
/*  N" (founder 2026-10-20, N89). The backend stores the closing message held */
/*  back (metadata.next_take, held_for the ask in front of the speaker) while */
/*  the chain runs; the chat does not draw it, and the backend advances the   */
/*  chain under whatever closed each ask (a tap, a typed turn, the form       */
/*  closing). In the chain's first form the summary itself was the held row  */
/*  (metadata.summary); a row of that form still waiting is read the same.   */
/* -------------------------------------------------------------------------- */

type Meta = Pick<LoungeMessage, "metadata">;

/** The row that waits behind the Take's asks: the closing message (N89), or
 *  the summary of the chain's first form. */
function heldRow(meta: Record<string, unknown>): boolean {
  return meta.next_take === true || meta.summary === true;
}

/** The ask a message after a Take waits for, or null when it is drawn. */
export function heldFor(m: Meta): string | null {
  const meta = m.metadata ?? {};
  return heldRow(meta) && typeof meta.held_for === "string" && meta.held_for ? meta.held_for : null;
}

/** The newest message still held back (messages oldest first), or null. */
export function heldMessage<T extends Meta>(messages: readonly T[]): T | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (heldFor(messages[i]) !== null) return messages[i];
  }
  return null;
}

/** The waiting message's Take, for the ask's bubble to carry (D4). */
export function heldTake(waiting: Meta | null): string | null {
  const take = waiting?.metadata?.take_session_id;
  return typeof take === "string" && take ? take : null;
}

/** The waiting message's id when it waits for this ask, else null. */
export function waitingFor(waiting: (Meta & Pick<LoungeMessage, "client_id">) | null, ask: string): string | null {
  return waiting && heldFor(waiting) === ask ? waiting.client_id : null;
}

/** The Take a row of the summary's batch belongs to: the message after the
 *  Take, or the ask that follows it. An ask stamped only with the message
 *  it waits for (`after_take`, the admin's asks until 2026-10-20) belongs
 *  to that message's Take. */
function batchTake(m: Pick<LoungeMessage, "metadata">, takeOfAfter: ReadonlyMap<string, string>): string | null {
  const meta = m.metadata ?? {};
  const after = typeof meta.after_take === "string" ? takeOfAfter.get(meta.after_take) : undefined;
  const take = typeof meta.take_session_id === "string" ? meta.take_session_id : after;
  if (typeof take !== "string") return null;
  return heldRow(meta) || typeof meta.offer === "string" ? take : null;
}

function isEnd(m: Pick<LoungeMessage, "kind" | "metadata">, take: string): boolean {
  return m.kind === "walk_step" && m.metadata?.step === "end" && m.metadata?.take_session_id === take;
}

/** The thread as drawn after a Take (lock 2026-10-12, section 3, and founder
 *  2026-10-20): a message still held back is not drawn, and each review's
 *  card comes before its Take's batch. The batch is written while the walk's
 *  summary step shows and the card when the speaker moves past it, so the
 *  card is moved up to the batch's first row. */
export function afterTakeOrder<T extends { message: Pick<LoungeMessage, "kind" | "metadata"> & { client_id?: string } }>(items: readonly T[]): T[] {
  // Each message after a Take, by its id, for the asks stamped with it alone
  // (founder 2026-10-20: the card landed between the question and its
  // buttons because the question did not count as the Take's).
  const takeOfAfter = new Map<string, string>();
  for (const { message } of items) {
    const meta = message.metadata ?? {};
    if (meta.summary === true && typeof meta.take_session_id === "string" && typeof message.client_id === "string") {
      takeOfAfter.set(message.client_id, meta.take_session_id);
    }
  }
  const out = items.filter((item) => heldFor(item.message) === null);
  for (let i = 0; i < out.length; i += 1) {
    const take = batchTake(out[i].message, takeOfAfter);
    if (take === null) continue;
    const end = out.findIndex((x, j) => j > i && isEnd(x.message, take));
    if (end < 0) continue;
    out.splice(i, 0, ...out.splice(end, 1));
    i += 1;
  }
  return out;
}

/** The ask of a Take's batch the chat opens by itself: the newest drawn
 *  bubble when it is WhatsApp or the home screen asked after a Take. */
export function askToOpen(
  drawn: readonly Pick<LoungeMessage, "client_id" | "metadata">[],
): { id: string; type: Extract<OfferType, "whatsapp" | "install"> } | null {
  const last = drawn[drawn.length - 1];
  const meta = last?.metadata ?? {};
  if (typeof meta.take_session_id !== "string") return null;
  return meta.offer === "whatsapp" || meta.offer === "install" ? { id: last.client_id, type: meta.offer } : null;
}

/** Is an ask still in front of the speaker? A form is open in the footer,
 *  or the newest drawn bubble is an ask (an offer, or "What would help?").
 *  A message held back while none is would never show, so it is let go. */
export function askShowing(drawn: readonly Meta[], formOpen: boolean): boolean {
  if (formOpen) return true;
  const meta = drawn[drawn.length - 1]?.metadata ?? {};
  return typeof meta.offer === "string" || meta.feedback_check === "missing";
}

/** The bubbles above the chat's newest recording, in any project (messages
 *  oldest first): none of them keeps "Record Take N", so the chat's one
 *  record button is the newest Take's (N244, N251). */
export function recordedPast(messages: readonly Pick<LoungeMessage, "client_id" | "kind">[]): ReadonlySet<string> {
  const newest = messages.findLastIndex((m) => m.kind === "recording_summary");
  return new Set(messages.slice(0, Math.max(newest, 0)).map((m) => m.client_id));
}
