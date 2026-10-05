import type { CoachMessage } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  HAS THE SPEAKER READ THE COACH'S WORD FOR THIS TAKE? (founder 2026-10-05, */
/*  N48.3 Q11 A; contract 35g-6.)                                             */
/*                                                                            */
/*  A coach's word belongs to its Take, and Step 0 ("Your coach") is reached  */
/*  whenever an unseen word exists for the Take on screen, even after every  */
/*  moment is answered. The backend serves the word of the Take on screen    */
/*  and names that Take; this remembers, per device, which word was opened.  */
/*  A word is seen once Step 0 has shown it. A later word (a second coach, a */
/*  re-share, new words) is a new key, so it is unseen again.                */
/*                                                                            */
/*  Browser storage only, best-effort: a private window or blocked storage   */
/*  reads every word as unseen, which costs at most one more "Review         */
/*  feedback" tap. Nothing opens by itself (J1).                             */
/* -------------------------------------------------------------------------- */

const PREFIX = "willab.coach_word_seen.v1";

/** A short stable fingerprint of the words, so an edited word reads new. */
function fingerprint(text: string | null): string {
  let h = 5381;
  for (const ch of text ?? "") h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** The key one word is remembered by, or null without a word or a Take. */
export function coachWordKey(arcId: string | null, message: CoachMessage | null): string | null {
  if (!arcId || !message) return null;
  const take = message.takeSessionId ?? (message.takeIndex !== null ? `take-${message.takeIndex}` : null);
  if (!take) return null;
  return [PREFIX, arcId, take, message.publishedAt ?? "", fingerprint(message.text)].join(":");
}

/** Has Step 0 already shown this word on this device? */
export function coachWordSeen(key: string | null): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Step 0 showed this word. */
export function markCoachWordSeen(key: string | null): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* blocked storage: the word stays unseen on this device */
  }
}
