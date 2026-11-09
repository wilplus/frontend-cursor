/* -------------------------------------------------------------------------- */
/*  voiceNoteOutbox — a voice note kept on the phone until it is sent          */
/*  (backend N194: "only delete throws a note away").                          */
/*                                                                            */
/*  While a note is said, what is recorded so far is written here every few   */
/*  seconds, so closing the app at any moment keeps what was said. A note     */
/*  leaves the outbox only when the backend has kept it (or refused it for    */
/*  good: nothing heard), or when the person deletes it. IndexedDB, because   */
/*  five minutes of audio is too big for localStorage; where IndexedDB is     */
/*  missing (a private window), the outbox lives in memory for this page.     */
/*                                                                            */
/*  Whose it is (2026-11-09): each note names the person who said it, and     */
/*  only they see it or send it. A phone shared by two people kept one       */
/*  outbox and sent whatever waited under whoever was signed in, so A's note */
/*  could land in B's account. Another person's notes stay on the phone,     */
/*  untouched, until they sign in here again.                                */
/* -------------------------------------------------------------------------- */

import { getAuthToken } from "@/lib/api/auth-client";

export interface OutboxNote {
  /** Names the note to the backend, so a second send is kept once. */
  key: string;
  audio: Blob;
  durationMs: number;
  /** The words heard while it was said, hesitations and all: the bubble
   *  until it is kept. */
  words: string;
  /** The wave the words had not reached when it was sent (levels 0 to 1):
   *  drawn after the words until the note is kept (backend N199). */
  tail?: number[];
  /** Still being said in this page; a note left open by a closed app is not. */
  open: boolean;
  at: number;
  /** How long its live words were streamed (backend N396), if they were. */
  liveMs?: number;
  /** Who said it: the signed-in person's user id when it was saved. Absent
   *  on a note saved before notes named their owner (see `mine`). */
  owner?: string;
}

/** The person signed in on this phone, as the outbox reads them: from the
 *  token every call sends, so it answers to the person the backend sees. */
export interface OutboxOwner {
  id: string;
  /** When this sign-in began (ms, the server's clock): the earliest time
   *  in the token's `amr`. null when the token does not say. */
  since: number | null;
}

/** The person signed in now, or null signed out. */
export async function outboxOwner(): Promise<OutboxOwner | null> {
  return ownerOf(await getAuthToken());
}

/** The person a session token names, and when that sign-in began. */
export function ownerOf(token: string | null | undefined): OutboxOwner | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown; amr?: unknown };
    if (typeof claims.sub !== "string" || !claims.sub) return null;
    const times = (Array.isArray(claims.amr) ? claims.amr : [])
      .map((method) => Number((method as { timestamp?: unknown } | null)?.timestamp))
      .filter((t) => Number.isFinite(t) && t > 0);
    return { id: claims.sub, since: times.length ? Math.min(...times) * 1000 : null };
  } catch {
    return null;
  }
}

/** The sign-in's time is the server's clock and a note's the phone's: a
 *  phone running fast by up to this much cannot pass a note said before the
 *  sign-in as said after it. */
const CLOCK_SLACK_MS = 10 * 60_000;

/** Whether a note is this person's. One that names its owner is theirs
 *  only. One saved before notes named their owner (2026-11-09) is theirs
 *  only when this sign-in began before the note was said: then nobody else
 *  can have been signed in on this phone since, and the note was said
 *  under this sign-in. Otherwise its author cannot be known, and it waits,
 *  unsent, never shown and never deleted. */
function mine(note: OutboxNote, me: OutboxOwner): boolean {
  if (note.owner) return note.owner === me.id;
  return me.since !== null && me.since + CLOCK_SLACK_MS <= note.at;
}

const DB = "willab-voice-notes";
const STORE = "outbox";
const memory = new Map<string, OutboxNote>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbPromise ??= openDb();
  return dbPromise;
}

/** One request in its own transaction. Done only when the transaction has
 *  completed: a request can succeed and its transaction still abort, and
 *  then nothing was written. null when it failed or there is no IndexedDB. */
async function run<T>(
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<{ result: T } | null> {
  const handle = await db();
  if (!handle) return null;
  return new Promise((resolve) => {
    try {
      const tx = handle.transaction(STORE, mode);
      const request = act(tx.objectStore(STORE));
      tx.oncomplete = () => resolve({ result: request.result });
      tx.onabort = () => resolve(null);
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** True once the note is written on the phone; false where it lives only
 *  in memory for this page (no IndexedDB, or the write failed). */
export async function keepNote(note: OutboxNote): Promise<boolean> {
  memory.set(note.key, note);
  return (await run("readwrite", (store) => store.put(note))) !== null;
}

export async function dropNote(key: string): Promise<boolean> {
  memory.delete(key);
  return (await run("readwrite", (store) => store.delete(key))) !== null;
}

/** This person's notes waiting, oldest first, but for `saying`, the note
 *  being said right now; none while nobody is signed in. A note marked open
 *  by an earlier page (the app closed while it was said) is read as
 *  finished. A note without an owner found to be theirs is named theirs
 *  now, so it stays theirs after this sign-in ends. */
export async function waitingNotes(me: OutboxOwner | null, saying = ""): Promise<OutboxNote[]> {
  if (!me) return [];
  const stored = await run<OutboxNote[]>("readonly", (store) => store.getAll());
  const byKey = new Map<string, OutboxNote>();
  for (const note of stored?.result ?? []) byKey.set(note.key, note);
  for (const note of memory.values()) byKey.set(note.key, note);
  const notes = [...byKey.values()].filter((n) => n.key !== saying && n.audio && n.audio.size > 0 && mine(n, me));
  const named = notes.map((n) => (n.owner ? n : { ...n, owner: me.id }));
  await Promise.all(named.filter((n, i) => n !== notes[i]).map(keepNote));
  return named.sort((a, b) => a.at - b.at);
}

/** A key for a new note. */
export function noteKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
