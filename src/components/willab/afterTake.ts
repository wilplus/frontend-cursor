import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { OfferType } from "./loungeOffers";

/* -------------------------------------------------------------------------- */
/*  afterTake — one action at a time after a Take (founder 2026-10-20: "You   */
/*  cannot have two actions at a time, like feedback and record"; backend     */
/*  services/after_take.py).                                                   */
/*                                                                            */
/*  After the Feedback walk the chat shows the Take's card and its summary,   */
/*  then the asks one at a time, then the goodbye, "Good job. See you next   */
/*  time." (founder 2026-10-31, N294 item 6: no push to the next Take; was    */
/*  "Look, practice makes perfect…" with "Record Take N", N89). The backend  */
/*  stores the closing message held back (metadata.next_take, held_for the    */
/*  ask in front of the speaker) while the chain runs; the chat does not draw */
/*  it, and the backend advances the chain under whatever closed each ask (a  */
/*  tap, a typed turn, the form closing). In the chain's first form the       */
/*  summary itself was the held row (metadata.summary); a row of that form    */
/*  still waiting is read the same. Under the goodbye (and the plan's        */
/*  progress, N319 item 7) the tap "I want to continue my practice"; tapping  */
/*  it, or typing that they want to practise, brings "Record Take N" under   */
/*  the chat, alone (`afterGoodbye`, N294 item 7, N296 state 4).              */
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

/** Is an ask still in front of the speaker? A form is open in the footer,
 *  or the newest drawn bubble is an ask (an offer, "What would help?", or
 *  the plan's question, whose answer lets the goodbye held behind it go,
 *  `held_for: "plan"`). A message held back while none is would never
 *  show, so it is let go. */
export function askShowing(drawn: readonly Meta[], formOpen: boolean): boolean {
  if (formOpen) return true;
  const meta = drawn[drawn.length - 1]?.metadata ?? {};
  return typeof meta.offer === "string" || meta.feedback_check === "missing" || typeof meta.plan_ask === "string";
}

/** The bubbles above the chat's newest recording, in any project (messages
 *  oldest first): none of them keeps "Record Take N", so the chat's one
 *  record button is the newest Take's (N244, N251). */
export function recordedPast(messages: readonly Pick<LoungeMessage, "client_id" | "kind">[]): ReadonlySet<string> {
  const newest = messages.findLastIndex((m) => m.kind === "recording_summary");
  return new Set(messages.slice(0, Math.max(newest, 0)).map((m) => m.client_id));
}

/** A Take recorded after `take`, in any project (messages oldest first):
 *  the chat's newest recording is another Take's (N244, N251). */
export function recordedSince(messages: readonly Pick<LoungeMessage, "kind" | "metadata">[], take: string): boolean {
  const on = messages.findLast((m) => m.kind === "recording_summary")?.metadata?.session_id;
  return typeof on === "string" && on !== take;
}

/** The tap under the goodbye after a Take (founder 2026-10-31, N294 item 6,
 *  signed). */
export const CONTINUE_PRACTICE = "I want to continue my practice";

/** The Take whose goodbye it is: "Record Take N" records the one after it. */
export type NextTake = { arcId: string; takeIndex: number; takeSessionId: string };

/** The Take a goodbye, or the speaker's choice to continue under it, names. */
export function goodbyeTake(meta: Record<string, unknown> | null | undefined): NextTake | null {
  const arcId = meta?.arc_id;
  const takeIndex = meta?.take_index;
  const takeSessionId = meta?.take_session_id;
  if (typeof arcId !== "string" || typeof takeIndex !== "number" || typeof takeSessionId !== "string") return null;
  return { arcId, takeIndex, takeSessionId };
}

/** Where the chat stands after a Take's goodbye (messages oldest first):
 *  "tap" while the goodbye, with the plan's progress under it, is the last
 *  thing said, so "I want to continue my practice" sits under it; "record"
 *  once the speaker chose to continue, so "Record Take N" stands alone under
 *  the chat; null otherwise: the goodbye still held behind an ask, anything
 *  said since, or a newer Take recorded in any project (N244, N251). The
 *  walk's own rows (a coach's later word) never count as said since.
 *  The first Take's goodbye brings "Record Take N" at once, with no tap
 *  first (backend N449 item 2): the backend marks it (`first_take`), and
 *  `noTap` names the Takes this device knows as first, for a goodbye
 *  written before the mark. */
export function afterGoodbye<T extends Pick<LoungeMessage, "client_id" | "kind" | "metadata">>(
  messages: readonly T[],
  noTap: (take: NextTake) => boolean = () => false,
): { step: "tap" | "record"; next: NextTake; message: T } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const meta = m.metadata ?? {};
    if (m.kind === "walk_step" || meta.plan_progress === true) continue;
    const said = goodbyeTake(meta);
    const step = meta.continue_practice === true
      ? "record"
      : meta.next_take === true && heldFor(m) === null
        ? said && (meta.first_take === true || noTap(said)) ? "record" : "tap"
        : null;
    const next = step ? said : null;
    if (!step || !next || recordedPast(messages).has(m.client_id)) return null;
    return { step, next, message: m };
  }
  return null;
}

const PRACTISE = /\b(practi[cs]e|practi[cs]ing|record|continue|keep going|again|next take|another take)\b/i;
const NOT_NOW = /\b(no|not|don'?t|never|later|tomorrow|stop)\b/i;

/** Typed words that say they want to practise now (N294 item 6): they bring
 *  "Record Take N" as the tap does. Pure. */
export function wantsToPractise(text: string): boolean {
  return PRACTISE.test(text) && !NOT_NOW.test(text);
}
