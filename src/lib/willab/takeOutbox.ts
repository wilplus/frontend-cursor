import {
  submitLabRecording,
  type LabUploadInput,
  type LabUploadResult,
} from "@/services/api/labRecording";
import type { LabSessionContext } from "@/components/willab/LabOverlay";
import type { PresentationSlide } from "@/components/willab/presentation";
import type { Feeling } from "@/components/willab/willabFeelings";
import { openChatNow } from "@/components/willab/chats/loungePlace";
import { tagTakeMadeIn } from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  takeOutbox — a Take kept on the device until the server has it             */
/*  (backend N553 item 2, N556; the rules: docs/flows/recording-screens.md      */
/*  §1, Amendments).                                                           */
/*                                                                            */
/*  Saved once, at Finish, never while recording. The copy goes as soon as an */
/*  answer names a session (the server has the Take), when the speaker        */
/*  discards it, when the server refuses it for good, or after 7 days. Any    */
/*  other answer (no connection, 401, 403, 429, 5xx, a 504 without a session) */
/*  keeps it, and the Lounge sends it again (takeResend.ts) through the same  */
/*  upload with the same upload key, which the server answers with            */
/*  `duplicate` when it already has it: a Take is never made twice.            */
/*                                                                            */
/*  IndexedDB `willab-takes`, keyed by the upload key: `meta` (the owner, when */
/*  it was saved, its project, the upload's fields) and `audio`. Where         */
/*  IndexedDB is missing or fails, the copy lives in memory for this page, as */
/*  voiceNoteOutbox.ts does. Every call resolves and never throws: keeping a  */
/*  copy never stops or delays the upload.                                    */
/* -------------------------------------------------------------------------- */

/** The upload's own fields, as the first try sent them. */
export interface KeptUpload {
  durationSec: number;
  topic: string;
  audience: string;
  targetLengthSeconds: number | null;
  domainVocabulary: string[];
  slides: PresentationSlide[];
  /** The served deck PDF; null for the default deck. */
  presentationRef: string | null;
  strategicContext?: string;
  slideAdvances: { index: number; tMs: number }[];
  slideClockOffsetMs?: number;
  feeling?: Feeling;
}

export interface KeptTake {
  /** The upload idempotency key the first try used. */
  key: string;
  /** The signed-in person who recorded it: only they send it. */
  ownerId: string;
  savedAt: number;
  /** null until the first try (or a send again) made the project. */
  projectId: string | null;
  /** Recorded on the default deck: its project is made "deckless". */
  deckless: boolean;
  upload: KeptUpload;
  mimeType: string;
  /** The Take number this device expected it to be. */
  takeIndex: number | null;
}

interface KeptDocument {
  name: string;
  type: string;
  data: Blob | ArrayBuffer;
}

interface KeptAudio {
  key: string;
  audio: Blob | ArrayBuffer;
  document?: KeptDocument;
}

export const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const DB = "willab-takes";
const META = "meta";
const AUDIO = "audio";
const OPEN_LIMIT_MS = 2_000;
const PROJECT_WAIT_MS = 300;

const memory = new Map<string, { meta: KeptTake; audio: Blob; document?: File }>();
/** This page's saves still being written, by key. */
const saving = new Map<string, Promise<boolean>>();
/** Going up from this page now: never sent a second time beside itself. */
const live = new Set<string>();
/** A retry of the same recording is not a second Finish. */
const keptBlobs = new WeakSet<Blob>();

function later<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (handle: IDBDatabase | null) => {
      clearTimeout(timer);
      if (settled) {
        handle?.close();
        return;
      }
      settled = true;
      resolve(handle);
    };
    const timer = setTimeout(() => done(null), OPEN_LIMIT_MS);
    try {
      if (typeof indexedDB === "undefined") return done(null);
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        const handle = request.result;
        if (!handle.objectStoreNames.contains(META)) handle.createObjectStore(META, { keyPath: "key" });
        if (!handle.objectStoreNames.contains(AUDIO)) handle.createObjectStore(AUDIO, { keyPath: "key" });
      };
      request.onsuccess = () => {
        const handle = request.result;
        handle.onversionchange = () => {
          handle.close();
          dbPromise = null;
        };
        done(handle);
      };
      request.onerror = () => done(null);
    } catch {
      done(null);
    }
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbPromise ??= openDb().then((handle) => {
    // Not kept: the next call tries to open it again.
    if (!handle) dbPromise = null;
    return handle;
  });
  return dbPromise;
}

/** One transaction; true only once it is complete. */
function write(handle: IDBDatabase, act: (tx: IDBTransaction) => void): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = handle.transaction([META, AUDIO], "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      try {
        act(tx);
      } catch {
        // A Blob this WebView cannot store (DataCloneError), or a closed
        // database: nothing of this transaction is kept.
        resolve(false);
        tx.abort();
      }
    } catch {
      resolve(false);
    }
  });
}

function read<T>(handle: IDBDatabase, store: string, act: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const request = act(handle.transaction(store, "readonly").objectStore(store));
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function documentOf(file: File | undefined, data: Blob | ArrayBuffer | undefined): KeptDocument | undefined {
  return file && data ? { name: file.name, type: file.type, data } : undefined;
}

async function bytesOf(audio: Blob, document?: File): Promise<KeptAudio | null> {
  try {
    const data = document ? await document.arrayBuffer() : undefined;
    return { key: "", audio: await audio.arrayBuffer(), document: documentOf(document, data) };
  } catch {
    return null;
  }
}

async function writeTake(take: KeptTake, audio: Blob, document?: File): Promise<boolean> {
  const handle = await db();
  if (!handle) return false;
  const put = (row: KeptAudio) =>
    write(handle, (tx) => {
      tx.objectStore(META).put(take);
      tx.objectStore(AUDIO).put({ ...row, key: take.key });
    });
  if (await put({ key: take.key, audio, document: documentOf(document, document) })) return true;
  // Some WebViews refuse a Blob in IndexedDB: the same Take as bytes. A full
  // disk fails this too, and the Take simply goes up as it is.
  const bytes = await bytesOf(audio, document);
  return bytes ? put(bytes) : false;
}

/** Keep a Take on the device. True once it is written to the device; it is
 *  in this page's memory either way. */
export function keepTake(take: KeptTake, audio: Blob, document?: File): Promise<boolean> {
  memory.set(take.key, { meta: take, audio, document });
  const written = writeTake(take, audio, document).catch(() => false);
  saving.set(take.key, written);
  return written;
}

/** The recording as Finish hands it to the upload. */
export interface FinishedTake {
  blob: Blob;
  key: string;
  ownerId: string | null;
  /** An answer or a question recorded in a chat (N363): not kept, for now. */
  answer: unknown;
  /** A picked file, not a recording: not kept. */
  picked: boolean;
  context: LabSessionContext;
  slides: PresentationSlide[];
  deckless: boolean;
  projectId: string | null;
  takeIndex: number | null;
  durationSec: number;
  slideAdvances: { index: number; tMs: number }[];
  slideClockOffsetMs: number | undefined;
  feeling: Feeling | null;
}

/** At Finish, once per recording: keep it until the server has it. Never
 *  awaited; the upload goes at once beside it. A signed-in speaker's Lab
 *  Take only. */
export function keepTakeAtFinish(take: FinishedTake): void {
  if (!take.ownerId || take.answer || take.picked || keptBlobs.has(take.blob)) return;
  keptBlobs.add(take.blob);
  try {
    void keepTake(keptTakeOf(take, take.ownerId), take.blob, take.context.contextDocument);
  } catch {
    // An odd set-up never stands between Finish and the upload.
  }
}

function keptTakeOf(take: FinishedTake, ownerId: string): KeptTake {
  const { context } = take;
  return {
    key: take.key,
    ownerId,
    savedAt: Date.now(),
    projectId: take.projectId,
    deckless: take.deckless,
    upload: {
      durationSec: take.durationSec,
      topic: context.topic,
      audience: context.audience ?? "",
      targetLengthSeconds: context.target_length_seconds ?? null,
      domainVocabulary: [...(context.domain_vocabulary ?? [])],
      slides: (take.slides ?? []).map((s) => ({ ...s })),
      presentationRef: take.deckless ? null : (context.presentationRef ?? null),
      strategicContext: context.strategicContext,
      slideAdvances: (take.slideAdvances ?? []).map((a) => ({ ...a })),
      slideClockOffsetMs: take.slideClockOffsetMs,
      feeling: take.feeling ?? undefined,
    },
    mimeType: take.blob.type,
    takeIndex: take.takeIndex,
  };
}

/** The saved Take's project, once made, so a send again never makes another. */
export async function setTakeProject(key: string, projectId: string): Promise<boolean> {
  const held = memory.get(key);
  if (held) held.meta = { ...held.meta, projectId };
  // A save still being written lands first.
  await saving.get(key);
  const handle = await db();
  if (!handle) return false;
  return write(handle, (tx) => {
    const store = tx.objectStore(META);
    const request = store.get(key);
    request.onsuccess = () => {
      const meta = request.result as KeptTake | undefined;
      if (meta) store.put({ ...meta, projectId });
    };
  });
}

/** The first try made the project: the copy learns it before the Take goes
 *  up, waiting at most 300 ms. */
export async function rememberTakeProject(key: string, projectId: string): Promise<void> {
  if (!memory.has(key)) return;
  await Promise.race([setTakeProject(key, projectId).catch(() => false), later(PROJECT_WAIT_MS, false)]);
}

export async function dropTake(key: string): Promise<void> {
  memory.delete(key);
  // A save still being written would put it back after the delete.
  await saving.get(key);
  saving.delete(key);
  const handle = await db();
  if (!handle) return;
  await write(handle, (tx) => {
    tx.objectStore(META).delete(key);
    tx.objectStore(AUDIO).delete(key);
  });
}

function isKeptTake(value: unknown): value is KeptTake {
  const t = value as Partial<KeptTake> | null;
  return (
    !!t &&
    typeof t.key === "string" &&
    typeof t.ownerId === "string" &&
    typeof t.savedAt === "number" &&
    typeof t.upload?.topic === "string"
  );
}

/** Every Take kept on this device, oldest first. */
export async function waitingTakes(): Promise<KeptTake[]> {
  const handle = await db();
  const stored = handle ? await read<unknown[]>(handle, META, (s) => s.getAll()) : null;
  const byKey = new Map<string, KeptTake>();
  for (const meta of stored ?? []) if (isKeptTake(meta)) byKey.set(meta.key, meta);
  for (const { meta } of memory.values()) byKey.set(meta.key, meta);
  return [...byKey.values()].sort((a, b) => a.savedAt - b.savedAt);
}

/** The Take's audio (and the brief that rode its first try), or null. */
export async function takeAudio(take: KeptTake): Promise<{ audio: Blob; document?: File } | null> {
  const held = memory.get(take.key);
  if (held) return { audio: held.audio, document: held.document };
  const handle = await db();
  const row = handle ? await read<KeptAudio>(handle, AUDIO, (s) => s.get(take.key)) : null;
  if (!row?.audio) return null;
  const audio = row.audio instanceof Blob ? row.audio : new Blob([row.audio], { type: take.mimeType });
  const doc = row.document;
  return { audio, document: doc ? new File([doc.data], doc.name, { type: doc.type }) : undefined };
}

export function expiredTake(take: KeptTake, now = Date.now()): boolean {
  return now - take.savedAt > KEEP_MS;
}

/** Being sent from this page right now. */
export function isLive(key: string): boolean {
  return live.has(key);
}

/** Refused for good: sending it again can only be refused again. */
function refusedForGood(result: Extract<LabUploadResult, { kind: "error" }>): boolean {
  if (result.status === 400 || result.status === 404 || result.status === 413) return true;
  if (result.status === 409 && result.code === "PROJECT_DELETION_PENDING") return true;
  // Recording consent was withdrawn (N556 item 3).
  return result.code === "PROCESSING_RECORDING_WITHDRAWN";
}

/** What an answer means for the copy (N556 item 1). The server has it: any
 *  answer naming a session (201, 202, 200 duplicate, 200
 *  failed_ideal_text_unconfirmed, a 504 with a session). Gone: discarded, or
 *  refused for good (422 or the no-speech guard, 400, 404, 409
 *  PROJECT_DELETION_PENDING, 413). Kept: everything else. */
export function takeOutcome(result: LabUploadResult): "server_has_it" | "gone" | "kept" {
  if (result.kind === "ok" || result.kind === "processing" || result.kind === "ideal_text_unconfirmed") {
    return "server_has_it";
  }
  if (result.kind === "error") return refusedForGood(result) ? "gone" : "kept";
  return "gone";
}

/** The server has this Take: an older copy of the same project must never
 *  go after it, or it would become the Ideal Text (Never 5). */
async function dropOlderOfProject(key: string): Promise<void> {
  const all = await waitingTakes();
  const mine = all.find((t) => t.key === key);
  if (!mine?.projectId) return;
  for (const t of all) {
    if (t.key !== key && t.projectId === mine.projectId && t.savedAt < mine.savedAt) await dropTake(t.key);
  }
}

/** The one decision table: after any answer, the copy goes or stays. */
export async function settleTake(key: string, result: LabUploadResult): Promise<void> {
  const outcome = takeOutcome(result);
  if (outcome === "kept") return;
  if (outcome === "server_has_it") await dropOlderOfProject(key);
  await dropTake(key);
}

/** THE upload, for the first try and a send again alike: submitLabRecording,
 *  then the copy is settled. The answer comes back at once; the settling
 *  runs behind it, and the Take counts as going up until it is done. */
export async function sendTake(
  input: LabUploadInput,
  opts?: { signal?: AbortSignal },
): Promise<LabUploadResult> {
  const key = input.uploadIdempotencyKey;
  // The host's chat it was recorded in, as it first went up (N648 item 8).
  const chat = madeIn.get(key) ?? openChatNow();
  if (chat) madeIn.set(key, chat);
  live.add(key);
  let result: LabUploadResult;
  try {
    result = await submitLabRecording(input, opts);
  } catch (error) {
    live.delete(key);
    throw error;
  }
  void settleTake(key, result)
    .catch(() => undefined)
    .finally(() => live.delete(key));
  tagMadeIn(key, chat, result);
  return result;
}

/** The host's chat each Take went up in, by its upload key, for this page
 *  (backend N648 item 8); a Take sent again after a reload has none. */
const madeIn = new Map<string, string>();
const tagged = new Set<string>();

/** Once the server has the Take, it is tagged with the host's chat it was
 *  made in: once per Take, best effort. A failed tag stops nothing, since
 *  the Take goes through the one loop all the same. A Take made anywhere
 *  else (the speaking chat) has no chat and posts nothing. */
function tagMadeIn(key: string, chat: string | null, result: LabUploadResult): void {
  if (!chat || tagged.has(key) || takeOutcome(result) !== "server_has_it" || !("sessionId" in result) || !result.sessionId) return;
  tagged.add(key);
  void tagTakeMadeIn(chat, result.sessionId).catch(() => false);
}

/** A person's Takes kept on this device go (their account is being deleted). */
export async function clearOwnerTakes(ownerId: string): Promise<void> {
  for (const take of await waitingTakes()) {
    if (take.ownerId === ownerId) await dropTake(take.key);
  }
}

/** The signed-in person's kept Takes go. Never throws. */
export async function forgetSignedInTakes(): Promise<void> {
  try {
    const { readSession } = await import("@/lib/supabase/session");
    const owner = (await readSession())?.user?.id;
    if (owner) await clearOwnerTakes(owner);
  } catch {
    /* no session to read: nothing of theirs to name */
  }
}

export function __resetTakeOutboxForTests(): void {
  memory.clear();
  saving.clear();
  live.clear();
  madeIn.clear();
  tagged.clear();
  dbPromise = null;
}
