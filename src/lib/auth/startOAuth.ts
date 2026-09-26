import { createClient } from "@/lib/supabase/client";
import { isStandalonePwa, markOAuthFromPwa } from "@/lib/pwa";
import type { OAuthProvider } from "@/lib/auth/oauthRetry";

/**
 * Start a Supabase OAuth sign-in and navigate to the provider.
 *
 * Shared by the LinkedIn and Google buttons and by the one automatic restart
 * in LoginForm (see oauthRetry.ts), so a restart is exactly the sign-in the
 * person started. Resolves with an error string when it could not navigate;
 * the caller owns the toast.
 */
export async function startOAuth(
  provider: OAuthProvider
): Promise<{ error: "provider" | "no_url"; message?: string } | null> {
  const supabase = createClient();

  // Clear any existing session so OAuth flow starts fresh
  // (prevents instant redirect when user already has a stale session)
  await supabase.auth.signOut();

  // If we're launching OAuth from the installed PWA, drop a marker cookie so
  // the callback page (which can land in a separate browser tab) can tell
  // the user they can head back to the app. No-op for plain web sign-in.
  if (isStandalonePwa()) markOAuthFromPwa();

  // No query string deliberately: Supabase's redirect-URL allow-list can
  // refuse query strings even with `**` wildcards and silently fall back to
  // the Site URL. /auth/callback defaults `next` when it is missing.
  const callbackUrl = `${window.location.origin}/auth/callback`;

  // skipBrowserRedirect: get the URL and validate it before redirecting
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error(`[OAuth ${provider}] error:`, error);
    return { error: "provider", message: error.message };
  }
  if (!data?.url) {
    console.error(`[OAuth ${provider}] no redirect URL returned`);
    return { error: "no_url" };
  }

  console.log(`[OAuth ${provider}] Redirecting to:`, data.url);
  window.location.href = data.url;
  return null;
}
