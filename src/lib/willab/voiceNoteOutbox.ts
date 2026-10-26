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
/* -------------------------------------------------------------------------- */

export interface OutboxNote {
  /** Names the note to the backend, so a second send is kept once. */
  key: string;
  audio: Blob;
  durationMs: number;
  /** The words heard while it was said, hesitations and all: the bubble
   *  until it is kept. */
  words: string;
  /** The wave the words had not reached when it was sent (levels 0 to 1):
   *  drawn after the words until the note is kept (backend N198). */
  tail?: number[];
  /** Still being said in this page; a note left open by a closed app is not. */
  open: boolean;
  at: number;
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

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const handle = await db();
  if (!handle) return null;
  return new Promise((resolve) => {
    try {
      const request = act(handle.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function keepNote(note: OutboxNote): Promise<void> {
  memory.set(note.key, note);
  await run("readwrite", (store) => store.put(note));
}

export async function dropNote(key: string): Promise<void> {
  memory.delete(key);
  await run("readwrite", (store) => store.delete(key));
}

/** Every note waiting, oldest first. A note marked open by an earlier page
 *  (the app closed while it was said) is read as finished. */
export async function waitingNotes(): Promise<OutboxNote[]> {
  const stored = await run<OutboxNote[]>("readonly", (store) => store.getAll());
  const byKey = new Map<string, OutboxNote>();
  for (const note of stored ?? []) byKey.set(note.key, note);
  for (const note of memory.values()) byKey.set(note.key, note);
  return [...byKey.values()].filter((n) => n.audio && n.audio.size > 0).sort((a, b) => a.at - b.at);
}

/** A key for a new note. */
export function noteKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
