import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getBackendUrl } from "@/app/api/getAuth";

export const runtime = "nodejs";

/**
 * POST /api/v2/internal/journal/revalidate
 *
 * On-demand ISR revalidation for the Journal, called by the CMS after a
 * publish / unpublish / update. Without it a newly published post takes up to
 * the full revalidate window to appear, and the first load after expiry still
 * serves the stale page while regenerating behind it — which reads as
 * "publishing is broken" even though the backend is fine.
 *
 * Authorization: this is not a passthrough, so it cannot lean on the backend's
 * password gate the way the other internal routes do. Instead it VERIFIES the
 * supplied admin password by making one cheap authenticated call upstream
 * (posts/list) and only revalidates on 200. Cache-busting is not destructive,
 * but an open endpoint would still let anyone force regeneration at will.
 */
export async function POST(req: NextRequest) {
  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  let body: { password?: unknown; paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Missing password." }, { status: 401 });
  }

  // Only ever revalidate our own Journal paths, whatever the caller sends.
  const requested = Array.isArray(body.paths) ? body.paths : [];
  const paths = requested
    .filter((p): p is string => typeof p === "string")
    .filter((p) => p === "/blog" || /^\/blog\/[A-Za-z0-9._~-]+$/.test(p));
  if (paths.length === 0) {
    return NextResponse.json({ error: "No valid paths." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/internal/journal/posts/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Could not verify the password." },
      { status: 502 }
    );
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Not authorized to revalidate." },
      { status: upstream.status === 401 ? 401 : 403 }
    );
  }

  for (const path of paths) revalidatePath(path);
  return NextResponse.json({ revalidated: paths });
}
