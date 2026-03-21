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

function createRequestSupabaseClient(req: NextRequest) {
  return createServerClient(
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
 * Get the current user's id (for BFF routes that need to call backend as "current user").
 * Uses Supabase session from cookies. Requires backend to allow GET /v2/admin/students/:id
 * when id === token's user id (in addition to admin-for-any-user).
 */
export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const identity = await getCurrentUserIdentity(req);
  return identity.id;
}
