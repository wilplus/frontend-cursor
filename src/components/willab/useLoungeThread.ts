"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendLoungeMessages,
  clearLoungeThread,
  fetchLoungeHistory,
  stampLoungeMessage,
  type LoungeMessage,
  type LoungeMessageDraft,
} from "@/services/api/loungeMessages";
import {
  appendLocalLoungeMessage,
  clearLocalLoungeThread,
  mergeLocalLoungeThreadToServer,
  readLocalLoungeThread,
} from "@/lib/funnel/loungeLocalThread";
import { announceDiscoveriesFromPersistedMessages } from "@/lib/productDiscovery";

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
  loading: boolean;
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
  /** Page in the next-older window (server only; no-op when unsigned). */
  loadOlder: () => Promise<void>;
  /** Re-fetch the newest window — e.g. to pull a BE-appended insight ping (§6c). */
  reload: () => Promise<void>;
  /** Wipe the thread (server DELETE or local clear). */
  clear: () => Promise<void>;
  /** Replay the local thread into the server thread on sign-up, then rehydrate. */
  mergeFromLocal: () => Promise<void>;
}

export function useLoungeThread(signedIn: boolean): UseLoungeThreadReturn {
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const oldestCursorRef = useRef<string | null>(null);

  // Rehydrate on mount / auth change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (signedIn) {
        const page = await fetchLoungeHistory();
        if (cancelled) return;
        announceDiscoveriesFromPersistedMessages(page.messages);
        setMessages(page.messages);
        setHasMore(page.has_more);
        oldestCursorRef.current = page.oldest_cursor;
      } else {
        const local = readLocalLoungeThread();
        if (cancelled) return;
        setMessages(local);
        setHasMore(false);
        oldestCursorRef.current = null;
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const append = useCallback(
    async (draft: LoungeMessageDraft): Promise<LoungeMessage> => {
      const msg = stampLoungeMessage(draft);
      // Optimistic — the bubble shows instantly; persistence trails.
      setMessages((prev) => [...prev, msg]);
      try {
        if (signedIn) {
          const persisted = await appendLoungeMessages([msg]);
          announceDiscoveriesFromPersistedMessages(persisted);
        } else {
          appendLocalLoungeMessage(msg);
        }
      } catch (err) {
        // Persistence is best-effort; the bubble stays on screen. (Idempotent
        // on client_id, so a later retry/merge reconciles.)
        console.warn("useLoungeThread.append — persist failed:", err);
      }
      return msg;
    },
    [signedIn],
  );

  const appendLocalOnly = useCallback(
    (draft: LoungeMessageDraft): LoungeMessage => {
      const msg = stampLoungeMessage(draft);
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [],
  );

  const loadOlder = useCallback(async () => {
    if (!signedIn || loadingOlder || !hasMore) return;
    const cursor = oldestCursorRef.current;
    if (!cursor) return;
    setLoadingOlder(true);
    try {
      const page = await fetchLoungeHistory({ before: cursor });
      announceDiscoveriesFromPersistedMessages(page.messages);
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
    announceDiscoveriesFromPersistedMessages(page.messages);
    setMessages(page.messages);
    setHasMore(page.has_more);
    oldestCursorRef.current = page.oldest_cursor;
  }, [signedIn]);

  const mergeFromLocal = useCallback(async () => {
    await mergeLocalLoungeThreadToServer();
    // Rehydrate from the now-merged server thread (single source of truth).
    const page = await fetchLoungeHistory();
    announceDiscoveriesFromPersistedMessages(page.messages);
    setMessages(page.messages);
    setHasMore(page.has_more);
    oldestCursorRef.current = page.oldest_cursor;
  }, []);

  return {
    messages,
    loading,
    loadingOlder,
    hasMore,
    append,
    appendLocalOnly,
    signedIn,
    loadOlder,
    reload,
    clear,
    mergeFromLocal,
  };
}
