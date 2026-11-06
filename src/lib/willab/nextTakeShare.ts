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

/** Share the Take just uploaded as the speaker chose, once; a people send
 *  is kept until it has gone (`retryTakeSends`, N541). */
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
      // Sent after the upload, never waited on (R2), and kept on the phone
      // until it has gone (N541): a failed send is tried again.
      const send = { takeSessionId, all: kept.all === true, userIds: strings(kept.userIds), at: kept.at };
      keepPendingSend(send);
      deliver(send);
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
/*  WHO HEARS THIS TAKE (backend N470, N479; rules page G). Behind the        */
/*  backend's switch: while it is off, or when its reads fail, everything     */
/*  above stays exactly as it is (today's G1). On, the screen lists the       */
/*  people in your chats; the choice is kept like the community one and the  */
/*  Take is sent to them once its upload names it, each as your own message  */
/*  in your chat with them.                                                   */
/* -------------------------------------------------------------------------- */

/** The choice as the line under a Take's recording carries it
 *  (`metadata.share`), the shape the backend reads back (N479). */
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
 *  when someone new joins a choice of chosen people, N479 item 5). */
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
 *  "Everyone in my list" takes in someone new silently (N479 item 5). */
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

/* -------------------------------------------------------------------------- */
/*  A SEND THAT HAS NOT GONE YET (backend N541; rules page G3). Every Take a  */
/*  speaker sends reaches the people they chose (N470 item 8). A people send  */
/*  is kept on the phone, under its own key so the next Take's choice never   */
/*  replaces it, until the server says it went: a failed try is tried again   */
/*  a few seconds later, then at the next open, within the choice's own time  */
/*  (`KEEP_MS`, from when it was chosen). Never waited on (R2). A retry never */
/*  posts twice: the server gives each Take one message per chat (backend     */
/*  services/take_sends.py `_post_one`). One try at a time per Take.          */
/* -------------------------------------------------------------------------- */

const PENDING_KEY = "willab.pendingTakeSends";

/** After a failed try, the next one: 5 s, then 30 s; then the next open. */
const RETRY_AFTER_MS = [5_000, 30_000] as const;

type PendingSend = { takeSessionId: string; all: boolean; userIds: string[]; at: number };

/** The Takes whose send is under way in this page: a try in flight, or the
 *  wait before the next one. */
const underWay = new Set<string>();

const inTime = (send: PendingSend) => Date.now() - send.at <= KEEP_MS;

function pendingSends(): PendingSend[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((item): PendingSend[] => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      if (typeof row.takeSessionId !== "string" || !row.takeSessionId || typeof row.at !== "number") return [];
      return [{ takeSessionId: row.takeSessionId, all: row.all === true, userIds: strings(row.userIds), at: row.at }];
    });
  } catch {
    return [];
  }
}

function writePendingSends(list: readonly PendingSend[]): void {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // No storage: the send is still tried again in this page.
  }
}

/** The others still in time, without this Take. */
function othersThan(takeSessionId: string): PendingSend[] {
  return pendingSends().filter((p) => p.takeSessionId !== takeSessionId && inTime(p));
}

function keepPendingSend(send: PendingSend): void {
  writePendingSends([...othersThan(send.takeSessionId), send]);
}

/** Try the send now; a failure tries again later, and until one goes it
 *  stays kept. Nothing awaits this. */
function deliver(send: PendingSend): void {
  if (underWay.has(send.takeSessionId)) return;
  underWay.add(send.takeSessionId);
  const attempt = (tries: number): void => {
    void sendTake(send.takeSessionId, { all: send.all, userIds: send.userIds })
      .catch(() => null)
      .then((sent) => {
        const wait = RETRY_AFTER_MS[tries];
        // Gone, or past its time: nothing is kept for it.
        if (sent || !inTime(send)) writePendingSends(othersThan(send.takeSessionId));
        if (sent || !inTime(send) || wait === undefined) {
          underWay.delete(send.takeSessionId);
          return;
        }
        setTimeout(() => attempt(tries + 1), wait);
      });
  };
  attempt(0);
}

/** At an open, signed in, once the thread has painted (WillabSurface): every
 *  people send still kept on this phone is tried again, within its time. */
export function retryTakeSends(): void {
  const kept = pendingSends();
  const live = kept.filter(inTime);
  if (live.length !== kept.length) writePendingSends(live);
  for (const send of live) deliver(send);
}
