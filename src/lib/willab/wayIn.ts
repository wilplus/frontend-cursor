import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { Plan, WayInView } from "@/services/api/plan";

/* -------------------------------------------------------------------------- */
/*  The speaking way in while Take 1 is processed (rules: docs/flows/         */
/*  the-plan.md §2; backend `services/way_in.py`, N453, N564 item 1, N572,    */
/*  N573, N590, N592). The backend writes each beat as a row of Will's chat   */
/*  with `metadata.way_in` naming it; this reads those rows and the plan's    */
/*  `way_in` view. Pure: the drawing is `components/willab/plan/WayIn.tsx`.   */
/* -------------------------------------------------------------------------- */

/** The backend's words this side matches or draws (signed: N453, N564,
 *  N572, N573; N592 approved). Every other line comes in the rows. */
export const WAY_IN_WORDS = {
  somethingElse: "Something else",
  pickDate: "Pick a date",
  noDate: "No date yet",
  ready: "Your feedback is ready.",
  openFeedback: "Open your feedback ›",
  copyLink: "Copy my link ›",
  joinQuestions: "Your questions for people who join ›",
} as const;

/** How often the app asks the way in for the beats that are due while it
 *  waits on the Take's reading (the backend PR's hand-off: every few
 *  seconds; each call is idempotent). */
export const WAY_IN_POLL_MS = 5_000;

type Meta = Record<string, unknown>;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** The beat a row of the way in belongs to, or null for any other row. */
export function wayInBeat(message: Pick<LoungeMessage, "metadata">): string | null {
  const beat = (message.metadata as Meta | null | undefined)?.way_in;
  return typeof beat === "string" ? beat : null;
}

/** The way in on this plan, once begun. */
export function wayInOf(plan: Plan | null | undefined): WayInView | null {
  return plan?.way_in ?? null;
}

/** A way to go is drawn with its ›, by `ChatLink`: the backend's label
 *  without its trailing " ›". */
export function linkLabel(label: string): string {
  return label.replace(/\s*›$/, "");
}

/** What waits for the speaker's answer, read from the newest of Will's way
 *  in rows and the plan's open beat. */
export type WayInAsk =
  /** Taps: "That's right" / "Change it", "Pick a date" / "No date yet",
   *  "I agree". */
  | { kind: "taps"; beat: string; chips: string[] }
  /** The first choice: several, then "Send"; "Something else" opens the
   *  typing box (N573 item 1). */
  | { kind: "choice"; beat: string; chips: string[] }
  /** Will asks for words out loud ("Tell me what to change."). */
  | { kind: "voice"; beat: string }
  /** After the walk, "Tell me what you'd like to do, and I'll show you
   *  where.": the typing box (N592 item 2). */
  | { kind: "words"; beat: "else" };

/** The newest row of the way in, Will's or the speaker's; other rows (the
 *  walk, the plan card, the questions for people who join) don't count. */
function newestWayInRow(messages: readonly LoungeMessage[]): LoungeMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (wayInBeat(messages[i]) !== null) return messages[i];
  }
  return null;
}

/** The answer that waits, or null: Will's newest way in row is the open
 *  beat's, and no answer of the speaker's came after it. */
export function wayInAsk(messages: readonly LoungeMessage[], plan: Plan | null): WayInAsk | null {
  const view = wayInOf(plan);
  const row = newestWayInRow(messages);
  if (!view || !row || row.role === "user") return null;
  const meta = (row.metadata ?? {}) as Meta;
  if (meta.way_in_asks === "else") return view.walk_done ? { kind: "words", beat: "else" } : null;
  const beat = wayInBeat(row) as string;
  if (beat !== view.asking) return null;
  if (meta.plan_ask === "way_in_voice") return { kind: "voice", beat };
  const chips = strings(meta.chips);
  if (chips.length === 0) return null;
  return meta.multi === true ? { kind: "choice", beat, chips } : { kind: "taps", beat, chips };
}

/** The way in asks the backend again: while Take 1 is processed, and once
 *  begun while no beat waits for an answer and the beats are not over. */
export function wayInPolls(plan: Plan | null, firstTakeInFlight: boolean): boolean {
  const view = wayInOf(plan);
  if (!view) return plan?.first_take === true && firstTakeInFlight;
  return !view.walk_done && !view.asking && !view.done.includes("next");
}

/** "Record Take 2" stays faded until the walk is done (N592 item 3). */
export function recordWaits(plan: Plan | null): boolean {
  const view = wayInOf(plan);
  return view !== null && !view.record_next;
}

/** The Take that is processed is Take 1 of the way in: the thin row on top
 *  of Will's chat stands in for the full wait, and the walk waits for the
 *  speaker's tap (N453 items 1 and 7). */
export function firstTakeWayIn(plan: Plan | null): boolean {
  const view = wayInOf(plan);
  return view ? !view.walk_done : plan?.first_take === true;
}

/** Take 1's project, from its row in the thread: what "Open your feedback ›"
 *  opens once the processing is over. */
export function firstTakeArcOf(messages: readonly LoungeMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = (messages[i].metadata ?? {}) as Meta;
    if (meta.take_index === 1 && typeof meta.arc_id === "string") return meta.arc_id;
  }
  return null;
}

/** The profile card in a row (slide 1 only, N453 item 2). */
export type WayInProfile = { name: string | null; role: string | null; about: string | null; topics: string[] };

export function profileOf(message: Pick<LoungeMessage, "metadata">): WayInProfile | null {
  const raw = (message.metadata as Meta | null | undefined)?.way_in_profile;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Meta;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return { name: text(p.name), role: text(p.role), about: text(p.about), topics: strings(p.topics) };
}

/** The ways to go under a row: "You're set."'s links for sharers, or "Open
 *  your feedback ›" once the feedback is ready. */
export function rowLinks(message: Pick<LoungeMessage, "metadata">): string[] {
  const meta = (message.metadata ?? {}) as Meta;
  const links = strings(meta.links);
  if (meta.opens === "feedback") return [...links, ...strings(meta.chips)];
  return links;
}
