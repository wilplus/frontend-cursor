"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Routing guard for the Infinite Coaching Loop.
 *
 *   conversation → waiting screen → snippets → conversation → …
 *
 * Locks signed-in users with an active or completed session out of the
 * "starting fresh" surfaces (`/`, cold-start `/chat`) and redirects
 * them to the canonical screen for their current state:
 *
 *   /api/results/state result   →  redirect target
 *   ─────────────────────────────────────────────────────────────
 *   { kind: "no_session" }       →  no-op (let parent render its UI)
 *   { kind: "processing", id }   →  /results/[id]  (ProcessingState
 *                                    locks them in until backend
 *                                    finishes analysis)
 *   { kind: "completed",  id }   →  /results/[id]  (snippet list +
 *                                    Charisma dashboard)
 *
 * Anonymous users are always a no-op — they can record on the guest
 * funnel even if some other account has an active session in this
 * browser.
 *
 * Callers MUST gate their own UI on `checking || redirecting` and
 * render a brief loader instead of mounting the page proper, otherwise
 * the user sees a flash of the wrong UI before the redirect lands.
 *
 * Usage:
 *
 *   const { checking, redirecting } = useSessionRouteGuard();
 *   if (checking || redirecting) return <Loader />;
 *   return <YourPage />;
 *
 * For routes that should opt out conditionally (e.g. /chat with
 * contextual params), pass `enabled: false`:
 *
 *   const { checking } = useSessionRouteGuard({ enabled: !sourceSnippet });
 */
export interface SessionRouteGuardState {
  /** True while the auth + state fetch is in flight. */
  checking: boolean;
  /** True after we've decided to redirect (router.replace fired); the
   *  parent should keep rendering the loader until unmount. */
  redirecting: boolean;
}

export function useSessionRouteGuard(opts?: {
  enabled?: boolean;
}): SessionRouteGuardState {
  const router = useRouter();
  const enabled = opts?.enabled ?? true;
  const [state, setState] = useState<SessionRouteGuardState>({
    checking: enabled,
    redirecting: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ checking: false, redirecting: false });
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (cancelled) return;

        // Anonymous users → no guard. Lets the guest funnel run.
        if (!userData.user) {
          setState({ checking: false, redirecting: false });
          return;
        }

        const res = await fetch("/api/results/state", { cache: "no-store" });
        if (cancelled) return;

        // Any non-2xx (502 backend down, 401 token expired) → fail open
        // so the user isn't trapped on a blank loader. They land on
        // whatever the parent route normally shows.
        if (!res.ok) {
          setState({ checking: false, redirecting: false });
          return;
        }

        const json = (await res.json()) as
          | { kind: "no_session" }
          | { kind: "processing"; session_id: string }
          | { kind: "completed"; session_id: string };

        if (cancelled) return;

        if (json.kind === "no_session") {
          setState({ checking: false, redirecting: false });
          return;
        }

        // Both processing and completed land on /results/[id] —
        // /results/[id] itself decides between ProcessingState and
        // the snippet list based on its own status check.
        const sid = json.session_id?.trim();
        if (!sid) {
          // Backend said processing/completed but didn't give us an id
          // — fall back to the generic /results timeline so we don't
          // navigate to a broken `/results/` URL.
          setState({ checking: true, redirecting: true });
          router.replace("/results");
          return;
        }

        setState({ checking: true, redirecting: true });
        router.replace(`/results/${encodeURIComponent(sid)}`);
      } catch {
        if (!cancelled) {
          setState({ checking: false, redirecting: false });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  return state;
}
