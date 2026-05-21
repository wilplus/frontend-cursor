"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isPublishTransition } from "@/hooks/publishLiveTransition";

export { isPublishTransition } from "@/hooks/publishLiveTransition";

/* -------------------------------------------------------------------------- */
/*  usePublishLiveSubscription                                                */
/*                                                                            */
/*  WhatsApp-style live delivery of admin-published snippets to a user's     */
/*  open chat tab. Subscribes to `v2_sessions` row-change events filtered    */
/*  to the logged-in user; fires `onPublish` when `results_published_at`     */
/*  flips null → non-null (the admin-publish signal).                       */
/*                                                                            */
/*  Two-tier delivery:                                                        */
/*    1. PRIMARY — Supabase Realtime postgres_changes channel. Sub-second   */
/*       latency. Requires (a) RLS allows SELECT on the row for the user,   */
/*       (b) `v2_sessions` is in the `supabase_realtime` publication.       */
/*    2. FALLBACK — 20s setInterval that also calls `onPublish`. Cheap     */
/*       belt-and-suspenders. If Realtime is healthy, the polling refetch  */
/*       is redundant but idempotent. If Realtime is disabled (publication */
/*       missing, env vars absent, network blocking websockets), polling   */
/*       is the only signal — user still sees the snippet within 20s.      */
/*                                                                            */
/*  Cleanup contract (C4): both the channel AND the interval are released  */
/*  in the effect's cleanup. `supabase.getChannels()` returns 0 after the  */
/*  parent component unmounts.                                              */
/*                                                                            */
/*  RLS prerequisite (C3): `v2_sessions` needs a SELECT policy where        */
/*  auth.uid() = user_id, otherwise the Realtime filter never matches and  */
/*  the channel silently never fires. Verifiable by reading one row via    */
/*  the regular Supabase client — if that works, Realtime works.           */
/* -------------------------------------------------------------------------- */

const FALLBACK_POLL_MS = 20_000;

/**
 * Subscribe to publish events for `userId`. When `userId` is null the
 * hook is a no-op (neither subscription nor polling fires) — anonymous
 * users have no v2_sessions row to watch.
 *
 * `onPublish` is called on EVERY signal (realtime detection AND each
 * polling tick). Caller is responsible for idempotency — the existing
 * reviewing-fetch effect uses a `seenSnippetIdsRef` set so a duplicate
 * trigger is a cheap re-fetch that appends nothing.
 */
export function usePublishLiveSubscription(
  userId: string | null,
  onPublish: () => void
): void {
  useEffect(() => {
    if (!userId) return;

    // Defensive — bail without crashing if Supabase env vars are
    // missing (e.g. local dev without .env.local). The polling
    // fallback alone is not worth the cost of crashing the page,
    // so we just skip realtime entirely and let the parent's
    // existing 30s reviewing-fetch interval do its job.
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`session-publish-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "v2_sessions",
          filter: `user_id=eq.${userId}`,
        },
        (payload: {
          old?: Record<string, unknown> | null;
          new?: Record<string, unknown> | null;
        }) => {
          if (isPublishTransition(payload)) {
            onPublish();
          }
        }
      )
      .subscribe((status: string) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          // No-op in production; the polling fallback below covers
          // the gap. Log so engineering can spot a misconfigured
          // realtime publication during dev / triage.
          console.warn(
            `publish-live: Realtime status="${status}" — falling back to ${FALLBACK_POLL_MS}ms polling`
          );
        }
      });

    const pollId = setInterval(onPublish, FALLBACK_POLL_MS);

    return () => {
      // C4: tear down BOTH the channel and the interval. Leaked
      // channels eat Supabase Free-tier connection slots.
      try {
        void supabase.removeChannel(channel);
      } catch {
        // removeChannel can throw if the channel is already
        // closed — never let it surface up to the user.
      }
      clearInterval(pollId);
    };
  }, [userId, onPublish]);
}
