"use client";

import type { ChunkStatus } from "@/lib/willab/deckChunks";
import { motionClasses } from "@/lib/willab/bookmarkMotion";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";

/* One feedback control per paragraph. The icon describes the user's feedback
 * state; it does not grade the words and it is not an edit button:
 *
 *   outline    resolved ordinary paragraph / feedback not loaded yet
 *   filled     a rooting phrase is active
 *   attention  something is waiting on this paragraph
 *
 * NO COUNT (founder 2026-09-15). The mark used to print a small 2 or 3 beside
 * the bookmark. It hid below two and clamped above three, so it was never a
 * true count — and a column of paragraphs reading 3 / 1 / 2 scans as a ranking
 * of how bad each paragraph is, which is the exact reading AC-9 exists to
 * prevent. The state is binary now: something is waiting, or it is not.
 *
 * ATTENTION IS NOW PLAIN `unresolved`, not `flagship && unresolved`. While the
 * number existed, a paragraph with feedback waiting but no rooting phrase drew
 * an ordinary outline mark and the digit was the only thing distinguishing it.
 * Removing the count without this change would have made those paragraphs
 * indistinguishable from resolved ones — the ring and the breathe now carry
 * the signal for every paragraph, with or without an orange anchor.
 *
 * Screen readers keep "Feedback waiting — review it" from ARIA below: the same
 * information, minus the number.
 *
 * Slide editing has its own explicit, slide-scoped control. That separation is
 * deliberate: feedback, accepted orange anchors, and rehearsal roots are three
 * different layers of the product. */

const ARIA: Record<ChunkStatus, string> = {
  // Never drawn: an untouched paragraph shows no mark at all. The entry
  // exists because the record is total over the status union.
  untouched: "No feedback pending",
  clean: "No feedback pending",
  waiting: "Feedback waiting — review it",
  locked: "Paragraph protected",
};

const COACH_LABEL = "Coach note:";
/* ONE WORD FOR ONE THING. The mark reads the sheet's emphasis-step title
   (renamed "Choose your helper words" 2026-09-24) rather than keeping its own
   spelling — a bookmark saying "Style" over a screen saying "Emphasis" is how
   a second vocabulary starts, which is what this label's test guards. */
const STYLE_LABEL = CHUNK_SHEET_COPY.titleEmphasis;

type BookmarkTier = "exercise" | "most_confident" | "standard" | null;

/** How one bookmark is painted (contract 24g), as a pure function of its tier.
 *
 *  Module level rather than inline: the mark already carries the lock, the
 *  coach dot, the style flag and the review status, and the ratchet holds this
 *  component at its ceiling. Pure also makes the rule readable on its own —
 *  which colour, and what moves.
 *
 *  THERE IS NO RING (founder 2026-09-20: "the ring should not be there
 *  because the role of solid bookmark is taken by just black text. There is
 *  just fill and motion").
 *
 *  The ring meant "something is waiting on this paragraph" — and the deck
 *  already says that with the paragraph itself, which renders
 *  `text-foreground/55` while unsettled and `text-foreground` once settled.
 *  A whole block dimming or going black is a louder, clearer statement of
 *  that fact than a two-pixel outline, and the deck's own comment has called
 *  the softened block a signal all along. The ring was a third device for a
 *  fact already told twice.
 *
 *  What is left: colour for the tier, fill for a live rooting phrase, and
 *  motion for the exercise alone — see `bookmarkMotion`, which owns the
 *  motion rule so it cannot drift from the comment describing it. The
 *  focus-visible outline below is NOT the ring: it is the keyboard focus
 *  indicator and it stays. */
function tierClasses(tier: BookmarkTier): string {
  const colour =
    tier === "most_confident"
      ? "text-affirm focus-visible:outline-affirm"
      : "text-primary focus-visible:outline-primary";
  return `${colour} ${motionClasses(tier)}`;
}

export default function DeckLockMark({
  status,
  flagship = false,
  onClick,
  disabled = false,
  hasCoach = false,
  hasUnreadCoachUpdate = false,
  hasStyle = false,
  reviewStatus = null,
  tier = null,
}: {
  status: ChunkStatus;
  /** WHICH BOOKMARK THIS IS (contract 24g). The exercise item renders orange
   *  and pulsing; the Take's two most Confident Voice items render green,
   *  IDENTICALLY — first and second are never distinguished, because a visible
   *  ordering is a surfaced ranking (24i). Everything else renders orange, as
   *  it always has.
   *
   *  COLOUR IS NEVER THE SOLE DIFFERENTIATOR (24g): each tier also names
   *  itself in the accessible label, so the distinction survives a screen
   *  reader and a colour-blind reader alike. The pulse is motion-safe, which
   *  is the same restraint the attention ring already keeps.
   *
   *  Safe-ahead: null renders exactly today's mark. */
  tier?: BookmarkTier;
  /** True when the paragraph contains an active orange rooting phrase.
   * Its automatic/owner origin remains separate server provenance. */
  flagship?: boolean;
  onClick: () => void;
  disabled?: boolean;
  hasCoach?: boolean;
  hasUnreadCoachUpdate?: boolean;
  hasStyle?: boolean;
  reviewStatus?:
    | "pending_coach_review"
    | "coach_reviewed"
    | "not_confirmed"
    | null;
}) {
  const styled = hasStyle && status === "locked";
  const reviewNeedsAttention =
    reviewStatus === "pending_coach_review" || reviewStatus === "not_confirmed";
  // Anything waiting on this paragraph, from any layer. Since 2026-09-15 this
  // alone drives the ring — see the note above on why it is no longer gated on
  // `flagship`.
  const attention =
    status === "waiting" || styled || hasUnreadCoachUpdate || reviewNeedsAttention;
  // The exercise is the ONE thing on the screen the speaker is asked to go and
  // do, so it is the only tier that moves — see `bookmarkMotion`, which owns
  // the motion rule because keeping it here is what let green breathe while a
  // comment promised it never would.
  const isExercise = tier === "exercise";
  const isAffirmed = tier === "most_confident";

  return (
    <button
      type="button"
      aria-label={[
        flagship ? "Rooting phrase active" : ARIA[status],
        // 24g's "never the sole differentiator", and 24i's no-ranking rule:
        // the label names the tier and says nothing about position, band or
        // score. "One of" is load-bearing — it must not read as "the best".
        isExercise ? "Practice this one" : null,
        isAffirmed ? "One of your most confident moments" : null,
        hasCoach ? COACH_LABEL : null,
        hasUnreadCoachUpdate ? "New coach update" : null,
        reviewStatus === "pending_coach_review" ? "Pending coach review" : null,
        reviewStatus === "coach_reviewed" ? "Coach reviewed" : null,
        reviewStatus === "not_confirmed" ? "Coach did not confirm this moment" : null,
        styled ? STYLE_LABEL : null,
      ]
        .filter(Boolean)
        .join(" — ")}
      data-status={attention ? "attention" : flagship ? "filled" : "outline"}
      data-coach={hasCoach ? "true" : undefined}
      data-coach-unread={hasUnreadCoachUpdate ? "true" : undefined}
      data-style={styled ? "true" : undefined}
      data-tier={tier ?? undefined}
      onClick={onClick}
      disabled={disabled}
      className={`absolute bottom-0 left-0 top-0 flex w-4 justify-start rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${tierClasses(tier)}`}
    >
      {/* A BAR IN THE LEFT MARGIN (founder 2026-09-26, Ideal Text redesign
          B), replacing the bookmark at the end of the paragraph. At the end
          of a long paragraph the bookmark could land on the next screen and
          moved with every line length; the bar stands level with the first
          line, in the same place every time, and the words keep their full
          colour. The whole paragraph is the tap target too. The bar sits
          INSIDE the paragraph's left padding (every paragraph carries it, so
          text never shifts as a bar comes and goes): outside the box, the
          slide's scroller clipped it and swallowed the tap. Tier colour and
          motion, the accessible label and every data-* attribute are
          unchanged — the bar is the old mark's position, not a new signal. */}
      <span
        aria-hidden
        data-gutter-bar
        className="block h-full w-[3px] rounded-full bg-current"
      />
      {hasCoach ? (
        <span
          className={`absolute left-[1.5px] top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-background ${hasUnreadCoachUpdate ? "bg-primary motion-safe:animate-pulse" : "bg-muted-foreground"}`}
          aria-hidden
        />
      ) : null}
    </button>
  );
}
