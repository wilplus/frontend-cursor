/* -------------------------------------------------------------------------- */
/*  Autosave policy for the coach's typed drafts (founder 2026-08-14).         */
/*                                                                            */
/*  "When I click add note and write something, it must auto-save exactly as   */
/*  is. I do not want to rely on clicking a manual Save button and risk        */
/*  losing data."                                                             */
/*                                                                            */
/*  A plain .ts because vitest here has no JSX transform. The POLICY lives     */
/*  here and is tested; the component keeps only the timer and the call.       */
/*                                                                            */
/*  WHY A POLICY AT ALL, RATHER THAN "SAVE ON EVERY KEYSTROKE": each save is   */
/*  a round trip that re-persists the whole verdict body, so an unguarded      */
/*  autosave would fire a request per character and make the last write win a  */
/*  race it did not know it was in. Two rules keep it honest — only save when  */
/*  the text actually CHANGED, and only when the server can accept it.         */
/* -------------------------------------------------------------------------- */

/** How long to wait after the last keystroke. Long enough not to fire
 *  mid-word, short enough that a closed tab loses nothing worth missing.
 *  Blur flushes immediately and does not wait for this. */
export const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * Should this draft be persisted right now?
 *
 * @param draft      what is in the box
 * @param persisted  what the server last confirmed (null = never saved)
 * @param canSave    whether the server will accept it — for a star verdict
 *                   the note rides the VERDICT body, so with no verdict yet
 *                   there is nothing to attach it to and the panel's
 *                   "Saved with your verdict" line is the honest state.
 *
 * TRIMMED COMPARISON, UNTRIMMED SAVE. Whitespace-only edits are not worth a
 * round trip, but whatever the coach typed is stored exactly as typed — the
 * founder's "exactly as is".
 */
export function shouldAutosaveDraft(
  draft: string | null | undefined,
  persisted: string | null | undefined,
  canSave: boolean
): boolean {
  if (!canSave) return false;
  const next = (draft ?? "").trim();
  const prev = (persisted ?? "").trim();
  if (next === prev) return false;
  // An empty box over an empty server value is a no-op; an empty box over
  // REAL text is a deliberate deletion and must be saved.
  return !(next === "" && prev === "");
}
