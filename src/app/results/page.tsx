"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * /results — legacy redirect.
 *
 * The standalone Voice-Journey timeline that used to live here was
 * retired when ALL post-onboarding interactions moved into /chat
 * (waiting screen, snippet review as bubbles, roleplay). The route
 * is kept alive so any stale links — bookmarks, old admin emails,
 * the coach view, OAuth callbacks defaulting to `/results` — bounce
 * cleanly through the session-route guard instead of 404'ing.
 *
 * The redirect targets `/chat` (no session id). The chat page's
 * session-route guard then probes /api/results/state and pushes the
 * user to `/chat?session=<id>` for their latest session, or to the
 * cold-start chat if they have none.
 */
export default function ResultsLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/chat");
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </main>
  );
}
