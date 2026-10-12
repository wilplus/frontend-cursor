import { shareTake } from "@/services/api/communities";

/* -------------------------------------------------------------------------- */
/*  SHARING THE NEXT TAKE (founder lock 2026-10-12, moment and feedback chat,  */
/*  section 5). The question is asked when "Record Take N" is tapped, before  */
/*  the Take exists, so the choice is kept here and applied to the next Take  */
/*  once its upload names it. Nothing kept, or kept too long ago: the Take   */
/*  stays private, the safe side.                                            */
/* -------------------------------------------------------------------------- */

/** The version of the words the speaker saw; the server lists it. */
export const NEXT_SHARE_WORDS_VERSION = "sharing-screen-2026-10-12";

const KEY = "willab.nextTakeShare";
const KEEP_MS = 6 * 60 * 60 * 1000;

export type NextTakeShare = { general: boolean; communityIds: string[] };

/** Keep the choice for the next Take; null keeps nothing (Only me). */
export function keepNextTakeShare(choice: NextTakeShare | null): void {
  try {
    if (choice) localStorage.setItem(KEY, JSON.stringify({ ...choice, at: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {
    // No storage: the next Take stays private.
  }
}

/** Share the Take just uploaded as the speaker chose, once. */
export function applyNextTakeShare(takeSessionId: string | null | undefined): void {
  if (!takeSessionId) return;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const kept = JSON.parse(raw) as { general?: unknown; communityIds?: unknown; at?: unknown };
    if (typeof kept.at !== "number" || Date.now() - kept.at > KEEP_MS) return;
    const communityIds = Array.isArray(kept.communityIds)
      ? kept.communityIds.filter((id): id is string => typeof id === "string")
      : [];
    void shareTake(takeSessionId, {
      general: kept.general === true,
      communityIds,
      none: false,
      shareWordsVersion: NEXT_SHARE_WORDS_VERSION,
    });
  } catch {
    // Unreadable: the Take stays private.
  }
}
