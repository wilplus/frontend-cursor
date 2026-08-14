import { getAuthToken } from "@/lib/api/auth-client";
import type { Part } from "@/lib/willab/documentParts";
import { MAX_DOCUMENT_CHARS } from "@/lib/willab/documentSegments";
import { markerTokenSpans } from "@/lib/willab/richMarkers";

/* -------------------------------------------------------------------------- */
/*  idealText — the arc's ONE-BLOCK ideal text (delivery layer)                */
/*                                                                            */
/*  The paywalled deliverable: auto-assembled after 3 takes, coach-edited as    */
/*  a single clean block, approved, then sent as the purple bubble. The user    */
/*  reads it in the notebook overlay (bold openings = key_phrases, underlined   */
/*  key moments deep-linking back to the feedback page) and may keep a          */
/*  PERSONAL edited copy (notes) that never touches the coach-approved          */
/*  canonical (L1).                                                            */
/*                                                                            */
/*  Safe-ahead: every call soft-fails; locked (402) and pending (404 /          */
/*  unapproved) are first-class states, not errors.                            */
/* -------------------------------------------------------------------------- */

/** MOMENT_SUGGESTIONS — the machine suggestion behind a grey star. `emphasize`
 *  (Approve → the phrase becomes bold+orange, a charisma key moment) or
 *  `replace` (Approve → swap in an audience-fit rephrase; threat / swearing /
 *  very-low stickiness). `replacement` is null for emphasize.
 *
 *  STRUCTURAL_STARS — `structure` is the third family: a rhetorical device
 *  detected in the transcript (a contrast or a list of three). It is a
 *  DELIVERY prompt, not an edit: no Approve, no fold, fixed signed-off copy
 *  rendered from `device`; `quote` is the user's own verbatim words. */
export type MomentSuggestion =
  | {
      kind: "emphasize" | "replace";
      replacement: string | null;
      /** A short, qualitative "why" line (model-generated, digit-free). */
      why: string;
      /** POLISH_AS_SUGGESTIONS — "polish" marks a replace whose alternative is
       *  the compose LLM's flow smoothing rather than a "your words were weak"
       *  rewrite. The BE clamps this to "polish" | null so the internal trigger
       *  vocabulary never rides a user payload. null/absent → today's copy. */
      trigger: "polish" | null;
      /** FE-2 (gradual refinement) — the NARROW span to underline: exactly the
       *  changed words (polish diff) or the carrying sentence (profanity). The
       *  BE guarantees a character-exact substring of the served text. null →
       *  no underline at all, the star icon alone marks the moment. Anchors
       *  are never underline targets any more. */
      quote: string | null;
    }
  | {
      kind: "structure";
      device: "contrast" | "list_of_three";
      /** The detected device, verbatim from the transcript (BE-validated as a
       *  substring). null → the sheet shows the copy without an excerpt. */
      quote: string | null;
    }
  | {
      /** DELIVERY_STARS — a MEASURED delivery observation, self-referential
       *  (z-scored against the speaker's own baseline). The FE renders fixed
       *  founder-approved copy keyed on `device`, same contract shape as
       *  structure. Not an edit — the modal offers a re-record of that
       *  snippet, not a text change.
       *
       *  `congruence` is the one NON-deterministic device: a content↔delivery
       *  gap (clearly positive words delivered flat), so it needs a sentiment
       *  read the acoustic vector alone can't give. Only the DOWN case is ever
       *  emitted — high-arousal "masked tension" is indistinguishable from
       *  excitement on a phone mic, so it is never claimed. It renders through
       *  the SAME star → sheet → DeliveryStarCard path as the other four; the
       *  difference is upstream only. */
      kind: "delivery";
      device: "emphasis" | "pace_fast" | "pace_slow" | "pause" | "congruence";
    };

export interface IdealKeyMomentLink {
  /** The literal text fragment inside `text` to underline. */
  anchor: string;
  snippetId: string;
  takeSessionId: string;
  /** Single-deliverable (SD) — the moment's id for the explanation endpoint
   *  and whether the coach authored a note/video for it. null/false on legacy
   *  payloads. */
  momentId?: string | null;
  hasExplanation?: boolean;
  /** MOMENT_SUGGESTIONS (MOMENT_SUGGESTIONS_ENABLED) — the per-moment star.
   *  "suggestion" = grey (a machine suggestion awaiting Approve); "verified" =
   *  orange (the coach attached a message). null/absent → today's plain moment
   *  (no star). A coach-verified star wins over a suggestion on the same
   *  snippet. */
  star?: "suggestion" | "verified" | null;
  /** The suggestion behind a grey star (free to read). null for a verified or
   *  plain moment. */
  suggestion?: MomentSuggestion | null;
  /** Whether the user already approved this suggestion. The BE folds the served
   *  text for an applied one and drops its star; this is informational. */
  applied?: boolean;
  /** Verified-star flags — what sits behind the moments paywall. The content
   *  itself (coach note + video) is served only by the paid moments GET. */
  coach?: {
    hasMessage: boolean;
    hasVideo: boolean;
    /** A blog post the coach attached to this verified moment. Absent when
     *  there is none, and absent for an unpublished or deleted post, so this
     *  can never render a dead link. NOT paywalled: unlike the coach's note,
     *  a public post sits outside the moments gate. */
    reference?: { slug: string; title: string; url: string } | null;
  } | null;
  /** The student's own recording of this snippet — free playback in the modal
   *  (never gated). null → no player. */
  snippetAudioRef?: string | null;
  /** Where this moment starts inside snippetAudioRef, and how long it runs.
   *  The ref is usually the whole take, so the player clamps to this window.
   *  null → no usable slice, play the ref unclamped. */
  startOffsetMs?: number | null;
  durationMs?: number | null;
}

export interface IdealText {
  text: string;
  /** Coach key phrases (≤5) — the "bolded openings". */
  keyPhrases: string[];
  keyMoments: IdealKeyMomentLink[];
  approved: boolean;
  /** The user's personal notebook copy; null until they save one. */
  notes: string | null;
}

/* ------------------- discernment provenance (version badges) --------------- */

/** DISCERNMENT (DISCERNMENT_PROVENANCE_ENABLED) — the closed reason-key set
 *  behind a pending swap's one why line. The BE clamps to this vocabulary;
 *  the FE renders fixed copy per key and NOTHING for anything else. */
export type SwapWhy = "energy" | "steadiness" | "coverage" | "overall";

/** The reason keys a TRACKED CHANGE may carry. Two vocabularies, deliberately
 *  not merged:
 *
 *    the four SwapWhy keys — CROSS-TAKE comparison ("This take carried more
 *      energy…"). They only make sense when a second take exists, so they
 *      reach a change from `prior_take` / `new_take` and nowhere else.
 *    clarity / emphasis   — the non-comparison lanes (founder copy
 *      2026-08-07). `clarity` for a change that alters the words,
 *      `emphasis` for one that styles words already there.
 *
 *  Splitting on what the change DOES to the text — not on which lane emitted
 *  it — is the same composition/accentuation line the locking spec draws, and
 *  it is what stops "helps your main point stand out" landing on a word swap.
 *
 *  The BE sends a KEY and the FE holds the copy, so no model-authored prose
 *  can reach the screen: an unrecognised value renders NO line rather than
 *  itself. */
export type ChangeWhy = SwapWhy | "clarity" | "emphasis" | "confident_voice";

export const CHANGE_WHY_KEYS: readonly ChangeWhy[] = [
  "energy",
  "steadiness",
  "coverage",
  "overall",
  "clarity",
  "confident_voice",
  "emphasis",
];

/* ------------------------- tracked changes (BE-C) ------------------------- */

/** LIVING TRANSCRIPT (founder 2026-07-20) — the document is the FULL literal
 *  transcript, and every word change is a VISIBLE, span-anchored suggestion
 *  (only fillers + punctuation are silently smoothed BE-side).
 *
 *  `kind`:
 *    replace — the span is crossed out and `proposedText` offered in its place
 *    bold    — the span is proposed for emphasis (no text change)
 *    advice  — delivery/structural coaching: no text change at all. The FE
 *              leaves these to the existing star layer, which already owns
 *              that rendering (FE-3), so they never draw a strike.
 *
 *  `source` names which lane produced it; `prior_take` is the cross-take
 *  discernment suggestion (a previous take's fragment ranked better). */
export interface DocumentSuggestion {
  id: string;
  /** [start, end) into the served `text`. */
  start: number;
  end: number;
  /** The exact substring the BE anchored on. FE-5's safety rule: render from
   *  the span, VERIFY against this, and drop the suggestion when it no longer
   *  matches — never guess a new position. */
  quote: string;
  kind: "replace" | "bold" | "advice";
  /** The offered replacement (replace only). */
  proposedText: string | null;
  /** advice only — which coaching observation this is. The FE renders the
   *  SAME founder-approved copy it already uses for delivery/structural
   *  stars (BE-C: "popover copy from device as today"). null → no copy, so
   *  the advice star is not drawn at all rather than an empty modal. */
  device:
    | "emphasis"
    | "pace_fast"
    | "pace_slow"
    | "pause"
    | "congruence"
    | "contrast"
    | "list_of_three"
    | null;
  /** Template key for the reason line, or null → no reason line (never
   *  invent one). See ChangeWhy: the swap sheet's four comparison keys plus
   *  the two non-comparison ones. */
  why: ChangeWhy | null;
  source:
    | "polish"
    | "prior_take"
    | "profanity"
    | "delivery"
    | "structural"
    /** Say-it-stronger replaces and emphasize bolds. The audit found this
     *  MISSING from both the union and the validator — it coerced to null
     *  and survived only because the default branch happened to be right. */
    | "wording"
    /** MASTER DOCUMENT (founder 2026-07-22) — a NEW take beat this block of
     *  the persistent master text. Approve-gated like every other change:
     *  the master never changes without a tap. */
    | "new_take"
    /** THE ACOUSTIC SWAP (founder 2026-08-13) — this take delivered a LOCKED
     *  paragraph better than the version standing in the document. The only
     *  lane that reaches a locked part at all: the ranker excludes locked
     *  parts from selection, so without this a better delivery of words the
     *  student already settled has nowhere to go. Labelled "Delivery" —
     *  the offer is about how it SOUNDED, not about the words. */
    | "acoustic_swap"
    /** THE CONFIDENT VOICE CARD (§17 acoustic-confidence-v1, founder
     *  2026-08-14) — purely positive: this chunk's DELIVERY crossed the
     *  machine's high-confidence threshold. Standard modal mechanics; the
     *  founder-signed body renders by key. Titled "Confident Voice". */
    | "confident_voice"
    | null;
  /** Server-remembered decision. Anything already decided is not re-offered
   *  (dismissed suggestions must never come back — FE-5). */
  status: "pending" | "approved" | "dismissed" | null;
  /** The piece this suggestion sits on, when the BE carries it — lets an
   *  approve report back through the existing per-snippet feedback POST. */
  snippetId: string | null;
  takeSessionId: string | null;
  /** MASTER DOCUMENT — the take the OFFERED wording comes from, so the
   *  comparison can show its badge ("from take 2"). null → no badge. */
  takeIndex: number | null;
  /** SPEC-lockin-loop §3 — the BE rendering registry's verdict: Confident
   *  Voice = "star", text rewrites = "underline", accents = "bold". The FE
   *  renders FROM this and never re-derives a visual from `kind` when it is
   *  present; null (older BE) → the legacy kind-based rendering. */
  visual: "star" | "underline" | "bold" | null;
  /** SPEC-lockin-loop §2 — the ONE thing a locked paragraph may still show:
   *  a Confident Voice detected on it in a later take. Rendered as the
   *  founder's small prompt (`pendingCopy`, copy is sign-off-locked), never
   *  as a normal offer — no Accept, no strike. */
  pendingBetterVersion: boolean;
  pendingCopy: string | null;
  /** MASTER DOCUMENT — a `new_take` block upgrade carries the block it acts
   *  on (top-level on the payload; also baked into `id` as "block:<key>").
   *  Its decision routes to the block-decide endpoint, NOT suggestion-
   *  feedback. null on non-block changes. */
  blockKey: number | null;
}

/** Map the GET's `changes` block (the BE's field; `suggestions` tolerated as
 *  an alias). ABSENT/unusable → null, and the FE
 *  renders exactly today's view (the tracked-changes lane is safe-ahead of
 *  BE-C). Every entry is validated hard: a bad span or a missing quote would
 *  corrupt the document, so it is dropped, never repaired. Pure. */
export function mapDocumentSuggestions(
  raw: unknown
): DocumentSuggestion[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DocumentSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const span = (r.span ?? r) as Record<string, unknown>;
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    const start = num(span.start);
    const end = num(span.end);
    const quote = typeof r.quote === "string" ? r.quote : "";
    const kind =
      r.kind === "replace" || r.kind === "bold" || r.kind === "advice"
        ? r.kind
        : null;
    // A suggestion without a usable span, quote or kind cannot be rendered
    // safely — drop it rather than anchor it by guesswork.
    if (start === null || end === null || end <= start || !quote || !kind) {
      continue;
    }
    const id =
      typeof r.id === "string" && r.id
        ? r.id
        : typeof r.id === "number" && Number.isFinite(r.id)
          ? String(r.id)
          : `${start}:${end}:${kind}`;
    const proposed =
      typeof r.proposed_text === "string" && r.proposed_text.length > 0
        ? r.proposed_text
        : null;
    const dev = r.device;
    const device =
      dev === "emphasis" ||
      dev === "pace_fast" ||
      dev === "pace_slow" ||
      dev === "pause" ||
      dev === "congruence" ||
      dev === "contrast" ||
      dev === "list_of_three"
        ? dev
        : null;
    // An advice entry with no nameable device has no copy to show — drop it
    // rather than draw a star that opens an empty modal.
    if (kind === "advice" && !device) continue;
    // A replace with nothing to propose is not a change — drop it.
    if (kind === "replace" && !proposed) continue;
    const snippetId =
      typeof r.snippet_id === "string" && r.snippet_id ? r.snippet_id : null;
    const takeSessionId =
      typeof r.take_session_id === "string" && r.take_session_id
        ? r.take_session_id
        : null;
    const rawSource = r.source;
    const source =
      rawSource === "polish" ||
      rawSource === "wording" ||
      rawSource === "prior_take" ||
      rawSource === "profanity" ||
      rawSource === "delivery" ||
      rawSource === "structural" ||
      rawSource === "new_take" ||
      rawSource === "acoustic_swap" ||
      rawSource === "confident_voice"
        ? rawSource
        : null;
    const blockKey =
      typeof r.block_key === "number" && Number.isFinite(r.block_key)
        ? r.block_key
        : null;
    // A text change whose decision the FE cannot report would draw an Accept /
    // Keep that can NEVER succeed — drop it (same "never repair" rule). The
    // actionable identity is SOURCE-SPECIFIC (each routes to a different
    // decision endpoint):
    //   new_take (block upgrade) → blocks/<block_key>/decide: needs block_key
    //     + take_session_id. Its snippet_id is deliberately null, so the old
    //     "needs snippet_id" rule was silently dropping EVERY block offer.
    //   prior_take → prior-take/decide: needs snippet_id + proposed_text
    //     (proposed already required for a replace above).
    //   everything else → suggestion-feedback: needs snippet_id + session.
    //   advice carries no decision → no pair needed.
    if (kind !== "advice") {
      if (source === "new_take") {
        if (blockKey === null || !takeSessionId) continue;
      } else if (source === "prior_take") {
        if (!snippetId) continue;
      } else if (!snippetId || !takeSessionId) {
        continue;
      }
    }
    // The reason rides `why_key` (BE tracked_changes); `why` is free-text or
    // null there. Prefer the key, and validate it to the closed set — model
    // prose arriving on either field renders NO line rather than itself.
    const whyRaw = r.why_key ?? r.why;
    const status = r.status;
    out.push({
      id,
      start,
      end,
      quote,
      kind,
      proposedText: proposed,
      device,
      why: CHANGE_WHY_KEYS.includes(whyRaw as ChangeWhy)
        ? (whyRaw as ChangeWhy)
        : null,
      source,
      status:
        status === "pending" || status === "approved" || status === "dismissed"
          ? status
          : null,
      snippetId,
      takeSessionId,
      takeIndex:
        typeof r.take_index === "number" && Number.isFinite(r.take_index)
          ? r.take_index
          : null,
      blockKey,
      visual:
        r.visual === "star" || r.visual === "underline" || r.visual === "bold"
          ? r.visual
          : null,
      pendingBetterVersion: r.pending_better_version === true,
      // The copy is the founder's exact string, passed through verbatim —
      // no fallback minted here (LIVE LOOP: copy needs sign-off, and a
      // pending flag without its copy renders nothing rather than our words).
      pendingCopy:
        typeof r.pending_copy === "string" && r.pending_copy
          ? r.pending_copy
          : null,
    });
  }
  return out;
}

/** One piece of the master text with its provenance: which take the shown
 *  words come from (the badge), and — when a newer take beat it but nothing
 *  swapped yet — the challenger awaiting the user's decision (the glow). */
export interface IdealPiece {
  pieceKey: number;
  /** The KEYED pill→picker join (variant-picker handoff 2026-08-03): the
   *  master block this paragraph's words belong to. The variants sheet
   *  deep-links on THIS key — never by index-zipping two lists that merely
   *  happen to sort the same. Safe-ahead: absent/null (legacy or misaligned
   *  lanes) = no pill deep-link; the header entry still covers the block. */
  blockKey?: number | null;
  /** The deck slide this piece's words were delivered on (0-based PDF page).
   *  Safe-ahead: absent/null until the BE serves `slide_index` — the FE then
   *  falls back to the exact-count zip (paragraph i = page i) or shows no
   *  slides at all, never a guessed attachment. */
  slideIndex?: number | null;
  /** The piece's CURRENT text (machine lane). Badges anchor to the top-level
   *  `text`'s paragraphs, never to a reconstruction from these. */
  text: string;
  /** 1-based take the shown words come from → the "vN.0" pill. null hides
   *  the pill for this piece (a row predating the index). */
  takeIndex: number | null;
  snippetId: string;
  takeSessionId: string;
  status: "settled" | "pending_swap";
  challenger: {
    snippetId: string;
    takeIndex: number | null;
    text: string;
    /** null → render no why line (never guess). */
    why: SwapWhy | null;
  } | null;
}

/** Map the GET's `pieces` block. ABSENT key (flag off / pre-migration) →
 *  null: no badge layer, today's view exactly. A present-but-broken row is
 *  dropped; an unknown status degrades to settled (no glow, no dead sheet). */
export function mapIdealPieces(raw: unknown): IdealPiece[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IdealPiece[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const pieceKey =
      typeof r.piece_key === "number" && Number.isFinite(r.piece_key)
        ? r.piece_key
        : null;
    const text = str(r.text);
    if (pieceKey === null || !text) continue;
    const take = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) && v >= 1 ? v : null;
    const chRaw =
      r.challenger && typeof r.challenger === "object"
        ? (r.challenger as Record<string, unknown>)
        : null;
    // A pending swap without a usable challenger cannot open a comparison —
    // degrade to settled rather than a glowing pill with an empty sheet.
    const why = (v: unknown): SwapWhy | null =>
      v === "energy" || v === "steadiness" || v === "coverage" || v === "overall"
        ? v
        : null;
    const challenger =
      chRaw && str(chRaw.snippet_id) && str(chRaw.text)
        ? {
            snippetId: str(chRaw.snippet_id),
            takeIndex: take(chRaw.take_index),
            text: str(chRaw.text),
            why: why(chRaw.why),
          }
        : null;
    out.push({
      pieceKey,
      blockKey:
        typeof r.block_key === "number" && Number.isFinite(r.block_key)
          ? r.block_key
          : null,
      slideIndex:
        typeof r.slide_index === "number" &&
        Number.isFinite(r.slide_index) &&
        r.slide_index >= 0
          ? r.slide_index
          : null,
      text,
      takeIndex: take(r.take_index),
      snippetId: str(r.snippet_id),
      takeSessionId: str(r.take_session_id),
      status: r.status === "pending_swap" && challenger ? "pending_swap" : "settled",
      challenger,
    });
  }
  return out;
}

/** E-2 (KEY_POINTS_ENABLED) — a presentation-mode cue: a verbatim milestone
 *  from one block of the ideal text, with its char range INTO the top-level
 *  `text` so the toggle can scroll/anchor back into the full read. */
export interface KeyPoint {
  blockKey: number | null;
  blockLabel: string;
  text: string;
  /** Char range into the served `text` (start inclusive, end exclusive); null
   *  when the BE omits it (the cue still renders, it just can't anchor). */
  start: number | null;
  end: number | null;
}

/** MATERIAL RECOVERY (SPEC §3.1 lane, founder 2026-08-07) — words the speaker
 *  SAID, on a slide their script has no block for.
 *
 *  Not a suggestion and not feedback: it is the student's own material,
 *  currently missing from their document because the master's structure locked
 *  on take 1 and this slide was not in it. It carries NO span — there is
 *  nothing in the document to anchor to, and forcing it into the tracked-change
 *  shape as a zero-width `insert` is exactly why it used to reach nobody. */
export interface Addition {
  /** "block:<key>" — stable, and the key the decision routes on. */
  id: string;
  blockKey: number;
  /** Echoed back on the decision so a superseded offer cannot be applied to a
   *  different take (409 STALE_OFFER). */
  takeSessionId: string;
  /** 1-based take the words came from → the "vN.0" badge. null hides it. */
  takeIndex: number | null;
  /** The deck slide these words were spoken over. null → no slide shown. */
  slideIndex: number | null;
  label: string | null;
  /** The speaker's own words, verbatim (L1 — nothing here is authored). */
  text: string;
}

/** Map the GET's `additions` block. ABSENT/unusable → [] so the section simply
 *  does not draw; there is no "no new material" state worth rendering.
 *
 *  A row missing its decidable identity (block key + take session) is DROPPED,
 *  not repaired: it would render an "Add to script" button that can never
 *  succeed, which is the same dead-control rule the tracked-change mapper
 *  already follows. Pure. */
export function mapAdditions(raw: unknown): Addition[] {
  if (!Array.isArray(raw)) return [];
  const out: Addition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const text = typeof r.text === "string" ? r.text.trim() : "";
    const blockKey =
      typeof r.block_key === "number" && Number.isFinite(r.block_key)
        ? r.block_key
        : null;
    const takeSessionId =
      typeof r.take_session_id === "string" ? r.take_session_id : "";
    if (!text || blockKey === null || !takeSessionId) continue;
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : `block:${blockKey}`,
      blockKey,
      takeSessionId,
      takeIndex: num(r.take_index),
      slideIndex: num(r.slide_index),
      label: typeof r.label === "string" && r.label ? r.label : null,
      text,
    });
  }
  return out;
}

/** Map the GET's `parts` block (SPEC §3.1, Step 0).
 *
 *  ABSENT/unusable → null, and the FE mints identity locally — today's view
 *  exactly, with ids that exist from the first render instead of from the
 *  first save. An EMPTY list stays an empty list: "no stored identity" and
 *  "the document is empty" are different states and the BE never conflates
 *  them, so neither does this.
 *
 *  A row missing an id or text is dropped rather than repaired. A repaired
 *  part would carry an id the server does not have, and the next save would
 *  claim to be updating a part that never existed. Pure. */
export function mapParts(raw: unknown): Part[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Part[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const text = typeof r.text === "string" ? r.text : "";
    if (!id || !text.trim()) continue;
    // SPEC §4 — the BE sends a BOOLEAN, never the lock timestamp: the client
    // needs to know which control to draw and nothing more. `iteration` is
    // the slice-2 maturity counter (how many lock-in cycles), a plain
    // process count — absent/invalid reads 0.
    const it =
      typeof r.iteration === "number" &&
      Number.isInteger(r.iteration) &&
      r.iteration >= 0
        ? r.iteration
        : 0;
    out.push({ id, text, locked: r.locked === true, iteration: it });
  }
  return out;
}

/** One decided proposal from the ledger, text included (slice 2). */
export interface DecisionHistoryEntry {
  quote: string | null;
  proposedText: string | null;
  why: ChangeWhy | null;
  decision: "approved" | "disregarded" | null;
  changeKey: string | null;
}

/** Map the GET's `decision_history` block. ABSENT → null. Rows with neither
 *  text are useless to a reader and are dropped (the BE filters them too —
 *  belt and braces, never invented). The why key is clamped to the same
 *  closed vocabulary as a live change: un-signed-off prose never renders. */
export function mapDecisionHistory(raw: unknown): DecisionHistoryEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DecisionHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const quote =
      typeof r.quote === "string" && r.quote.trim() ? r.quote : null;
    const proposed =
      typeof r.proposed_text === "string" && r.proposed_text.trim()
        ? r.proposed_text
        : null;
    if (!quote && !proposed) continue;
    const why =
      typeof r.why_key === "string" &&
      (CHANGE_WHY_KEYS as readonly string[]).includes(r.why_key)
        ? (r.why_key as ChangeWhy)
        : null;
    out.push({
      quote,
      proposedText: proposed,
      why,
      decision:
        r.decision === "approved" || r.decision === "disregarded"
          ? r.decision
          : null,
      changeKey: typeof r.change_key === "string" ? r.change_key : null,
    });
  }
  return out;
}

/** Map the GET's `key_points` block. ABSENT (flag off / older BE) → null: the
 *  toggle stays hidden, today's view exactly. A row with no cue text is dropped. */
export function mapKeyPoints(raw: unknown): KeyPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const out: KeyPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const text = str(r.text);
    if (!text) continue;
    out.push({
      blockKey: num(r.block_key),
      blockLabel: str(r.block_label),
      text,
      start: num(r.start),
      end: num(r.end),
    });
  }
  return out;
}

/** FE-7 — the document-absolute ranges the full-text view may tint.
 *
 *  VERIFY BEFORE TINTING. `start`/`end` are char offsets into the SERVED text
 *  (markers included), exactly like a tracked change, and the same rule
 *  applies: if the slice does not equal the cue verbatim, drop that key point
 *  SILENTLY rather than guess a position. A stale offset that paints anyway
 *  would accent words the coach never marked.
 *
 *  Deliberately returns positions only — no rank, no order index, no score.
 *  A key point is a qualitative cue (AC-9); the array's order is the
 *  document's order and carries no importance signal. Pure. */
export function keyPointTintRanges(
  text: string,
  keyPoints: KeyPoint[] | null
): Array<[number, number]> {
  if (!text || !keyPoints || keyPoints.length === 0) return [];
  const out: Array<[number, number]> = [];
  for (const kp of keyPoints) {
    const { start, end } = kp;
    if (start === null || end === null) continue; // un-anchored cue: card only
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    if (start < 0 || end > text.length || end <= start) continue;
    if (text.slice(start, end) !== kp.text) continue;
    out.push([start, end]);
  }
  return out;
}

export type IdealTextResult =
  | { kind: "ready"; ideal: IdealText } // the coach-perfected text (approved)
  // The FREE machine draft (founder re-lock 2026-07-17): served the moment the
  // eager assembler has output, before the coach-perfected version is approved.
  // Text + key moments only — no notes (the personal notebook copy stays a
  // perfected-lane feature). The BE flags this with variant:"instant". Reading
  // it is free; the only explicitly-purchased thing is the moments unlock.
  | { kind: "instant"; ideal: IdealText }
  // Single-deliverable (SINGLE_DELIVERABLE_ENABLED): the ONE living ideal text.
  // Both statuses are FREE to read; the only paid thing in the app is opening
  // the key-moment explanations (momentsUnlocked drives that).
  | {
      kind: "single";
      ideal: IdealText;
      status: "unverified" | "verified";
      version: number | null;
      momentsUnlocked: boolean;
      /** FE-1 (gradual refinement) — true only when at least one coach
       *  explanation actually exists behind the moments unlock. false (or
       *  absent, older BE) → NO paywall surface renders anywhere: there is
       *  nothing to sell yet. Automatic moments stay free regardless. */
      explanationsAvailable: boolean;
      /** #214 — the displayed text IS the student's saved edit. false →
       *  machine/coach text. While true the BE serves NO star decoration: an
       *  edited document has no anchors the stars could honestly attach to,
       *  and they return when the next take supersedes the edit (T1 · 1.2). */
      userEdited: boolean;
      /** T1 · 1.2 — a previous edit that a NEWER version superseded, offered
       *  back for one-click re-apply. PENDING BE: absent on every payload
       *  today, so this is null and the FE falls back to its own local buffer.
       *  Never applied automatically — re-applying replaces the new version's
       *  words, which is the student's call, not ours. */
      priorEdit: { text: string; version: number | null } | null;
      /** T1 · 1.2 — the BE's own gate for "record another take", deliberately
       *  independent of edit state. MAPPED, NOT ENFORCED: hiding a live
       *  recording affordance behind a field the deploy may not send yet is
       *  exactly the LIVE-LOOP risk the fences exist for, so nothing reads
       *  this to hide a mic. null = absent. */
      canRecordTake: boolean | null;
      /** Additive BE fields (2026-07-20) — all null-safe fallbacks until the
       *  BE deploy lands. */
      /** The latest take's topic; null → the FE falls back to "Your ideal text". */
      title: string | null;
      /** ISO timestamp of the last ideal-text update; null → no date line. */
      updatedAt: string | null;
      /** MASTER DOCUMENT (BE #236) — the project's OFFICIAL-take count (reads
       *  excluded), per-arc. The DOCUMENT badge is "{takeCount}.0": it climbs
       *  on every recorded take, unlike `version`, which only moves when the
       *  text actually changes (a take that lands only offers bumps no
       *  version). null until #236 deploys → the badge falls back to
       *  `version`, exactly today's behavior. */
      takeCount: number | null;
      /** The latest SPOKEN take (excludes reads). Still the pairing target
       *  for a delivery-star snippet re-record. */
      latestTakeSessionId: string | null;
      /** DISCERNMENT — per-piece provenance (the version-badge layer). null =
       *  the key was absent (flag off / pre-migration): render exactly
       *  today's view, no badges. */
      pieces: IdealPiece[] | null;
      /** LIVING TRANSCRIPT (BE-C) — span-anchored tracked changes over the
       *  served text. null (absent) → today's star/quote view. */
      suggestions: DocumentSuggestion[] | null;
      /** THE STYLE LANE (slice 2, founder 2026-08-11) — post-lock bold
       *  proposals riding OUTSIDE the ≤3 budget. Same wire shape as
       *  `changes`; surfaced only inside the chunk modal, never as an
       *  underline. null = absent (older BE / none pending). */
      styleChanges: DocumentSuggestion[] | null;
      /** PROPOSAL HISTORY (slice 2) — the arc's decided proposals that
       *  still carry their text, newest first. null = absent. */
      decisionHistory: DecisionHistoryEntry[] | null;
      /** MASTER DOCUMENT (BE-3) — whether THIS version is saved
       *  (accept-and-freeze). The BE serves it as `is_saved`, computed as
       *  saved_version == version AND no pending offers, so a document
       *  UN-saves the moment a new take brings offers (an offers-only take
       *  bumps no version). true → badges hide, the clean script shows, the
       *  re-read unlocks. null = the master flag is off / nothing ever saved
       *  → today's bottom CTA, unchanged (never hide a live affordance
       *  behind a field that does not exist yet). */
      saved: boolean | null;
      /** E-2 (KEY_POINTS_ENABLED) — presentation-mode cues (verbatim milestones
       *  per block). null (flag off / older BE) → the full↔key-words toggle
       *  stays hidden, today's view unchanged. */
      keyPoints: KeyPoint[] | null;
      /** The arc's deck PDF (slide-per-paragraph reading view). Safe-ahead:
       *  null until the BE echoes `presentation_ref` here (the coach lane
       *  already does) — the hosts then fall back to the cached deck / the
       *  best-presentation ref, and a deckless arc renders exactly today's
       *  view. */
      presentationRef: string | null;
      /** SLIDE TITLES by slide index (founder 2026-08-11: "yeah put only the
       *  title") — what the AUDIENCE saw, the one piece of deck context the
       *  reader is allowed. Titles only: the slide BODY is what the speaker
       *  was meant to say, and printing it beside what they did say turns
       *  their own speech into a diff against a script. Safe-ahead: null when
       *  the BE sends no key, [] on a deckless arc, and an empty string at an
       *  index is an untitled slide — the deck renders no title line rather
       *  than inventing one. */
      slideTitles: string[] | null;
      /** PARTS (SPEC-parts-locking-and-layers §3.1, Step 0) — the document's
       *  stored identity: an ordered list whose ids survive reorder and
       *  reword, so PR 3 has something a lock can hang on.
       *
       *  null means the BE sent NO key — this document has no stored identity
       *  yet (or the stored parts no longer join to the served text, which the
       *  BE refuses to serve rather than point at words that moved). The FE
       *  then mints ids locally, so a part has an id from its first render
       *  either way. An EMPTY list is a different thing (an empty document)
       *  and the BE never conflates the two. */
      parts: Part[] | null;
      /** MATERIAL RECOVERY — words the speaker said that their script has no
       *  block for. [] when there are none (the section does not draw). */
      additions: Addition[];
    }
  // FE-3b (gradual refinement) — an OLD version bubble opens its own frozen
  // step: that version's text + that version's reasoning, read-only. Served
  // by GET …/ideal-text?version=N when a snapshot exists.
  | {
      kind: "historical";
      ideal: IdealText;
      version: number | null;
      currentVersion: number | null;
      createdAt: string | null;
    }
  // ?version=N with no snapshot (assembled before history existed) — the FE
  // falls back to the live notebook, exactly as before.
  | { kind: "historicalUnavailable"; currentVersion: number | null }
  | { kind: "pending" } // 404 / not approved yet — coach still working
  | { kind: "error" };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Parse the `suggestion` object behind a grey star. Each family has a distinct
 *  shape; an unrecognized kind/device degrades to null (→ a plain moment, never
 *  the paid path — R-ms3). Kept as its own function so adding a family is one
 *  branch, not another level of ternary. */
function parseSuggestion(raw: unknown): MomentSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.kind === "emphasize" || s.kind === "replace") {
    return {
      kind: s.kind,
      replacement:
        typeof s.replacement === "string" && s.replacement.length > 0
          ? s.replacement
          : null,
      why: str(s.why),
      // POLISH_AS_SUGGESTIONS — anything but the exact "polish" token is null,
      // so an unknown/internal trigger can never change the copy.
      trigger: s.trigger === "polish" ? "polish" : null,
      // FE-2 — the narrow underline span; blank/absent (older BE) → null and
      // the star renders icon-only.
      quote:
        typeof s.quote === "string" && s.quote.trim().length > 0
          ? s.quote
          : null,
    };
  }
  // STRUCTURAL_STARS — the fixed copy is keyed off device, so a device we
  // can't name has no sheet: degrade to a plain moment.
  if (
    s.kind === "structure" &&
    (s.device === "contrast" || s.device === "list_of_three")
  ) {
    return {
      kind: "structure",
      device: s.device,
      quote:
        typeof s.quote === "string" && s.quote.trim().length > 0
          ? s.quote
          : null,
    };
  }
  // DELIVERY_STARS — likewise keyed off device (4 measured observations, plus
  // the content↔delivery `congruence` gap). An unnamed device still degrades.
  if (
    s.kind === "delivery" &&
    (s.device === "emphasis" ||
      s.device === "pace_fast" ||
      s.device === "pace_slow" ||
      s.device === "pause" ||
      s.device === "congruence")
  ) {
    return { kind: "delivery", device: s.device };
  }
  return null;
}

function mapKeyMoment(raw: unknown): IdealKeyMomentLink | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const anchor = str(r.anchor);
  const snippetId = str(r.snippet_id);
  const takeSessionId = str(r.take_session_id);
  // SD payloads may key moments by id instead of snippet_id. Ids may arrive
  // numeric (serializer-dependent) — coerce, never drop.
  const idOf = (v: unknown): string =>
    typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  const momentId = idOf(r.id) || idOf(r.moment_id) || null;
  if (!anchor || (!snippetId && !momentId)) return null;
  // MOMENT_SUGGESTIONS — all safe-ahead: an older payload omits these and the
  // moment degrades to today's plain underlined link (star === null).
  const suggestion = parseSuggestion(r.suggestion);
  // A "suggestion" star MUST carry a usable suggestion — without one it
  // degrades to a plain moment, never to the paid coach path (a grey star
  // showing an unlock prompt would sell free content — review R-ms3).
  const star =
    r.star === "verified"
      ? ("verified" as const)
      : r.star === "suggestion" && suggestion
        ? ("suggestion" as const)
        : null;
  const coachRaw =
    r.coach && typeof r.coach === "object"
      ? (r.coach as Record<string, unknown>)
      : null;
  const refRaw =
    coachRaw && typeof coachRaw.reference === "object" && coachRaw.reference
      ? (coachRaw.reference as Record<string, unknown>)
      : null;
  // Need a slug AND a title to render something a reader can act on. Prefer
  // the server's url, but fall back to building it from the slug so an older
  // payload still links correctly.
  const referenceSlug = refRaw ? str(refRaw.slug) : "";
  const referenceTitle = refRaw ? str(refRaw.title) : "";
  const reference =
    referenceSlug && referenceTitle
      ? {
          slug: referenceSlug,
          title: referenceTitle,
          url: str(refRaw?.url) || `/blog/${referenceSlug}`,
        }
      : null;
  const coach = coachRaw
    ? {
        hasMessage: coachRaw.has_message === true,
        hasVideo: coachRaw.has_video === true,
        reference,
      }
    : null;
  const snippetAudioRef = str(r.snippet_audio_ref) || str(r.audio_ref) || null;
  // Parent+offset model: snippet_audio_ref is usually the WHOLE take's audio,
  // so the player must clamp to [start, start+duration]. Absent/unusable
  // offsets (older payload, un-sliced row) → null, and the sheet falls back to
  // unclamped playback rather than a dead player.
  const ms = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  return {
    anchor,
    snippetId,
    takeSessionId,
    momentId,
    hasExplanation: r.has_explanation === true,
    star,
    suggestion,
    applied: r.applied === true,
    coach,
    snippetAudioRef,
    startOffsetMs: ms(r.start_offset_ms),
    durationMs: ms(r.duration_ms),
  };
}

export function mapIdealText(raw: unknown): IdealText | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text);
  if (!text) return null;
  return {
    text,
    keyPhrases: Array.isArray(r.key_phrases)
      ? r.key_phrases.filter((p): p is string => typeof p === "string" && p.length > 0)
      : [],
    keyMoments: Array.isArray(r.key_moments)
      ? r.key_moments
          .map(mapKeyMoment)
          .filter((m): m is IdealKeyMomentLink => m !== null)
      : [],
    approved: r.approved === true,
    notes: str(r.notes) || str(r.user_notes) || null,
  };
}

/** Map a variant:"instant" payload → the free instant draft. Pure; null when
 *  the payload carries no usable text (the caller degrades to pending). */
export function mapInstantIdealText(
  raw: Record<string, unknown>
): Extract<IdealTextResult, { kind: "instant" }> | null {
  const ideal = mapIdealText(raw);
  if (!ideal) return null;
  return { kind: "instant", ideal };
}

/* inferHistoricalStars is DELETED (founder 2026-08-10: the manager engine
 * is the sole gatekeeper — "no other exist"). It minted suggestion stars
 * the BE deliberately omitted, which made the FE itself an ungated
 * intervention source; the historical payload no longer carries
 * suggestions at all. */

/** Student fetch — the ideal text is free to read (SD + instant lanes); pending
 *  until the coach approves the perfected version. `version` (FE-3b) requests an
 *  OLD version's read-only snapshot; omit for the live document. N == current
 *  serves the live notebook unchanged. */
export async function fetchIdealText(
  arcId: string,
  version?: number | null
): Promise<IdealTextResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const query =
    typeof version === "number" && Number.isFinite(version)
      ? `?version=${encodeURIComponent(version)}`
      : "";
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text${query}`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "pending" };
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  // FE-3b — the two historical answers, checked FIRST (they only ever arrive
  // for a ?version request; a live payload carries neither flag).
  if (body?.historical_unavailable === true) {
    return {
      kind: "historicalUnavailable",
      currentVersion: num(body.current_version),
    };
  }
  if (body?.historical === true) {
    const ideal = mapIdealText(body);
    if (!ideal) return { kind: "pending" };
    return {
      kind: "historical",
      ideal,
      version: num(body.version),
      currentVersion: num(body.current_version),
      createdAt:
        typeof body.created_at === "string" && body.created_at
          ? body.created_at
          : null,
    };
  }
  // Single-deliverable contract (SINGLE_DELIVERABLE_ENABLED): the payload
  // carries `status` — both statuses free to read, no approved coercion.
  // Checked FIRST; absent status → the older lanes below, byte-for-byte.
  if (body?.status === "unverified" || body?.status === "verified") {
    const ideal = mapIdealText(body);
    if (!ideal) return { kind: "pending" };
    return {
      kind: "single",
      ideal,
      status: body.status,
      version:
        typeof body.version === "number" && Number.isFinite(body.version)
          ? body.version
          : null,
      momentsUnlocked: body.moments_unlocked === true,
      explanationsAvailable: body.explanations_available === true,
      userEdited: body.user_edited === true,
      // T1 · 1.2 — feature-detected: shape-checked, never assumed. A prior
      // edit with no words is no offer at all.
      priorEdit: (() => {
        const pe = body.prior_edit;
        if (!pe || typeof pe !== "object") return null;
        const r = pe as Record<string, unknown>;
        const t = typeof r.text === "string" ? r.text : "";
        if (!t.trim()) return null;
        return {
          text: t,
          version:
            typeof r.version === "number" && Number.isFinite(r.version)
              ? r.version
              : null,
        };
      })(),
      canRecordTake:
        typeof body.can_record_take === "boolean" ? body.can_record_take : null,
      // Additive 2026-07-20 fields — null-safe until the BE deploy lands.
      title:
        typeof body.title === "string" && body.title.trim() ? body.title : null,
      updatedAt:
        typeof body.updated_at === "string" && body.updated_at
          ? body.updated_at
          : null,
      takeCount:
        typeof body.take_count === "number" && Number.isFinite(body.take_count)
          ? body.take_count
          : null,
      latestTakeSessionId:
        typeof body.latest_take_session_id === "string" &&
        body.latest_take_session_id
          ? body.latest_take_session_id
          : null,
      pieces: mapIdealPieces(body.pieces),
      // `changes` ONLY — the gated lane's own key. The old `suggestions`
      // alias was a live bypass socket: any payload carrying that key
      // rendered ungated (founder 2026-08-10, sole-gatekeeper rip).
      suggestions: mapDocumentSuggestions(body.changes),
      styleChanges: mapDocumentSuggestions(body.style_changes),
      decisionHistory: mapDecisionHistory(body.decision_history),
      // `is_saved` is the BE's field; `saved` tolerated as an alias so a
      // rename cannot silently strand the whole save lane.
      saved:
        typeof body.is_saved === "boolean"
          ? body.is_saved
          : typeof body.saved === "boolean"
            ? body.saved
            : null,
      // E-2 — presentation-mode cues (flag-gated BE-side); absent → null → the
      // toggle stays hidden.
      keyPoints: mapKeyPoints(body.key_points),
      parts: mapParts(body.parts),
      additions: mapAdditions(body.additions),
      presentationRef:
        typeof body.presentation_ref === "string" &&
        body.presentation_ref.length > 0
          ? body.presentation_ref
          : null,
      slideTitles: Array.isArray(body.slide_titles)
        ? body.slide_titles.map((s) => (typeof s === "string" ? s : ""))
        : null,
    };
  }
  // Instant lane (INSTANT_IDEAL_TEXT_ENABLED): the free machine draft, served
  // before payment/approval. Checked BEFORE the locked/approved coercions —
  // an instant payload is deliberately unpaid and unapproved. Absent variant
  // (flag off / older BE) → the legacy path below, byte-for-byte.
  if (body?.variant === "instant") {
    return mapInstantIdealText(body) ?? { kind: "pending" };
  }
  const ideal = mapIdealText(body);
  if (!ideal) return { kind: "pending" };
  if (!ideal.approved) return { kind: "pending" };
  return { kind: "ready", ideal };
}

export type UserEditSaveResult =
  | { ok: true; version: number | null }
  /** A newer version assembled while the student was typing. */
  | { ok: false; reason: "superseded"; currentVersion: number | null }
  /** Nothing is assembled yet — there is no document to edit. */
  | { ok: false; reason: "nothingToEdit" }
  /** Past the 20000-char ceiling, or a version the BE refused. */
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "error" };

/**
 * #214 / T1 · 1.2 — persist the student's edit of their ideal text: the FULL
 * resulting document, stamped with the version it was edited from.
 *
 * A 409 VERSION_SUPERSEDED is NO LONGER retried against the server's
 * current_version. That retry (pre-T1·1.2) re-sent the pre-take words over
 * the version a just-landed take had assembled — a silent overwrite of new
 * F1 output by a stale edit. The supersede is now reported up so the caller
 * can refetch the new text and RE-OFFER the student's pending changes on top
 * (contract 2026-07-28). Nothing is dropped and nothing is clobbered.
 *
 * `reapplied` rides only on the explicit re-apply action (pending BE field;
 * harmless on today's deploy). Soft-fails; callers keep the local text.
 */
export async function saveIdealUserEdit(
  arcId: string,
  text: string,
  version: number | null,
  opts?: { reapplied?: boolean; parts?: readonly Part[] | null }
): Promise<UserEditSaveResult> {
  // Refuse a doomed PUT locally: the BE rejects past its ceiling with 400,
  // and the student's words must survive either way.
  if (text.length > MAX_DOCUMENT_CHARS) return { ok: false, reason: "invalid" };
  // Header when available; otherwise the BFF's cookie-session fallback
  // authenticates (same pattern as fetchIdealText / saveIdealNotes).
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/user-edit`,
      {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          text,
          version,
          ...(opts?.reapplied ? { reapplied: true } : {}),
          // PARTS (SPEC §3.1, Step 0) — the document's identity, sent only
          // when the caller has it. The key must be ABSENT otherwise: the BE
          // treats present-and-empty as "this document is empty" and would
          // wipe the stored ids. It also refuses a list that does not join
          // back to `text`, so the two are always written together or not at
          // all.
          //
          // `locked` MUST ride: auto-lock ("typed = committed") is computed
          // client-side by autoLockTouched, and the BE stamps locked_at only
          // for parts sent locked. Dropping the flag here silently unwound
          // the whole feature — the parts landed, every one open.
          ...(opts?.parts && opts.parts.length > 0
            ? {
                parts: opts.parts.map((p) => ({
                  id: p.id,
                  text: p.text,
                  ...(p.locked === true ? { locked: true } : {}),
                })),
              }
            : {}),
        }),
      }
    );
  } catch {
    return { ok: false, reason: "error" };
  }
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (res.status === 409) {
    // Two different 409s share the status; the code discriminates them.
    if (body?.code === "NOTHING_TO_EDIT" || body?.error === "NOTHING_TO_EDIT") {
      return { ok: false, reason: "nothingToEdit" };
    }
    return {
      ok: false,
      reason: "superseded",
      currentVersion:
        typeof body?.current_version === "number" ? body.current_version : null,
    };
  }
  if (res.status === 400) return { ok: false, reason: "invalid" };
  if (!res.ok) return { ok: false, reason: "error" };
  return {
    ok: true,
    version: typeof body?.version === "number" ? body.version : null,
  };
}

/** Save the user's PERSONAL notebook copy (A6 — never the canonical). */
export async function saveIdealNotes(
  arcId: string,
  text: string
): Promise<boolean> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/notes`,
      {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ text }),
      }
    );
  } catch {
    return false;
  }
  return res.ok;
}

/* ------------------------------ coach lane -------------------------------- */

export interface CoachIdealText {
  /** The auto-assembled draft merged with any saved coach edit. */
  text: string;
  approved: boolean;
  /** BE-B — the eager assembler's status. "pending" = fewer than 3 spoken
   *  takes (nothing to review yet); "empty" = takes are in but nothing to
   *  assemble yet (no coach-confirmed key moments — the BE no longer serves a
   *  "ready" empty block); "ready" = the persisted draft exists and the editor
   *  can open instantly. null only on legacy payloads → treated as a soft
   *  error now that the BE always sends assembly_state. */
  assemblyState: "pending" | "empty" | "ready" | null;
  /** Spoken-take counts for the pending copy ("N of M takes recorded").
   *  null when the payload omits them. */
  takesDone: number | null;
  takesTarget: number | null;
  /** FP-1 — provenance: "machine" (the auto-assembled draft, untouched) vs
   *  "coach" (the coach has edited it). Drives a coach-only chip. null on
   *  older payloads → the chip hides. */
  source: "machine" | "coach" | null;
  /** The arc's deck (for the redesign's cover slide). Safe-ahead: null until
   *  the BE echoes presentation_ref here → the panel shows a blank cover. */
  presentationRef: string | null;
  /** #214 — the STUDENT's own edit of the current version (read-only reference
   *  for the coach; separate lane, never merged automatically). null = none. */
  userEdit: { text: string; version: number | null; updatedAt: string | null } | null;
}

export async function fetchCoachIdealText(
  arcId: string
): Promise<CoachIdealText | null> {
  const token = await getAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/ideal-text`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;
  const text = str(body.text);
  const count = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  return {
    text,
    approved:
      body.approved === true ||
      (typeof body.approved_at === "string" && body.approved_at.length > 0),
    assemblyState:
      body.assembly_state === "pending"
        ? "pending"
        : body.assembly_state === "empty"
        ? "empty"
        : body.assembly_state === "ready"
        ? "ready"
        : null,
    takesDone: count(body.takes_done),
    takesTarget: count(body.takes_target),
    source:
      body.source === "coach"
        ? "coach"
        : body.source === "machine"
        ? "machine"
        : null,
    presentationRef:
      typeof body.presentation_ref === "string" &&
      body.presentation_ref.length > 0
        ? body.presentation_ref
        : null,
    userEdit: (() => {
      const ue = body.user_edit;
      if (!ue || typeof ue !== "object") return null;
      const u = ue as Record<string, unknown>;
      const text = typeof u.text === "string" ? u.text : "";
      if (!text) return null;
      return {
        text,
        version:
          typeof u.version === "number" && Number.isFinite(u.version)
            ? u.version
            : null,
        updatedAt: typeof u.updated_at === "string" ? u.updated_at : null,
      };
    })(),
  };
}

export async function saveCoachIdealText(
  arcId: string,
  text: string
): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/ideal-text`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );
  } catch {
    return false;
  }
  return res.ok;
}

export async function approveIdealText(arcId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/arc/${encodeURIComponent(arcId)}/ideal-text/approve`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    return false;
  }
  return res.ok;
}

/* ------------------------- notebook text segments ------------------------- */

/** One render segment of the notebook text: plain, bold (key phrase), or an
 *  underlined key-moment link. */
export interface IdealSegment {
  text: string;
  bold?: boolean;
  moment?: IdealKeyMomentLink;
}

/** Split the ideal text into render segments: the FIRST case-insensitive
 *  occurrence of each key-moment anchor becomes an underlined link segment,
 *  the first occurrence of each key phrase becomes bold. Overlaps resolve
 *  first-come (earlier start wins; moments matched before phrases). A range
 *  that would slice a rich-marker token in half is dropped (FE-9): the text
 *  may carry coach markers, and cutting one mid-token would leak raw marker
 *  syntax into the flanking segments. A token FULLY inside a range is fine —
 *  the segment's own marker rendering handles it. Pure. */
export function segmentIdealText(
  text: string,
  keyPhrases: string[],
  keyMoments: IdealKeyMomentLink[]
): IdealSegment[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tokenSpans = markerTokenSpans(text);
  // True when [start, end) partially overlaps a marker token (either boundary
  // inside the token, or the range strictly inside it).
  const slicesToken = (start: number, end: number): boolean =>
    tokenSpans.some(
      ([ts, te]) => start < te && end > ts && !(ts >= start && te <= end)
    );
  type Range = { start: number; end: number; bold?: boolean; moment?: IdealKeyMomentLink };
  const candidates: Range[] = [];
  for (const m of keyMoments) {
    const a = m.anchor.trim().toLowerCase();
    if (!a) continue;
    const i = lower.indexOf(a);
    if (i >= 0 && !slicesToken(i, i + a.length)) {
      candidates.push({ start: i, end: i + a.length, moment: m });
    }
  }
  for (const p of keyPhrases) {
    const q = p.trim().toLowerCase();
    if (!q) continue;
    const i = lower.indexOf(q);
    if (i >= 0 && !slicesToken(i, i + q.length)) {
      candidates.push({ start: i, end: i + q.length, bold: true });
    }
  }
  // Earlier start wins; a moment beats a phrase at the same start (it carries
  // the deep-link). Drop anything overlapping an accepted range.
  candidates.sort(
    (a, b) => a.start - b.start || (a.moment ? -1 : 1) - (b.moment ? -1 : 1)
  );
  const accepted: Range[] = [];
  for (const c of candidates) {
    if (accepted.some((r) => c.start < r.end && c.end > r.start)) continue;
    accepted.push(c);
  }
  const segments: IdealSegment[] = [];
  let cursor = 0;
  for (const r of accepted) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start) });
    segments.push({
      text: text.slice(r.start, r.end),
      bold: r.bold,
      moment: r.moment,
    });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
