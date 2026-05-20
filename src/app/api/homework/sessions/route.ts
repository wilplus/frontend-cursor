import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl, getCurrentUserId } from "@/app/api/getAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

/**
 * List current user's completed sessions for the Reports History list.
 *
 * Strategy:
 *  1. Try the user-facing endpoint GET /v2/homework/sessions  (preferred — no admin privileges needed).
 *  2. Fall back to GET /v2/admin/students/:userId if the first returns 404/501
 *     (backend may only implement the admin route).
 *
 * Both routes must return { sessions: [...] }.
 */
export async function GET(req: NextRequest) {
  const token = await getV2AccessToken(req);
  const userId = await getCurrentUserId(req);
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json({ sessions: [] }, { status: 200 });
  }

  const authHeader = { Authorization: `Bearer ${token}` };

  // ── 1. User-facing endpoint (no admin role required) ──────────────────────
  try {
    const res = await fetch(`${backend}/v2/homework/sessions`, {
      method: "GET",
      headers: authHeader,
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { sessions?: unknown[] };
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      return NextResponse.json({ sessions }, { status: 200 });
    }
    // 404 / 501 → endpoint not implemented; fall through to admin fallback
    if (res.status !== 404 && res.status !== 501) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return NextResponse.json(
        { error: "Failed to fetch sessions", source: "/v2/homework/sessions", details: data },
        { status: res.status }
      );
    }
  } catch {
    // Network error on first attempt — fall through
  }

  // ── 2. Admin fallback (works only if backend allows users to read their own data) ─
  try {
    const res = await fetch(`${backend}/v2/admin/students/${userId}`, {
      method: "GET",
      headers: authHeader,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return NextResponse.json(
        { error: "Failed to fetch sessions", source: `/v2/admin/students/${userId}`, details: data },
        { status: res.status }
      );
    }
    const data = (await res.json().catch(() => ({}))) as { sessions?: unknown[] };
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch sessions", details: e instanceof Error ? e.message : "Unknown error" },
      { status: 502 }
    );
  }
}
