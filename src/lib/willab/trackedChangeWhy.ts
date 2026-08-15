import type { ChangeWhy, SwapWhy } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  THE REASON LINE — every string a tracked change can say about itself.      */
/*                                                                            */
/*  ONE HOME, on purpose. The BE sends a KEY and the FE holds the copy, which  */
/*  is what makes the LIVE LOOP fence enforceable: a model-authored sentence   */
/*  arriving on the payload cannot render, because nothing renders except what */
/*  is written here. Copy scattered across components is copy nobody can       */
/*  audit, and this is exactly the surface that must stay auditable.           */
/*                                                                            */
/*  A PLAIN MODULE, not a component, so the fence is testable — vitest cannot  */
/*  parse this project's .tsx, so copy living in a component can only be       */
/*  checked by reading the file as text.                                       */
/*                                                                            */
/*  TWO VOCABULARIES, DELIBERATELY NOT MERGED.                                 */
/*                                                                            */
/*    the four SwapWhy keys — CROSS-TAKE COMPARISON. Every sentence compares   */
/*      this take against another one, so they are only true when a second     */
/*      take exists: `prior_take` and `new_take`, nowhere else.                */
/*    clarity / emphasis   — the non-comparison lanes (founder 2026-08-07).    */
/*                                                                            */
/*  The split is on what the change DOES to the text, not on which lane        */
/*  emitted it — the same composition/accentuation line the locking spec       */
/*  draws (SPEC-parts-locking-and-layers §2). "Helps your main point stand     */
/*  out" says nothing true about a word swap; "sounds smoother and easier to   */
/*  follow" says nothing about a bold. Reusing a comparison key here would     */
/*  have printed "This take simply landed better overall." beside a polish     */
/*  star — a sentence about a second take that does not exist in that lane.    */
/* -------------------------------------------------------------------------- */

/** The one fixed line behind each swap reason. Closed key set (BE-clamped);
 *  anything else renders NO line — never guess. */
export const WHY_COPY: Record<SwapWhy, string> = {
  energy: "This take carried more energy in the delivery.",
  steadiness: "This take gave the words more room to breathe.",
  coverage: "This take stayed tighter to your slide.",
  overall: "This take simply landed better overall.",
};

/** `clarity` — the change ALTERS THE WORDS (polish / say-it-stronger). */
export const CLARITY_WHY = [
  "This makes your message clearer.",
  "This sounds smoother and easier to follow.",
  "This helps your words flow better.",
  "This makes your point easier to understand.",
  "This gives your message a cleaner finish.",
] as const;

/** `confident_voice` — the ONE founder-signed body of the Confident Voice
 *  card (§17 acoustic-confidence-v1, 2026-08-14). Purely positive, fixed —
 *  no variants: praise that rewords itself reads as the system hedging. */
export const CONFIDENT_VOICE_WHY =
  "You sounded incredibly confident and natural here.";

/** `emphasis` — the change STYLES WORDS ALREADY THERE. */
export const EMPHASIS_WHY = [
  "This helps your main point stand out.",
  "This makes the key idea clearer.",
  "This gives your message more focus.",
  "This helps people notice what matters most.",
  "This makes your core message stronger.",
] as const;

/* -------------------------------------------------------------------------- */
/*  THE PRAISE LANE (founder 2026-08-15)                                       */
/*                                                                            */
/*  "if the delivery was impeccable, just give them the feedback in the praise */
/*  lane and in the justification of the positive feedback give them the       */
/*  playback of that phrase emphasising that it was said really well and       */
/*  explain using the vocal and verbal cues."                                  */
/*                                                                            */
/*  So the praise has three parts and the middle one is the point: a LEAD that */
/*  says it landed, the CUES that say why we think so, and the recording so    */
/*  they can hear it. Praise without its evidence is flattery, and flattery    */
/*  from a coaching product is worse than silence — it teaches the student to  */
/*  discount every later compliment.                                           */
/*                                                                            */
/*  EVERY SENTENCE IS RELATIVE TO THEM. The cues are z-scored against the      */
/*  speaker's OWN baseline upstream, so "more than you usually do" is the      */
/*  literal truth of the measurement and "more than other people" would be a   */
/*  claim we never made. No number, no comparison to anyone else (AC-9).       */
/*                                                                            */
/*  Copy is the founder's to adjust — written to his brief, not signed off     */
/*  word by word.                                                             */
/* -------------------------------------------------------------------------- */

/** `impeccable` — the one line that says the delivery landed. Fixed, no
 *  variants: praise that rewords itself reads as the system hedging, the same
 *  reason the Confident Voice body has exactly one form. */
export const PRAISE_LEAD = "You said this one really well.";

/** The line under the lead, before the cues. */
export const PRAISE_CUE_LEAD = "Here is what your voice did:";

/** ONE SENTENCE PER CUE KEY — the BE's closed delivery-cues vocabulary.
 *
 *  A key with no entry renders NOTHING, exactly like an unknown `why`: an
 *  unexplained compliment is the failure mode this whole block exists to
 *  avoid, and inventing a sentence for a cue we do not have copy for is how
 *  it would happen. */
export const PRAISE_CUE_COPY: Record<string, string> = {
  wide_range: "Your pitch moved — you let it rise and fall instead of holding it flat.",
  even_pitch: "Your pitch stayed steady, with none of the wobble that creeps in when you are unsure.",
  full_volume: "You let the volume move, so the words had shape rather than one level.",
  no_hesitation: "You went straight through it — fewer and shorter pauses than you usually take.",
  settled_pitch: "Your voice sat lower than it usually does, which is what settled sounds like.",
  kept_moving: "You kept the pace up instead of slowing down the way people do when they hedge.",
  landed_ending: "You brought the ending down and landed it, rather than letting it drift up.",
  opened_strong: "You led with the energy and eased off after, instead of building up to it.",
};

/** The praise lines for one change: the lead, then a sentence per cue we have
 *  copy for. Never a lead alone with an empty explanation — that is the
 *  unevidenced compliment — so a change whose cues are all unknown returns
 *  just the lead and the caller renders the recording beside it. Pure. */
export function praiseLines(cueKeys: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of cueKeys) {
    const line = PRAISE_CUE_COPY[key];
    if (line && !seen.has(key)) {
      seen.add(key);
      out.push(line);
    }
  }
  return out;
}

/** A stable index from a change's id.
 *
 *  DETERMINISTIC ON PURPOSE. The variants exist so three changes on one
 *  document do not read as three copies of one sentence — but a RANDOM pick
 *  would re-roll on every render and every reload, and a reason line that
 *  rewords itself while you look at it reads as the system changing its mind
 *  about the advice. Same change → same sentence, forever; different changes
 *  → different sentences.
 *
 *  No strength requirement: it spreads short ids over five buckets and nothing
 *  downstream depends on the distribution being uniform. */
export function variantIndex(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % n;
}

/** The reason line for one change, or null when it has no key.
 *
 *  ONE resolver, so "where did this sentence come from" has one answer. An
 *  unrecognised key returns null rather than a fallback sentence: a reason
 *  line the system cannot justify is worse than no reason line. */
export function whyLine(
  change: { id: string; why: ChangeWhy | null }
): string | null {
  const why = change.why;
  if (!why) return null;
  if (why === "clarity") {
    return CLARITY_WHY[variantIndex(change.id, CLARITY_WHY.length)];
  }
  if (why === "emphasis") {
    return EMPHASIS_WHY[variantIndex(change.id, EMPHASIS_WHY.length)];
  }
  if (why === "confident_voice") {
    return CONFIDENT_VOICE_WHY;
  }
  return WHY_COPY[why] ?? null;
}
