"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isStandalonePwa, markOAuthFromPwa } from "@/lib/pwa";

/**
 * Google OAuth sign-in button.
 *
 * Mirrors LinkedInAuthButton: Supabase `signInWithOAuth({ provider: "google" })`
 * redirects to Google, then back to /auth/callback with an auth code — the same
 * callback chain (/auth/callback → /auth/oauth-complete → exchange) LinkedIn uses,
 * so no new routing is needed.
 *
 * Requires Google to be enabled as a provider in the Supabase project (Auth →
 * Providers → Google, with a Google OAuth client id/secret). Without that config
 * the redirect fails with an "Unsupported provider" error — purely a dashboard
 * step, not a code one.
 */
export default function GoogleAuthButton({
  mode = "signup",
  className,
}: {
  mode?: "signup" | "login";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Clear any stale session so the OAuth flow starts fresh (mirrors LinkedIn).
      await supabase.auth.signOut();

      // If we're launching OAuth from the installed PWA, drop a marker cookie so
      // the callback page (which can land in a separate browser tab) can tell
      // the user they can head back to the app. No-op for plain web sign-in.
      if (isStandalonePwa()) markOAuthFromPwa();

      // No query string on the callback — Supabase's redirect allow-list can drop
      // query strings even with wildcards; /auth/callback defaults `next` to
      // /results when missing. (Same rationale as LinkedInAuthButton.)
      const origin = window.location.origin;
      const callbackUrl = `${origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error("Google OAuth error:", error);
        toast.error(error.message || "Failed to connect with Google");
        setLoading(false);
        return;
      }

      if (!data?.url) {
        console.error("Google OAuth: no redirect URL returned");
        toast.error("Failed to start Google sign-in. Please try again.");
        setLoading(false);
        return;
      }

      console.log("[Google OAuth] Redirecting to:", data.url);
      window.location.href = data.url;
    } catch (err) {
      console.error("Google OAuth exception:", err);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      // Matches LinkedInAuthButton so the two stack as a unified pair.
      className={`w-full gap-2 font-medium ${className ?? ""}`}
      onClick={handleGoogle}
      disabled={loading}
    >
      <GoogleIcon className="h-5 w-5 shrink-0" />
      <span>
        {loading
          ? "Connecting..."
          : mode === "login"
            ? "Sign in with Google"
            : "Sign up with Google"}
      </span>
    </Button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
