import "server-only";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
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

function createRequestSupabaseClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Modern getAll cookie API — the legacy get(name) variant only
      // returns the raw cookie value for one name and can't reassemble
      // Supabase's chunked auth-token cookies (.0/.1/...). On a session
      // big enough to chunk, getSession() then returns null even when
      // the browser has a valid session — which was producing 401s on
      // every BFF call after a successful client-side OAuth exchange.
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        // No-op writers — read-only client; route handlers that need
        // to write cookies have their own response-bound adapter.
        setAll() {},
      },
    }
  );
}

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

export async function getCurrentUserIdentity(req: NextRequest): Promise<{
  id: string | null;
  email: string | null;
  displayName: string | null;
  initials: string | null;
}> {
  const supabase = createRequestSupabaseClient(req);
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
 * Get the current user's Supabase access token for admin BFF requests.
 * Uses Authorization header first, then cookie session.
 */
export async function getV2AccessToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token && token !== "undefined" && token !== "null") return token;
  }

  const supabase = createRequestSupabaseClient(req);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
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
