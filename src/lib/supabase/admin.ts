import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service role for admin operations (e.g. auth.admin.getUserById).
 * Only use in server-side API routes. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
