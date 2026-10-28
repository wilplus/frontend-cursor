/* -------------------------------------------------------------------------- */
/*  The Sunday note as a lens — the words (backend N158, N170; rules           */
/*  docs/flows/principles.md §1 L; prototype                                   */
/*  https://claude.ai/artifact/Bt2YEZLKhu9fLTA1deWTvo). The questions and      */
/*  Will's lines come from the backend as rows of the thread; these are the    */
/*  lens's own taps. Every line is signed (N158). No new words without the     */
/*  founder's OK.                                                             */
/* -------------------------------------------------------------------------- */

export const SUNDAY_COPY = {
  bar: "Sunday note",
  head: "We spotted a pattern!",
  investigate: "Investigate",
  notNow: "Not now",
  bugs: [
    { key: "too_much_pleasure", emoji: "👾", label: "Too much pleasure" },
    { key: "blind_spots", emoji: "👾", label: "Blind spots" },
    { key: "hubris", emoji: "👾", label: "Hubris" },
    { key: "wishful_thinking", emoji: "👾", label: "Wishful thinking" },
  ],
  addBug: "Add a new bug",
  nameBug: "Name the new bug",
  add: "Add",
  back: "Back",
  noneYet: "None yet",
  next: "Next",
  skip: "Skip",
  accept: "Accept",
  edit: "Edit",
  addPrinciple: "Add principle",
  close: "Close",
} as const;

type Row = { role?: string; metadata?: Record<string, unknown> | null; body?: string };

/** The note a "We spotted a pattern!" row opens, or null (L8). */
export function sundayHeadOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const id = metadata?.sunday_note_id;
  return metadata?.sunday_step === "head" && typeof id === "string" ? id : null;
}

/** The note the newest Not now | Investigate ask is about. */
export function sundayAskOf(messages: readonly Row[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = messages[i].metadata;
    if (meta?.offer === "sunday_note" && typeof meta.sunday_note_id === "string") return meta.sunday_note_id;
  }
  return null;
}

/** Is the note still waiting on the speaker (the orange outline, L8)? Done
 *  once Will's last line is in the thread, or after Not now. */
export function sundayWaiting(messages: readonly Row[], noteId: string): boolean {
  return !messages.some((m) => {
    const meta = m.metadata;
    if (meta?.sunday_note_id !== noteId || m.role !== "bot") return false;
    return meta.sunday_step === "principle" || meta.sunday_step === "dismiss" || (meta.sunday_step === "reflection" && m.body === "Noted.");
  });
}
