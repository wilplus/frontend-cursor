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
}

/** The waits between reads of a history that had no answer at open; after
 *  the last, the read is tried again at that pace while the app is in view,
 *  and at once when the network or the app comes back. */
export const BOOT_RETRY_MS = [2_000, 5_000, 15_000, 30_000] as const;

export function useLoungeThread(signedIn: boolean): UseLoungeThreadReturn {
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unanswered, setUnanswered] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [writing, setWriting] = useState(false);
  const oldestCursorRef = useRef<string | null>(null);
  // What is on screen now: a new message is stamped under its newest bubble.
  const messagesRef = useRef<LoungeMessage[]>(messages);
  messagesRef.current = messages;
  // Appends still being stored (idle).
  const pendingRef = useRef<Set<Promise<unknown>>>(new Set());

  // Rehydrate on mount / auth change.
  useEffect(() => {
    setLoading(true);
    setUnanswered(false);
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
      // Usually already in flight since mount (bootPrefetch.ts).
      const page = await takeLoungeHistory();
      reading = false;
      if (cancelled) return;
      // The first read has come back, answered or not: the reads that
      // waited for it may start (the wallet chip, the menu's gates, the
      // guest claim — chatBoot.ts), as they always did.
      if (misses === 0) markChatBootSettled();
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
      announceDiscoveriesFromPersistedMessages(page.messages);
      setMessages(page.messages);
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
  }, [signedIn]);

  const append = useCallback(
    async (draft: LoungeMessageDraft): Promise<LoungeMessage> => {
      const msg = stampLoungeMessage(draft, newestStamp(messagesRef.current));
      // Optimistic — the bubble shows instantly; persistence trails.
      setMessages((prev) =>
        prev.some((item) => item.client_id === msg.client_id)
          ? prev
          : [...prev, msg]
      );
      const stored = (async () => {
        if (signedIn) {
          const persisted = await appendLoungeMessages([msg]);
          announceDiscoveriesFromPersistedMessages(persisted);
        } else {
          appendLocalLoungeMessage(msg);
        }
      })();
      pendingRef.current.add(stored);
      try {
        await stored;
      } catch (err) {
        // Persistence is best-effort; the bubble stays on screen. (Idempotent
        // on client_id, so a later retry/merge reconciles.)
        console.warn("useLoungeThread.append — persist failed:", err);
      } finally {
        pendingRef.current.delete(stored);
      }
      return msg;
    },
    [signedIn],
  );

  const appendLocalOnly = useCallback(
    (draft: LoungeMessageDraft): LoungeMessage => {
      const msg = stampLoungeMessage(draft, newestStamp(messagesRef.current));
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [],
  );

  const loadOlder = useCallback(async (beforePrepend?: () => void) => {
    if (!signedIn || loadingOlder || !hasMore) return;
    const cursor = oldestCursorRef.current;
    if (!cursor) return;
    setLoadingOlder(true);
    try {
      const page = await fetchLoungeHistory({ before: cursor });
      // No answer says nothing about what is older: the button stays, and
      // a tap asks again.
      if (page.failed) return;
      announceDiscoveriesFromPersistedMessages(page.messages);
      if (page.messages.length > 0) beforePrepend?.();
      // Older page is ASC; prepend ahead of the current window.
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.has_more);
      oldestCursorRef.current = page.oldest_cursor;
    } finally {
      setLoadingOlder(false);
    }
  }, [signedIn, loadingOlder, hasMore]);

  const clear = useCallback(async () => {
    if (signedIn) await clearLoungeThread();
    else clearLocalLoungeThread();
    setMessages([]);
    setHasMore(false);
    oldestCursorRef.current = null;
  }, [signedIn]);

  const reload = useCallback(async () => {
    // Insight pings are server-written; the local thread has nothing new to pull.
    if (!signedIn) return;
    const page = await fetchLoungeHistory();
    // A failed read never wipes the chat: what is on screen stays.
    if (page.failed) return;
    announceDiscoveriesFromPersistedMessages(page.messages);
    setMessages(page.messages);
    setHasMore(page.has_more);
    oldestCursorRef.current = page.oldest_cursor;
  }, [signedIn]);

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
    // Rehydrate from the now-merged server thread (single source of truth).
    const page = await fetchLoungeHistory();
    if (page.failed) return;
    announceDiscoveriesFromPersistedMessages(page.messages);
    setMessages(page.messages);
    setHasMore(page.has_more);
    oldestCursorRef.current = page.oldest_cursor;
  }, []);

  return {
    messages,
    loading,
    unanswered,
    loadingOlder,
    hasMore,
    append,
    appendLocalOnly,
    signedIn,
    loadOlder,
    reload,
    idle,
    clear,
    mergeFromLocal,
    writing,
    setWriting,
  };
}
