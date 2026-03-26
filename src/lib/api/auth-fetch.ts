/**
 * Shared auth fetch helper — adds a Supabase Bearer token to request headers.
 * Import this instead of duplicating the pattern in each API client.
 */
export async function getAuthFetchOptions(
  extraHeaders: Record<string, string> = {}
): Promise<{ headers: Record<string, string>; credentials: RequestCredentials }> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore — unauthenticated requests fall back to cookie-based auth
    }
  }
  return { headers, credentials: "include" };
}
