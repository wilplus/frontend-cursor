"use client";

import { useCallback, useReducer } from "react";
import type { Bubble, BubbleInput } from "@/components/chat/thread/types";

/* -------------------------------------------------------------------------- */
/*  useThread — single source of truth for the /chat bubble array             */
/*                                                                            */
/*  STATE-OF-TRUTH: this hook is mounted exactly once in ChatPageClient.     */
/*  Every surface (ChatInterview's recording engine, the Q&A composer, the   */
/*  reviewing-phase fetch effect) writes through these three callbacks. No   */
/*  surface owns its own messages array. Per the FE Prompt 1 contract.       */
/*                                                                            */
/*  CALLBACK STABILITY: dispatch is React-guaranteed stable. The three       */
/*  callbacks below close over `dispatch` ONLY, never over `state`, so they  */
/*  are wrapped in useCallback with empty deps and never re-create across    */
/*  re-renders. That's load-bearing — if `ChatPageClient` re-renders for     */
/*  any reason (session-state polling tick every 5s, auth refresh, phase    */
/*  change), unstable callbacks would re-fire every effect inside           */
/*  ChatInterview that lists them in its deps array — causing duplicate     */
/*  bubble appends. The reducer pattern keeps the callback identity stable.  */
/* -------------------------------------------------------------------------- */

type ThreadAction =
  | { type: "APPEND"; bubble: Bubble }
  | { type: "UPDATE"; id: string; patch: Partial<Bubble> }
  | { type: "REPLACE"; id: string; replacement: Bubble[] }
  | { type: "CLEAR" };

function makeBubbleId(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function reducer(state: Bubble[], action: ThreadAction): Bubble[] {
  switch (action.type) {
    case "APPEND":
      return [...state, action.bubble];
    case "UPDATE": {
      const idx = state.findIndex((b) => b.id === action.id);
      if (idx < 0) return state;
      // Shallow merge by id. TypeScript can't statically prove the patch
      // matches the variant's shape, but we trust callers to update
      // fields appropriate for the variant (e.g. patch `pending` on a
      // bot_text, not `audioUrl`).
      const merged = { ...state[idx], ...action.patch } as Bubble;
      const next = state.slice();
      next[idx] = merged;
      return next;
    }
    case "REPLACE": {
      const idx = state.findIndex((b) => b.id === action.id);
      if (idx < 0) return state;
      return [
        ...state.slice(0, idx),
        ...action.replacement,
        ...state.slice(idx + 1),
      ];
    }
    case "CLEAR":
      return [];
  }
}

export interface ThreadHandle {
  /** Current ordered list of bubbles. */
  bubbles: Bubble[];
  /**
   * Append a single bubble to the end of the thread. The bubble's `id`
   * is client-generated here via `crypto.randomUUID()` — no caller
   * supplies their own id, eliminating server/client id collision risk.
   * Returns the generated id synchronously so optimistic callers can
   * track the bubble for a later `updateBubble` or `replaceBubble`.
   */
  appendBubble: (bubble: BubbleInput) => string;
  /**
   * Shallow-merge a patch into the bubble identified by `id`. No-op if
   * the bubble doesn't exist (e.g. it was already replaced). Used for
   * optimistic-commit (`{ pending: false }`), submitting toggles,
   * transcript backfill, etc.
   */
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  /**
   * Splice the bubble identified by `id` out of the array and insert
   * one or more replacement bubbles at its position. Supports 1:1 (e.g.
   * upgrading a typing bubble to the real bot_text response) and 1:N
   * (e.g. upgrading a single upload-status bubble into multiple
   * 75-char-split text bubbles). Replacement bubbles are id-less —
   * the hook generates fresh client UUIDs the same way `appendBubble`
   * does. No-op if the id doesn't exist.
   */
  replaceBubble: (
    id: string,
    replacement: BubbleInput | BubbleInput[]
  ) => void;
  /** Reset to an empty array. Used by ChatInterview on cold-start mount. */
  clearBubbles: () => void;
}

export function useThread(): ThreadHandle {
  const [bubbles, dispatch] = useReducer(reducer, []);

  const appendBubble = useCallback(
    (bubble: BubbleInput): string => {
      const id = makeBubbleId();
      dispatch({ type: "APPEND", bubble: { ...bubble, id } as Bubble });
      return id;
    },
    []
  );

  const updateBubble = useCallback((id: string, patch: Partial<Bubble>) => {
    dispatch({ type: "UPDATE", id, patch });
  }, []);

  const replaceBubble = useCallback(
    (id: string, replacement: BubbleInput | BubbleInput[]) => {
      const arr = Array.isArray(replacement) ? replacement : [replacement];
      const withIds = arr.map(
        (b) => ({ ...b, id: makeBubbleId() }) as Bubble
      );
      dispatch({ type: "REPLACE", id, replacement: withIds });
    },
    []
  );

  const clearBubbles = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  return { bubbles, appendBubble, updateBubble, replaceBubble, clearBubbles };
}
