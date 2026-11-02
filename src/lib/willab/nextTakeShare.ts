import { fetchRememberedShare, shareTake } from "@/services/api/communities";

/* -------------------------------------------------------------------------- */
/*  SHARING THE NEXT TAKE (flow page G; backend N309 item 5). Sharing is      */
/*  asked once, the first time "Record Take 2" is tapped; after that the      */
/*  choice is remembered: the line under each Take's recording carries it    */
/*  (`ShareChoiceMeta`), the server reads the newest one back                */
/*  (`rememberedChoice`), and it is asked again only when the words change   */
/*  or a community is added. Either way the choice is made before the Take   */
/*  exists, so it is kept here and applied to the next Take once its upload  */
/*  names it. Nothing kept, or kept too long ago: the Take stays private,    */
/*  the safe side.                                                            */
/* -------------------------------------------------------------------------- */

/** The version of the words the speaker saw; the server lists it. */
export const NEXT_SHARE_WORDS_VERSION = "sharing-screen-2026-10-12";

/** The server's shortest pass code (services/communities.PASS_CODE_MIN). */
export const SHARE_PASS_CODE_MIN = 6;

const KEY = "willab.nextTakeShare";
const KEEP_MS = 6 * 60 * 60 * 1000;

export type NextTakeShare = { general: boolean; communityIds: string[] };

/** The choice as the line under a Take's recording carries it in its
 *  metadata (`share`), "Only me" included, with the words the speaker saw:
 *  the server remembers it from there (backend N309 item 5). */
export type ShareChoiceMeta = { general: boolean; community_ids: string[]; none: boolean; words_version: string };

/** The choice the screen's ticks make ("general", "mine", "none"), with the
 *  communities ticked under "mine". */
export function shareChoiceMeta(ticks: readonly string[], communityIds: readonly string[]): ShareChoiceMeta {
  const none = ticks.includes("none");
  return {
    general: !none && ticks.includes("general"),
    community_ids: !none && ticks.includes("mine") ? [...communityIds] : [],
    none,
    words_version: NEXT_SHARE_WORDS_VERSION,
  };
}

/** The choice a stored line carries; null for one stored without it. */
export function shareChoiceOf(meta: Record<string, unknown> | null | undefined): ShareChoiceMeta | null {
  const share = meta?.share;
  if (!share || typeof share !== "object") return null;
  const raw = share as Record<string, unknown>;
  if (typeof raw.words_version !== "string") return null;
  return {
    general: raw.general === true,
    community_ids: Array.isArray(raw.community_ids)
      ? raw.community_ids.filter((id): id is string => typeof id === "string")
      : [],
    none: raw.none === true,
    words_version: raw.words_version,
  };
}

/** The screen's ticks for a choice, in the screen's order. */
export function ticksOf(choice: Pick<ShareChoiceMeta, "general" | "community_ids" | "none">): string[] {
  if (choice.none) return ["none"];
  return [...(choice.general ? ["general"] : []), ...(choice.community_ids.length ? ["mine"] : [])];
}

/** The remembered choice when "Record Take N" may go straight to the
 *  recording with it, and the names of the communities it names (for its
 *  line); null asks (nothing chosen yet, other words, a community added
 *  since, or no answer from the server: asking is never wrong). */
export async function rememberedChoice(): Promise<{ share: ShareChoiceMeta; names: string[] } | null> {
  const res = await fetchRememberedShare();
  const choice = res.ok && !res.data.ask ? res.data.choice : null;
  // The words this screen shows, whatever the server lists as newest.
  if (!choice || choice.wordsVersion !== NEXT_SHARE_WORDS_VERSION) return null;
  return {
    share: {
      general: choice.general,
      community_ids: choice.communityIds,
      none: choice.none,
      words_version: NEXT_SHARE_WORDS_VERSION,
    },
    names: choice.communities.map((c) => c.name ?? "").filter(Boolean),
  };
}

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
