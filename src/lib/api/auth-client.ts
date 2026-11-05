import { readSession } from "@/lib/supabase/session";

/**
 * Get the current authenticated user's access token.
 * Used for passing auth to API routes that need to proxy to backend.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    // The one shared read (session.ts): a burst of BFF calls takes one turn
    // of supabase-js's lock, not one each.
    const session = await readSession();
    return session?.access_token || null;
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}
