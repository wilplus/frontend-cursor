"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side OAuth callback completer.
 *
 * /auth/callback (route.ts) used to handle the exchange server-side, but
 * Supabase's server client kept silently failing to persist the session
 * cookie (`exchangeCodeForSession` returned `{session: null, error: null}`
 * on Vercel — only the PKCE code-verifier cookie made it back to the
 * browser, never the actual `sb-…-auth-token`).
 *
 * Doing the exchange in the browser side-steps every cookie-API quirk:
 * supabase-js's browser client stores the PKCE verifier in localStorage
 * during OAuth init and can recover it from there at exchange time
 * without depending on cookie round-trips.
 *
 * Recovery flows still go through the server-side route handler — only
 * OAuth (LinkedIn etc.) redirects here.
 */

// Never statically prerender — the page depends entirely on runtime
// URL params (?code=...&state=...) and browser-side localStorage (the
// PKCE verifier). Without this, Next.js fails the build with
// "useSearchParams() should be wrapped in a suspense boundary".
export const dynamic = "force-dynamic";

function OAuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const code = searchParams?.get("code");
      const next = searchParams?.get("next") || "/results";

      if (!code) {
        setErrorMessage("Missing OAuth authorization code.");
        setTimeout(
          () => router.replace("/login?error=oauth_failed&detail=missing_code"),
          1500
        );
        return;
      }

      const supabase = createClient();

      // Browser-side exchange — uses the PKCE verifier stored in
      // localStorage during OAuth init.
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data?.session) {
        const detail = error?.message ?? "no_session_returned";
        // eslint-disable-next-line no-console
        console.error("[oauth-complete] exchange failed:", {
          hasError: !!error,
          message: error?.message,
          hasSession: !!data?.session,
        });
        router.replace(
          `/login?error=oauth_failed&detail=${encodeURIComponent(
            detail
          ).slice(0, 200)}`
        );
        return;
      }

      // Mirror the password-login flow: hit /api/auth/confirm-session
      // so server-side cookies are also written. This is what makes
      // BFF routes (e.g. /api/results/state) recognise the session
      // immediately on the next page load.
      try {
        await fetch("/api/auth/confirm-session", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* non-fatal — client-side session is established either way */
      }

      // Brief pause so the cookie writes commit before the next-page
      // fetch fires. 200ms matches what LoginForm uses.
      await new Promise((r) => setTimeout(r, 200));

      router.replace(next);
    };

    void run();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-sm text-muted-foreground">
          {errorMessage ?? "Signing you in…"}
        </p>
      </div>
    </main>
  );
}

/**
 * Suspense wrapper required by Next.js for any client component that
 * calls `useSearchParams()` — the inner component bails out of
 * static rendering, and the boundary lets the build emit a placeholder
 * fallback while the real component hydrates.
 */
export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background p-6">
          <Loader2
            className="h-8 w-8 animate-spin text-primary"
            aria-hidden
          />
        </main>
      }
    >
      <OAuthCompleteInner />
    </Suspense>
  );
}
