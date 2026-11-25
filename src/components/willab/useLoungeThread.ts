"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendLoungeMessages,
  clearLoungeThread,
  fetchLoungeHistory,
  newestStamp,
  stampLoungeMessage,
  type LoungeMessage,
  type LoungeMessageDraft,
} from "@/services/api/loungeMessages";
import {
  appendLocalLoungeMessage,
  clearLocalLoungeThread,
  LOUNGE_THREAD_MERGED_EVENT,
  mergeLocalLoungeThreadToServer,
  loadLocalLoungeThread,
} from "@/lib/funnel/loungeLocalThread";
import { announceDiscoveriesFromPersistedMessages } from "@/lib/productDiscovery";
import { takeLoungeHistory } from "@/services/api/bootPrefetch";
import { markChatBootSettled } from "@/lib/chatBoot";
import { clearPendingChatConversation, clearPendingChatTurns } from "@/lib/willab/chatTurnOutbox";

function isSpeakingChatText(message: LoungeMessage): boolean {
  return message.kind === "text" && message.metadata?.place === "speaking" && !message.metadata?.arc_id;
}

/* -------------------------------------------------------------------------- */
/*  useLoungeThread — the willab Lounge's persistent chat history (§3/§11)    */
/*                                                                            */
/*  One hook, two backends, transparent to the caller:                       */
/*    - signed-in  → server `lounge_messages` (survives reload + device)     */
/*    - unsigned   → localStorage (survives reload, single device)           */
/*                                                                            */
/*  Continuity model (WhatsApp): rehydrate on mount, newest at the bottom,   */
/*  page older via `loadOlder`. The caller appends a draft; the hook stamps   */
/*  client_id + client_created_at once and writes it to the right store.     */
/*  On sign-up, `mergeFromLocal` replays the local thread into the server    */
/*  thread (chronological, idempotent) and rehydrates.                       */
/* -------------------------------------------------------------------------- */

export interface UseLoungeThreadReturn {
  messages: LoungeMessage[];
  /** True until the history's first page is in. A read with no answer
   *  keeps it true (the typing dots), never an empty thread: an empty one
   *  is a brand-new speaker's hello. */
  loading: boolean;
  /** A read of the history at open went unanswered: it is read again on
   *  its own (BOOT_RETRY_MS, then as the network or the app comes back),
   *  and what only waits for its first answer (the record bar) waits no
   *  longer. */
  unanswered: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  /** Append a message (stamped here) to whichever store is active. */
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
  /** Put a message on screen synchronously and expose the durable write.
   *  A failed write keeps the same idempotent bubble in the thread; `retry`
   *  stores that exact row again, so typed words never need a second bubble. */
  appendRecoverable: (draft: LoungeMessageDraft) => RecoverableAppend;
  /** #2 — show a message in the thread WITHOUT persisting it, used when the
   *  BACKEND owns persistence for the turn (the bot turn on a signed-in
   *  persist:true chat call). The authoritative row arrives on the next
   *  rehydrate (reload / remount). */
  appendLocalOnly: (draft: LoungeMessageDraft) => LoungeMessage;
  /** True → server-backed thread (BE can persist). False → localStorage only. */
  signedIn: boolean;
  /** Page in the next-older window (server only; no-op when unsigned).
   *  `beforePrepend` runs just before the page is put above the thread. A
   *  page with no answer changes nothing, so it can be asked for again. */
  loadOlder: (beforePrepend?: () => void) => Promise<void>;
  /** Re-fetch the newest window — e.g. to pull a BE-appended insight ping (§6c). */
  reload: () => Promise<void>;
  /** Resolves once every append started so far is stored: a row the server
   *  writes next then sorts under them (the message after a Take). */
  idle: () => Promise<void>;
  /** Wipe the thread (server DELETE or local clear). */
  clear: () => Promise<void>;
  /** Something is writing into the thread behind the screen (the walk's
   *  summary and the chain after it): the Lounge shows the typing dots
   *  while it does (B8). */
  writing: boolean;
  setWriting: (on: boolean) => void;
  /** Replay the local thread into the server thread on sign-up, then rehydrate. */
  mergeFromLocal: () => Promise<void>;
  /** The person's own bubble, drawn the moment they tap or type an answer
   *  the backend writes (backend N632 item 7). */
  own: OwnBubble;
}

export type RecoverableAppend = {
  message: LoungeMessage;
  stored: Promise<boolean>;
  retry: () => Promise<boolean>;
};

/** One own bubble on screen before the backend's row: `settle` once the
 *  answer is taken (the next read that lands puts the backend's row in its
 *  place), `drop` when it was not (it goes, as the answer did). Until then
 *  every read keeps it, under what the read brought. */
export type OwnBubble = (body: string) => { settle: () => void; drop: () => void };

/** `work` with the person's `body` on screen while it runs: settled when
 *  `took` says the backend took it, gone otherwise. No body, no bubble. */
export async function withOwnBubble<T>(
  own: OwnBubble | undefined,
  body: string | null,
  work: () => Promise<T>,
  took: (result: T) => boolean,
): Promise<T> {
  const bubble = own && body?.trim() ? own(body.trim()) : null;
  try {
    const result = await work();
    if (took(result)) bubble?.settle();
    else bubble?.drop();
    return result;
  } catch (err) {
    bubble?.drop();
    throw err;
  }
}

/** The waits between reads of a history that had no answer at open; after
 *  the last, the read is tried again at that pace while the app is in view,
 *  and at once when the network or the app comes back. */
export const BOOT_RETRY_MS = [2_000, 5_000, 15_000, 30_000] as const;

/** `chat`: a host's chat that takes Takes is open (backend N648 item 8):
 *  the thread is that chat's rows alone, read with ?chat=; null: the
 *  Lounge's own thread, as it was. */
export function useLoungeThread(signedIn: boolean, chat: string | null = null, owner: string | null = null): UseLoungeThreadReturn {
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unanswered, setUnanswered] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [writing, setWriting] = useState(false);
  const oldestCursorRef = useRef<string | null>(null);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const switched = useRef(chat);
  const roomIsCurrent = switched.current === chat;
  // What is on screen now: a new message is stamped under its newest bubble.
  const messagesRef = useRef<LoungeMessage[]>(messages);
  messagesRef.current = roomIsCurrent ? messages : [];
  // Appends still being stored (idle).
  const pendingRef = useRef<Set<Promise<unknown>>>(new Set());
  // Own bubbles not yet replaced by the backend's row (N632 item 7), and
  // appends not yet stored: a read that lands meanwhile keeps them.
  // A settled one goes with the first read begun after it was settled,
  // which holds the backend's row; a read begun before keeps it.
  const keptRef = useRef<Map<string, {
    message: LoungeMessage;
    settledAt: number | null;
    exact?: boolean;
    keepUntilMatch?: boolean;
    matches?: (page: readonly LoungeMessage[]) => boolean;
  }>>(new Map());
  const readsRef = useRef(0);
  const lastPage = useRef(0);
  const startRead = () => (readsRef.current += 1);
  const withKept = useCallback((page: LoungeMessage[], read: number): LoungeMessage[] => {
    const ids = new Set(page.map((m) => m.client_id));
    const out = [...page];
    for (const [id, kept] of keptRef.current) {
      if (ids.has(id) || kept.matches?.(page)) {
        keptRef.current.delete(id);
      } else if (kept.exact || kept.keepUntilMatch) {
        // Recoverable appends use this exact client_id as their idempotency
        // key; backend-owned answer endpoints are matched by their user body.
        // Keep either optimistic row through an eventually-consistent read;
        // the authoritative row replaces it once it is returned.
        out.push(kept.message);
      } else if (kept.settledAt !== null && read > kept.settledAt) {
        keptRef.current.delete(id);
      } else {
        out.push(kept.message);
      }
    }
    return out;
  }, []);

  // Rehydrate on mount / auth change, and when a host's chat with Takes
  // opens or closes: its rows are read for it alone (N648 item 8).
  useEffect(() => {
    setLoading(true);
    setUnanswered(false);
    if (switched.current !== chat) {
      switched.current = chat;
      keptRef.current.clear();
      setMessages([]);
      setHasMore(false);
      setLoadingOlder(false);
      oldestCursorRef.current = null;
    }
    if (!signedIn) {
      setMessages(loadLocalLoungeThread());
      setHasMore(false);
      oldestCursorRef.current = null;
      setLoading(false);
      markChatBootSettled();
      return;
    }
    let cancelled = false;
    let reading = false;
    let misses = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", again);
    };
    const read = async () => {
      if (cancelled || reading) return;
      reading = true;
      clearTimeout(timer);
      const at = startRead();
      // Usually already in flight since mount (bootPrefetch.ts).
      const page = chat ? await fetchLoungeHistory({ chat }) : await takeLoungeHistory();
      reading = false;
      if (cancelled || chatRef.current !== chat) return;
      // The first read has come back, answered or not: the reads that
      // waited for it may start (the wallet chip, the menu's gates, the
      // guest claim — chatBoot.ts), as they always did.
      if (misses === 0) markChatBootSettled();
      if (at < lastPage.current) {
        stop();
        setUnanswered(false);
        setLoading(false);
        return;
      }
      if (page.failed) {
        // NO ANSWER IS NOT AN EMPTY THREAD: a returning speaker offline
        // would see the brand-new speaker's hello. The dots stay, and the
        // history is read again.
        setUnanswered(true);
        timer = setTimeout(again, BOOT_RETRY_MS[Math.min(misses, BOOT_RETRY_MS.length - 1)]);
        misses += 1;
        return;
      }
      stop();
      lastPage.current = at;
      announceDiscoveriesFromPersistedMessages(page.messages);
      setMessages(withKept(page.messages, at));
      setHasMore(page.has_more);
      oldestCursorRef.current = page.oldest_cursor;
      setUnanswered(false);
      setLoading(false);
    };
    // Not while the app is out of view: it reads again as it comes back.
    function again() {
      if (document.visibilityState !== "hidden") void read();
    }
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", again);
    void read();
    return stop;
  }, [signedIn, chat, withKept]);

  const appendRecoverable = useCallback(
    (draft: LoungeMessageDraft): RecoverableAppend => {
      const writingRoom = chatRef.current;
      const msg = stampLoungeMessage(draft, newestStamp(messagesRef.current));
      let stored = false;
      let inFlight: Promise<boolean> | null = null;

      const keepOnScreen = () => {
        if (chatRef.current !== writingRoom || switched.current !== writingRoom) return;
        setMessages((prev) =>
          prev.some((item) => item.client_id === msg.client_id)
            ? prev
            : [...prev, msg]
        );
        if (signedIn) {
          keptRef.current.set(msg.client_id, { message: msg, settledAt: null, exact: true });
        }
      };

      const write = (): Promise<boolean> => {
        if (stored) return Promise.resolve(true);
        if (inFlight) return inFlight;
        keepOnScreen();
        const operation = (async () => {
          try {
            if (signedIn) {
              const persisted = await appendLoungeMessages([msg]);
              announceDiscoveriesFromPersistedMessages(persisted);
            } else {
              appendLocalLoungeMessage(msg, { requireStorage: true });
            }
            stored = true;
            const kept = keptRef.current.get(msg.client_id);
            if (kept) kept.settledAt = readsRef.current;
            return true;
          } catch (err) {
            // Keep the exact optimistic row. A retry uses the same client_id,
            // so a response lost after the server write still cannot duplicate.
            console.warn("useLoungeThread.append — persist failed:", err);
            return false;
          }
        })();
        const attempt = operation.finally(() => {
          pendingRef.current.delete(attempt);
          inFlight = null;
        });
        inFlight = attempt;
        pendingRef.current.add(attempt);
        return attempt;
      };

      keepOnScreen();
      const first = write();
      return { message: msg, stored: first, retry: write };
    },
    [signedIn],
  );

  const append = useCallback(
    async (draft: LoungeMessageDraft): Promise<LoungeMessage> => {
      const pending = appendRecoverable(draft);
      await pending.stored;
      return pending.message;
    },
    [appendRecoverable],
  );

  const appendLocalOnly = useCallback(
    (draft: LoungeMessageDraft): LoungeMessage => {
      const msg = stampLoungeMessage(draft, newestStamp(messagesRef.current));
      if (signedIn && draft.clientId) {
        keptRef.current.set(msg.client_id, { message: msg, settledAt: readsRef.current, exact: true });
      }
      setMessages((prev) => prev.some((row) => row.client_id === msg.client_id) ? prev : [...prev, msg]);
      return msg;
    },
    [signedIn],
  );

  const loadOlder = useCallback(async (beforePrepend?: () => void) => {
    if (!signedIn || !roomIsCurrent || loadingOlder || !hasMore) return;
    const readingRoom = chatRef.current;
    const cursor = oldestCursorRef.current;
    if (!cursor) return;
    setLoadingOlder(true);
    try {
      const page = await fetchLoungeHistory({ before: cursor, chat: readingRoom });
      // No answer says nothing about what is older: the button stays, and
      // a tap asks again.
      if (page.failed || chatRef.current !== readingRoom) return;
      announceDiscoveriesFromPersistedMessages(page.messages);
      if (page.messages.length > 0) beforePrepend?.();
      // Older page is ASC; prepend ahead of the current window.
      const ids = new Set(page.messages.map((m) => m.client_id));
      setMessages((prev) => [...page.messages, ...prev.filter((m) => !ids.has(m.client_id))]);
      setHasMore(page.has_more);
      oldestCursorRef.current = page.oldest_cursor;
    } finally {
      if (chatRef.current === readingRoom) setLoadingOlder(false);
    }
  }, [signedIn, roomIsCurrent, loadingOlder, hasMore]);

  const clear = useCallback(async () => {
    if (signedIn) await clearLoungeThread();
    else clearLocalLoungeThread();
    if (owner) clearPendingChatTurns(owner);
    lastPage.current = startRead();
    keptRef.current.clear();
    setMessages([]);
    setHasMore(false);
    oldestCursorRef.current = null;
  }, [signedIn, owner]);

  const reload = useCallback(async () => {
    // Insight pings are server-written; the local thread has nothing new to pull.
    if (!signedIn) return;
    const at = startRead();
    const readingChat = chatRef.current;
    const page = await fetchLoungeHistory({ chat: readingChat });
    // A failed read never wipes the chat: what is on screen stays.
    if (page.failed || chatRef.current !== readingChat || at < lastPage.current) return;
    lastPage.current = at;
    announceDiscoveriesFromPersistedMessages(page.messages);
    setMessages(withKept(page.messages, at));
    setHasMore(page.has_more);
    oldestCursorRef.current = page.oldest_cursor;
  }, [signedIn, withKept]);

  useEffect(() => {
    if (!signedIn || !owner) return;
    const onDeleted = () => {
      clearPendingChatConversation(owner, JSON.stringify(["lounge", "speaking", null]));
      for (const [id, item] of keptRef.current) {
        if (isSpeakingChatText(item.message)) keptRef.current.delete(id);
      }
      lastPage.current = startRead();
      setMessages((current) => current.filter((message) => !isSpeakingChatText(message)));
      void reload().catch(() => undefined);
    };
    window.addEventListener("willab:speaking-chat-deleted", onDeleted);
    return () => window.removeEventListener("willab:speaking-chat-deleted", onDeleted);
  }, [owner, signedIn, reload]);

  // The guest's chat was merged into this account after the thread loaded
  // (GuestProjectClaim): read it again so the Take's bubbles show now.
  useEffect(() => {
    if (!signedIn) return;
    const onMerged = () => void reload().catch(() => undefined);
    window.addEventListener(LOUNGE_THREAD_MERGED_EVENT, onMerged);
    return () => window.removeEventListener(LOUNGE_THREAD_MERGED_EVENT, onMerged);
  }, [signedIn, reload]);

  const idle = useCallback(async () => {
    await Promise.allSettled([...pendingRef.current]);
  }, []);

  const mergeFromLocal = useCallback(async () => {
    await mergeLocalLoungeThreadToServer();
    if (chatRef.current !== null) return;
    // Rehydrate from the now-merged server thread (single source of truth).
    const at = startRead();
    const page = await fetchLoungeHistory();
    if (page.failed || chatRef.current !== null) return;
    announceDiscoveriesFromPersistedMessages(page.messages);
    setMessages(withKept(page.messages, at));
    setHasMore(page.has_more);
    oldestCursorRef.current = page.oldest_cursor;
  }, [withKept]);

  const own = useCallback<OwnBubble>((body) => {
    const msg = stampLoungeMessage({ role: "user", kind: "text", body }, newestStamp(messagesRef.current));
    const existingIds = new Set(messagesRef.current.map((message) => message.client_id));
    keptRef.current.set(msg.client_id, {
      message: msg,
      settledAt: null,
      keepUntilMatch: true,
      matches: (page) => page.some((candidate) =>
        candidate.role === "user" &&
        candidate.kind === "text" &&
        candidate.body === msg.body &&
        !existingIds.has(candidate.client_id),
      ),
    });
    setMessages((prev) => [...prev, msg]);
    return {
      settle: () => {
        const kept = keptRef.current.get(msg.client_id);
        if (kept) kept.settledAt = readsRef.current;
      },
      drop: () => {
        keptRef.current.delete(msg.client_id);
        setMessages((prev) => prev.filter((m) => m.client_id !== msg.client_id));
      },
    };
  }, []);

  return {
    messages: roomIsCurrent ? messages : [],
    loading: !roomIsCurrent || loading,
    unanswered: roomIsCurrent && unanswered,
    loadingOlder: roomIsCurrent && loadingOlder,
    hasMore: roomIsCurrent && hasMore,
    append,
    appendRecoverable,
    appendLocalOnly,
    signedIn,
    loadOlder,
    reload,
    idle,
    clear,
    mergeFromLocal,
    writing,
    setWriting,
    own,
  };
}
