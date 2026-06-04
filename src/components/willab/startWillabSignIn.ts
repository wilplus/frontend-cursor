"use client";

import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  startWillabSignIn — kick off the OAuth round-trip for the unsigned send    */
/*                                                                            */
/*  Mirrors LinkedInAuthButton: sign out for a fresh flow, then redirect to     */
/*  the provider. The callback returns to /auth/callback; the global            */
/*  <WillabPendingSend> then completes merge-then-send (§3.5/§13 Path 2).       */
/*  redirectTo carries no query string (Supabase allow-list quirk).           */
/* -------------------------------------------------------------------------- */

export async function startWillabSignIn(): Promise<void> {
  const supabase = createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    /* no existing session — fine */
  }
  const origin = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    throw new Error(error?.message ?? "Couldn't start sign-in. Please try again.");
  }
  window.location.href = data.url;
}
