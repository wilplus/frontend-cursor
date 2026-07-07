"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { consumeOAuthFromPwa, isStandalonePwa } from "@/lib/pwa";

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
  // Bug 3: an OAuth launched from the installed PWA can complete here in a
  // SEPARATE browser tab. When so, show a "head back to the app" message instead
  // of silently redirecting to /chat in the wrong context.
  const [returnToApp, setReturnToApp] = useState(false);

  // Guard against double-fire. React StrictMode mounts effects twice
  // in development, and Next.js Suspense + force-dynamic can produce
  // similar duplicate runs on Vercel. The previous version was
  // calling exchangeCodeForSession twice — first call succeeded and
  // consumed the PKCE verifier (session cookies were written!), but
  // the second call failed with "PKCE code verifier not found in
  // storage". The page treated the second call's error as fatal and
  // redirected to /login, even though the first call had already
  // signed the user in. Verified in browser cookies: chunked
  // sb-…-auth-token.0/.1/.2 cookies were present despite the apparent
  // failure.
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const run = async () => {
      const code = searchParams?.get("code");
      const next = searchParams?.get("next") || "/chat";

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

      // Defence in depth: even with the run-once ref above, an error
      // from this call doesn't mean the session wasn't established.
      // Always probe getSession() before treating an exchange error
      // as fatal — if a session exists, the user IS signed in and we
      // should proceed.
      let effectiveSession = data?.session ?? null;
      if (!effectiveSession) {
        try {
          const { data: probe } = await supabase.auth.getSession();
          effectiveSession = probe?.session ?? null;
        } catch {
          /* non-fatal — fall through to error path below */
        }
      }

      // eslint-disable-next-line no-console
      console.log("[oauth-complete] exchange:", {
        hasError: !!error,
        errorMessage: error?.message,
        hasSessionFromExchange: !!data?.session,
        hasSessionFromProbe: !!effectiveSession && !data?.session,
        proceeding: !!effectiveSession,
      });

      if (!effectiveSession) {
        const detail = error?.message ?? "no_session_returned";
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

      // Bug 3: if this OAuth was launched from the installed PWA (marker cookie)
      // AND we're now in a browser TAB (not standalone), the user was bounced out
      // of the app for sign-in — tell them they can head back instead of
      // redirecting to /chat in the wrong context. Every other case (plain web,
      // or OAuth that returned inside the PWA) auto-redirects as before.
      if (consumeOAuthFromPwa() && !isStandalonePwa()) {
        setReturnToApp(true);
        return;
      }

      router.replace(next);
    };

    void run();
  }, [router, searchParams]);

  if (returnToApp) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-foreground">
            You&apos;re signed in
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You can head back to the WillpowerLab app now to pick up where you
            left off.
          </p>
        </div>
      </main>
    );
  }

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
