/* -------------------------------------------------------------------------- */
/*  labUploadStage — hand a picked file from the Lounge footer to the Lab       */
/*                                                                            */
/*  When the user asks to upload in chat, the footer's record button becomes a  */
/*  file picker. A File can't ride localStorage (not serialisable) and the      */
/*  Lounge → Lab handoff is same-tab + immediate, so a tiny in-memory stash is  */
/*  the right primitive: stage the pick, open the Lab, and the Lab consumes it   */
/*  on mount (take-once). If the Lab never opens, the ref is simply overwritten  */
/*  by the next pick or ignored — nothing leaks across sessions.                */
/* -------------------------------------------------------------------------- */

let staged: File | null = null;

/** Stash the picked file, then open the Lab (onStart). */
export function stageLabUpload(file: File): void {
  staged = file;
}

/** Consume the staged file (clears it). Returns null when nothing is staged. */
export function takeLabUpload(): File | null {
  const f = staged;
  staged = null;
  return f;
}
