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
import { displayKind } from "./displayKind";

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

  /* THE CONFIDENT VOICE FACE IS BARE (founder 2026-09-15, from a mockup).
   * "there should be no title above, just a small feedback. And then the
   * playback, and that's it, a very minimalistic design."
   *
   * So this one face drops BOTH the kind eyebrow ("Possible confident
   * moment") and the "Suggested change" title, and stands one plain word in
   * their place. Nothing the speaker needs is lost: the question under the
   * player already states exactly what is being asked of them. Naming the
   * machine's read ABOVE that question is what had to go — it announced a
   * read the speaker had not yet formed their own view of, which is the wrong
   * order for a question whose entire value is their independent answer.
   *
   * Scoped to this face on purpose. The clarity and praise faces keep their
   * kicker and title; they were not what the founder mocked. */
  if (face === "review" && suggestion && isConfidentVoiceFeedback(suggestion)) {
    return { kicker: null, title: "Feedback" };
  }
  if (face === "review" && suggestion) {
    return {
      kicker: `${displayKind(suggestion)}${tail}`,
      title: "Suggested change",
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
