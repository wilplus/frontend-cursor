/** The chunk sheet's two lines of heading — the small uppercase kicker and
 *  the title under it — as one pure function of the face and the work.
 *
 *  A PURE .ts MODULE for the reason displayKind.ts gives next door: this is
 *  founder copy (LIVE LOOP), and vitest here cannot transform .tsx imports
 *  (Next's `jsx: preserve`), so copy left inside the modal is copy no unit
 *  test can reach. That is how the swap lane fell through to "Clarity"
 *  unnoticed (audit finding #7). Moving the heading out means the 2026-09-15
 *  founder ruling below is pinned by a test that reads the strings directly,
 *  instead of by a source grep.
 */
import type { DocumentSuggestion } from "@/services/api/idealText";

export type SheetFace = "review" | "editor" | "root";

export type SheetHeading = {
  /** The uppercase eyebrow, or `null` for a face that deliberately has none. */
  kicker: string | null;
  title: string;
};

export function isConfidentVoiceFeedback(item: DocumentSuggestion): boolean {
  return (
    item.feedbackFamily === "confident_voice" ||
    item.source === "confident_voice"
  );
}

/** The chunk's maturity — lock-in cycles survived (slice 2). A process count
 *  in the kicker, exactly the founder's spec vocabulary. */
function iterationTail(iteration: number): string {
  if (iteration <= 0) return "";
  return ` · ${iteration} iteration${iteration === 1 ? "" : "s"}`;
}

export function sheetHeading(args: {
  face: SheetFace;
  suggestion: DocumentSuggestion | null;
  locked: boolean;
  /** The chunk carries an approved-but-unlocked rewrite. */
  hasApproved: boolean;
  iteration: number;
}): SheetHeading {
  const { face, suggestion, locked, hasApproved, iteration } = args;
  const tail = iterationTail(iteration);

  /* EVERY FEEDBACK FACE IS BARE (founder 2026-09-15: "make all feedback cards
   * bare … delete the text POSSIBLE CLARITY IMPROVEMENT").
   *
   * No kind eyebrow on any of them. It announced the machine's read above
   * words the speaker had not yet judged for themselves — wrong order on the
   * Confident Voice card, where the whole value is their independent answer,
   * and merely noise on the others, where the card underneath already shows
   * exactly what is being proposed. One title, then the content.
   *
   * The kind is NOT lost from the product: displayKind() still names the lane
   * on the page's own bookmarks, which is where a speaker chooses what to open.
   * It is only gone from the sheet they have already opened. */
  if (face === "review" && suggestion) {
    return {
      kicker: null,
      title: isConfidentVoiceFeedback(suggestion)
        ? "Feedback"
        : "Suggested change",
    };
  }
  if (face === "root") {
    return {
      kicker: `Locked for the next Take${tail}`,
      title: "Choose a rooting phrase",
    };
  }
  // THE PAGE no longer distinguishes accepted from clean — since 2026-08-15
  // only a server lock turns the mark green, because the merged state flashed
  // green on its way to grey on every accept. In HERE the difference is still
  // real and still worth saying, because this is where the lock action lives.
  //
  // KEYED ON THE APPROVED RIDER, not on `chunk.status`. The status can no
  // longer say "accepted" — that is the whole point of the change — so reading
  // it here would have silently retired this kicker and left an accepted chunk
  // claiming "No feedback pending". Same lesson as the face selector in the
  // modal: read the work, not the page's summary of it.
  if (locked) return { kicker: `Locked in${tail}`, title: "Locked chunk" };
  if (hasApproved) {
    return { kicker: "Accepted · not locked in yet", title: "Edit this chunk" };
  }
  return { kicker: "No feedback pending", title: "Edit this chunk" };
}
