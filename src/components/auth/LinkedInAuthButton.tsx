"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * LinkedIn OIDC sign-in button.
 *
 * Uses Supabase's `signInWithOAuth({ provider: "linkedin_oidc" })` which
 * redirects to LinkedIn, then back to /auth/callback with an auth code.
 *
 * The `redirectTo` param is forwarded so the callback can route the user
 * to the right page after the OAuth round-trip.
 */
export default function LinkedInAuthButton({
  mode = "signup",
  className,
}: {
  mode?: "signup" | "login";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleLinkedIn = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Clear any existing session so OAuth flow starts fresh
      // (prevents instant redirect when user already has a stale session)
      await supabase.auth.signOut();

      // Build the callback URL — after OAuth, Supabase redirects here.
      //
      // No query string deliberately. Supabase's redirect-URL allow-list
      // matcher in some project configurations does NOT accept query
      // strings even with `**` wildcards — so `?next=/results` was making
      // Supabase silently fall back to Site URL (`https://...com/`) and
      // the OAuth code landed on the homepage, never reaching this
      // route handler.
      //
      // The /auth/callback route handler defaults `next` to "/results"
      // when missing (see src/app/auth/callback/route.ts), so dropping
      // the query string here is functionally identical for the user
      // but bulletproof against allow-list matching quirks.
      const origin = window.location.origin;
      const callbackUrl = `${origin}/auth/callback`;

      // Use skipBrowserRedirect to get the URL and validate it before redirecting
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "linkedin_oidc",
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error("LinkedIn OAuth error:", error);
        toast.error(error.message || "Failed to connect with LinkedIn");
        setLoading(false);
        return;
      }

      // Validate we got a proper OAuth URL pointing to Supabase/LinkedIn
      if (!data?.url) {
        console.error("LinkedIn OAuth: no redirect URL returned");
        toast.error("Failed to start LinkedIn sign-in. Please try again.");
        setLoading(false);
        return;
      }

      console.log("[LinkedIn OAuth] Redirecting to:", data.url);

      // Redirect to the OAuth provider
      window.location.href = data.url;
    } catch (err) {
      console.error("LinkedIn OAuth exception:", err);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      // Same width + font-weight as the primary "Sign up with email" CTA so
      // the two stack as a unified pair. shrink-0 keeps the LinkedIn glyph
      // anchored when the label wraps on narrow viewports.
      className={`w-full gap-2 font-medium ${className ?? ""}`}
      onClick={handleLinkedIn}
      disabled={loading}
    >
      <LinkedInIcon className="h-5 w-5 shrink-0" />
      <span>
        {loading
          ? "Connecting..."
          : mode === "login"
            ? "Sign in with LinkedIn"
            : "Sign up with LinkedIn"}
      </span>
    </Button>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
        fill="#0A66C2"
      />
    </svg>
  );
}
