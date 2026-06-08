import { Suspense } from "react";
import ChatPageClient from "./page.client";

/** Avoid static prerender (search params + client subtree). */
export const dynamic = "force-dynamic";

function firstQueryValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value || null;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

export default function ChatPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Phase-aware param: `?session=<id>` is the canonical deep-link
  // (post-finalize redirect, admin email) for the review→roleplay
  // loop. The legacy `?sourceSnippet=` / `?intent=` deep-links from
  // the old contextual-chat era are now resolved by the page itself —
  // if `session` isn't present but `sourceSnippet` is, we treat it
  // as a request to jump into review for that snippet's parent
  // session. For now we forward both so existing email links keep
  // working until backend stops emitting them.
  const sessionId = firstQueryValue(searchParams.session);
  // U12 — coach email deep-link: `?review=<id>` opens the in-Lounge
  // CoachReviewOverlay for that session on mount (the param N1's redirect
  // preserved). Distinct from `?session=` (user review→roleplay loop); coach-
  // gated downstream, ignored for non-coaches.
  const reviewSessionId = firstQueryValue(searchParams.review);

  return (
    <Suspense
      fallback={
        <div className="willab-chat flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ChatPageClient sessionId={sessionId} reviewSessionId={reviewSessionId} />
    </Suspense>
  );
}
