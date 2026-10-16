import {
  fetchTrainingConsent,
  setTrainingConsent,
  trainingRefusalCode,
  type TrainingConsent,
} from "@/services/api/trainingConsent";

/* -------------------------------------------------------------------------- */
/*  A visitor's training yes, kept on the device until they sign in (founder  */
/*  2026-10-15, "Build it", https://claude.ai/artifact/BhGkepDTQbZc1FHANT4X5Q). */
/*                                                                            */
/*  A visitor who is not signed in sees all three things to confirm. A yes    */
/*  needs an account to be saved, so it is kept here, with the exact words    */
/*  they saw, and sent as an ordinary yes the moment they sign in, after the  */
/*  guest's work is claimed into the account (the grant needs that receipt). */
/*  They are never asked twice. Nothing leaves the device before sign-in; a  */
/*  note older than 30 days, or one for words no longer in force, is thrown  */
/*  away, never sent.                                                         */
/* -------------------------------------------------------------------------- */

const KEY = "willab.pendingTrainingYes";
const MAX_AGE_MS = 30 * 86_400_000;

interface Note {
  policyVersion: string;
  copySha256: string;
  savedAt: number;
}

function read(): Note | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const note = raw ? (JSON.parse(raw) as Partial<Note>) : null;
    if (!note?.policyVersion || !note.copySha256 || typeof note.savedAt !== "number") return null;
    return note as Note;
  } catch {
    return null;
  }
}

export function clearPendingTrainingYes(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing was kept either */
  }
}

/** The visitor ticked the yes: keep it, with the words they saw. */
export function keepPendingTrainingYes(shown: TrainingConsent): void {
  if (!shown.policyVersion || !shown.copySha256) return;
  try {
    const note: Note = {
      policyVersion: shown.policyVersion,
      copySha256: shown.copySha256,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(note));
  } catch {
    /* storage blocked: they are asked again after sign-in, as before */
  }
}

/** Signed in now: send the kept yes once, if it is still for the words in
 *  force. Kept for a later try when the account cannot take it yet (its
 *  acceptance is still to come); thrown away otherwise. Never throws. */
export async function sendPendingTrainingYes(): Promise<void> {
  const note = read();
  if (!note) return;
  if (Date.now() - note.savedAt > MAX_AGE_MS) {
    clearPendingTrainingYes();
    return;
  }
  const now = await fetchTrainingConsent();
  if (!now) return; // could not read: try again next time
  if (!now.available || now.active || now.policyVersion !== note.policyVersion
      || now.copySha256 !== note.copySha256) {
    clearPendingTrainingYes();
    return;
  }
  const saved = await setTrainingConsent(true, now);
  const code = trainingRefusalCode(saved);
  if (code === "TRAINING_CONSENT_NEEDS_POLICY_RECEIPT" || code === "NETWORK") return;
  clearPendingTrainingYes();
}
