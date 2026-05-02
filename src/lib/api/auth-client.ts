import { createClient } from "@/lib/supabase/client";

/**
 * Get the current authenticated user's access token.
 * Used for passing auth to API routes that need to proxy to backend.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}
