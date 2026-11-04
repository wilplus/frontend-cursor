import { fetchRememberedShare, shareTake } from "@/services/api/communities";
import { fetchLastSend, fetchSendPeople, sendTake, type SendChoice, type SendPerson } from "@/services/api/takeSends";

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

/** Keep the choice for the next Take; null keeps nothing (Only me). A
 *  people choice (N470) is sent, not shared, once the Take is up. */
export function keepNextTakeShare(choice: NextTakeShare | KeptSend | null): void {
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
    const kept = JSON.parse(raw) as { general?: unknown; communityIds?: unknown; at?: unknown; kind?: unknown; all?: unknown; userIds?: unknown };
    if (typeof kept.at !== "number" || Date.now() - kept.at > KEEP_MS) return;
    if (kept.kind === "people") {
      // Sent after the upload, never waited on: a refusal leaves the Take
      // unsent and the loop goes on (R2); a retry never posts twice.
      void sendTake(takeSessionId, { all: kept.all === true, userIds: strings(kept.userIds) }).catch(() => null);
      return;
    }
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

/* -------------------------------------------------------------------------- */
/*  WHO HEARS THIS TAKE (backend N470, N472; rules page G). Behind the        */
/*  backend's switch: while it is off, or when its reads fail, everything     */
/*  above stays exactly as it is (today's G1). On, the screen lists the       */
/*  people in your chats; the choice is kept like the community one and the  */
/*  Take is sent to them once its upload names it, each as your own message  */
/*  in your chat with them.                                                   */
/* -------------------------------------------------------------------------- */

/** The choice as the line under a Take's recording carries it
 *  (`metadata.share`), the shape the backend reads back (N472). */
export type PeopleShareMeta = { kind: "people"; all: boolean; user_ids: string[]; names: string[] };

/** The people choice kept for the next upload. */
export type KeptSend = { kind: "people"; all: boolean; userIds: string[] };

/** The switch on, with the list and the last choice; or off (or failed). */
export type SendRead = { enabled: true; people: SendPerson[]; choice: SendChoice | null } | { enabled: false };

const SEEN_KEY = "willab.sendSeen";

/** The longest "Record Take N" waits for the choice before it asks (R1). */
export const SEND_READ_CAP_MS = 1500;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/** A people choice a stored line carries; null for any other line. */
export function peopleChoiceOf(meta: Record<string, unknown> | null | undefined): PeopleShareMeta | null {
  const share = meta?.share;
  if (!share || typeof share !== "object") return null;
  const raw = share as Record<string, unknown>;
  if (raw.kind !== "people") return null;
  return { kind: "people", all: raw.all === true, user_ids: strings(raw.user_ids), names: strings(raw.names) };
}

/** The switch, the list and the last choice, read together; off on any
 *  failure, so today's screen stays (R3, R6). */
export async function readSend(): Promise<SendRead> {
  const [people, last] = await Promise.all([fetchSendPeople(), fetchLastSend()]);
  if (!people?.enabled || !last?.enabled) return { enabled: false };
  return { enabled: true, people: people.people, choice: last.choice };
}

/** A promise, or `fallback` once `ms` have passed. */
export function within<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** The people shown when the speaker last chose (per device; asking once
 *  when someone new joins a choice of chosen people, N472 item 5). */
export function rememberSeen(userIds: readonly string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(userIds));
  } catch {
    // No storage: someone new is asked about once more.
  }
}

function seenIds(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(strings(JSON.parse(raw))) : null;
  } catch {
    return null;
  }
}

/** What "Record Take N" does with the switch on: record with nothing sent
 *  (nobody in the list, R3), ask (no choice yet; nobody of the choice left;
 *  someone new joined a choice of chosen people), or send as chosen.
 *  "Everyone in my list" takes in someone new silently (N472 item 5). */
export function sendDecision(read: { people: SendPerson[]; choice: SendChoice | null }):
  | { go: "record" }
  | { go: "ask" }
  | { go: "send"; share: PeopleShareMeta } {
  const { people, choice } = read;
  if (!people.length) return { go: "record" };
  if (!choice) return { go: "ask" };
  if (choice.all) {
    return { go: "send", share: { kind: "people", all: true, user_ids: people.map((p) => p.userId), names: people.map((p) => p.name) } };
  }
  const chosen = people.filter((p) => choice.userIds.includes(p.userId));
  if (!chosen.length) return { go: "ask" };
  const seen = seenIds() ?? new Set(choice.userIds);
  if (people.some((p) => !choice.userIds.includes(p.userId) && !seen.has(p.userId))) return { go: "ask" };
  return { go: "send", share: { kind: "people", all: false, user_ids: chosen.map((p) => p.userId), names: chosen.map((p) => p.name) } };
}

/** The kept form of a people choice, for the upload. */
export function keptSendOf(share: PeopleShareMeta): KeptSend {
  return { kind: "people", all: share.all, userIds: share.user_ids };
}
