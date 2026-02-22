import "server-only";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Private URL for BFF→backend (e.g. Railway: http://backend.railway.internal:PORT). When set, used instead of public URL. */
const RAW_INTERNAL = process.env.BACKEND_URL_INTERNAL?.trim().replace(/\/+$/, "");
const RAW_PUBLIC =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "";
/** Base URL with no trailing slash. Prefers BACKEND_URL_INTERNAL when set (server-side only). */
const BACKEND_URL = (RAW_INTERNAL || RAW_PUBLIC).replace(/\/+$/, "");

export function getBackendUrl(): string {
  return BACKEND_URL;
}

/**
 * Get the current user's Supabase access token for admin BFF requests.
 * Uses Authorization header first, then cookie session.
 */
export async function getV2AccessToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token && token !== "undefined" && token !== "null") return token;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
