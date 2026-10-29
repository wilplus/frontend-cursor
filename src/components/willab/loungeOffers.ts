import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  loungeOffers — the Lounge's actionable "offers" as durable thread entries  */
/*                                                                            */
/*  Install (F2) and the legacy bad-joke offer (F7) are no                      */
/*  longer transient footer popups: each is appended to the Lounge thread as a  */
/*  real, persisted bubble (kind "text" + a metadata discriminator, so it rides */
/*  the existing lounge_messages contract with no new BE kind). The bubble is   */
/*  clickable — re-opening it re-arms its action pair in the footer — and its    */
/*  resolution is registered in the thread like any other turn.                 */
/*                                                                            */
/*  The action buttons themselves live in the footer (replacing the record CTA  */
/*  while an offer is open); button labels stay with that UI because install's  */
/*  vary by platform. Here we own only the persisted shape + the prompt copy.   */
/* -------------------------------------------------------------------------- */

/** The credit gate ("credit") is GONE with the credits system (founder
 *  2026-07-31). It was already unreachable: the BE hardcodes
 *  `can_start_analysis: True` ("every arc records/analyzes/sends free"), so the
 *  gate could not fire. Legacy `offer: "credit"` bubbles in old threads still
 *  render as ordinary bot text, which is exactly what the fallback was for. */
export type OfferType =
  | "install"
  | "whatsapp"
  | "joke"
  | "consent"
  | "promo"
  | "lesson"
  | "feedback_check"
  | "voice_notebook"
  | "sunday_note"
  | "life_goals"
  | "life_goals_quarter"
  | "life_goals_change"
  | "sales_step"
  | "your_why"
  | "strengths";

const OFFER_TYPES: readonly OfferType[] = [
  "install",
  "whatsapp",
  "joke",
  "consent",
  "promo",
  "lesson",
  "feedback_check",
  "voice_notebook",
  "sunday_note",
  "life_goals",
  "life_goals_quarter",
  "life_goals_change",
  "sales_step",
  "your_why",
  "strengths",
];

/** The bubble prompt persisted as the message body. No em-dashes (house style). */
export const OFFER_PROMPT: Record<OfferType, string> = {
  // Simplified by the founder in chat, 2026-10-20. Mirrored verbatim in the
  // backend's services/chat_app_context.py OFFER_PROMPTS.
  install: "Add WillpowerLab to your home screen? Your coach is one tap away.",
  // WhatsApp (founder 2026-10-12): the second offer, after install.
  // Simplified by the founder in chat, 2026-10-20. Mirrored verbatim in the
  // backend's services/chat_app_context.py OFFER_PROMPTS.
  whatsapp: "Want a WhatsApp when your coach replies? Add your number.",
  // Consent (founder 2026-10-13, step 2): sent by the admin to one person; it
  // points to the Data & consent page, where they answer on the locked screen.
  consent:
    "One question about how we use your data is still open. You can look at it and answer yes or no.",
  // Promo / lesson (founder 2026-10-14, step 3): sent by the admin to one
  // person. The bubble carries the exact price (useAdminAsk builds it); these
  // are only the fallback if that body is ever missing.
  promo: "Artur set a price for you. See it on the pricing screen.",
  lesson: "Artur set a price for you for a 1-on-1 lesson.",
  // "Did this feedback help you?" (WIL-74, founder 2026-10-19): written by
  // the backend after a Take's closing summary; this is only the fallback.
  // Simplified by the founder in chat, 2026-10-20 (backend COPY["ask"]).
  feedback_check: "Did this help?",
  // The founder's voice notebook (Will learning plan, step 1; words signed
  // 2026-10-20): asked before the first note. Backend COPY["ask"] in
  // services/voice_notebook.py; this is only the fallback.
  voice_notebook: "Your notes are private. Only you and Will read them. Keep a voice notebook?",
  // The Sunday note as a lens (Will learning plan, step 2; backend N158
  // L2): the backend writes the case under "We spotted a pattern!" with Not
  // now | Investigate (services/sunday_note.py); this is only the fallback.
  sunday_note: "We spotted a pattern!",
  // Life goals (Will learning plan, step 3; backend N172 M1): asked after
  // the first # note, Not now | Start. Backend COPY["ask_more"] in
  // services/life_goals.py; this is only the fallback.
  life_goals: "One goal today. Say or type your answers.",
  // The quarter comes back (backend N172 M13, N186): Not now | Start. The
  // backend writes "{emoji} {step}. Did it move?"; this is only the fallback.
  life_goals_quarter: "Did it move?",
  // A note that sounds like a change (backend N172 M14, N191): Not now |
  // Change. The backend writes the ask quoting the note; this is only the
  // fallback.
  life_goals_change: "Change this quarter?",
  sales_step: "Which step did it stall at?",
  // Your why (backend N255 Q1, signed N258): Not now | Start after the first
  // goal. Backend COPY["ask_more"] in services/your_why.py; the fallback.
  your_why: "Three short questions. Say or type your answers.",
  // Strengths (backend N241 N2, signed N258): Not now | Look. Backend
  // COPY["head"] in services/strengths.py; this is only the fallback.
  strengths: "We spotted a strength!",
  joke:
    "I'm just a simple system, but I noticed you weren't feeling great before this presentation. Want me to crack a joke?",
};

/** Build the persisted offer message. role "bot" so a fallback render (if the
 *  metadata is ever stripped) still reads as an ordinary Will bubble. */
export function offerDraft(type: OfferType, body?: string): LoungeMessageDraft {
  return {
    role: "bot",
    kind: "text",
    body: body || OFFER_PROMPT[type],
    metadata: { offer: type },
  };
}

/** Defensive reader — metadata crosses the wire as Record<unknown>. Returns the
 *  offer type for an offer message, or null for any ordinary message. */
export function readOfferType(
  metadata: Record<string, unknown> | null | undefined
): OfferType | null {
  const v = metadata?.offer;
  return typeof v === "string" && (OFFER_TYPES as readonly string[]).includes(v)
    ? (v as OfferType)
    : null;
}

/** True when the thread already carries an offer of this type — the reload /
 *  re-trigger dedup guard so we never append the same offer twice. */
export function hasOffer(
  messages: Pick<LoungeMessage, "metadata">[],
  type: OfferType
): boolean {
  return messages.some((m) => readOfferType(m.metadata) === type);
}

/** How far back the chat looks for its newest ask (the backend's
 *  chat_app_context._ASK_LOOKBACK). */
const ASK_LOOKBACK = 24;

/** The newest ask the chat shows (messages in the order it draws them), or
 *  null. An ask already showing last is not asked again (founder
 *  2026-10-20): the reply that opens it opens its form. */
export function newestAsk(messages: readonly Pick<LoungeMessage, "metadata">[]): OfferType | null {
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - ASK_LOOKBACK); i -= 1) {
    const type = readOfferType(messages[i].metadata);
    if (type) return type;
  }
  return null;
}
