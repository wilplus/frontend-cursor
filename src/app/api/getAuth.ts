import "server-only";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAccessToken, getSupabase } from "@/app/api/_lib/backend";

// The backend base URL + the request-bound Supabase client both live in
// _lib/backend.ts now (FE handoff 2026-08-03 §C) — one idiom, one file.
// Re-exported so the 80 existing `from "@/app/api/getAuth"` imports keep
// working while routes migrate to callBackend in batches.
export { getBackendUrl } from "@/app/api/_lib/backend";

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function titleCaseToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function displayNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;
  const words = localPart
    .split(/[._+-]+/)
    .map((part) => titleCaseToken(part.trim()))
    .filter(Boolean);
  if (words.length === 0) return null;
  return words.join(" ");
}

function deriveDisplayName(
  email: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const candidates = [
    metadata?.full_name,
    metadata?.display_name,
    metadata?.name,
  ];
  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate);
    if (normalized && normalized.length > 1) {
      return normalized;
    }
  }
  return displayNameFromEmail(email);
}

function deriveInitials(displayName: string | null, email: string | null): string | null {
  const source = displayName ?? displayNameFromEmail(email);
  if (!source) return null;
  const parts = source
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || null;
}

export async function getCurrentUserIdentity(_req: NextRequest): Promise<{
  id: string | null;
  email: string | null;
  displayName: string | null;
  initials: string | null;
}> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  const metadata =
    user?.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : null;
  const displayName = deriveDisplayName(email, metadata);
  return {
    id: user?.id ?? null,
    email,
    displayName,
    initials: deriveInitials(displayName, email),
  };
}

/**
 * Get the current user's Supabase access token for BFF requests.
 * Authorization header first, then cookie session — now via the shared
 * _lib/backend.ts helper, which VALIDATES the session (getUser) and
 * PERSISTS a refreshed token instead of silently dropping it. Kept as a
 * shim so unmigrated routes get the refresh fix without touching them;
 * new/converted routes should use callBackend directly.
 */
export async function getV2AccessToken(_req: NextRequest): Promise<string | null> {
  return getAccessToken();
}

/**
 * Supabase user id for Route Handlers (e.g. Stripe checkout).
 * 1) Authorization: Bearer … → validate JWT with getUser(jwt) so clients that send the token (not only cookies) match Stripe client_reference_id.
 * 2) Cookie session via next/headers cookies().getAll() / setAll (Supabase SSR).
 */
export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7).trim();
    if (jwt && jwt !== "undefined" && jwt !== "null") {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return [];
            },
            setAll() {},
          },
        }
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(jwt);
      if (!error && user?.id) return user.id;
    }
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* Route handlers may not allow mutating cookies in all contexts */
          }
        },
      },
    }
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}
