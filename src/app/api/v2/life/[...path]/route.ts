import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  BFF proxy for the Life Panel — /api/v2/life/* → BACKEND /v2/life/*        */
/*                                                                            */
/*  ONE catch-all rather than fifteen near-identical files. The panel is a     */
/*  trial surface whose endpoint list is still moving, and a passthrough keeps */
/*  the FE from re-deploying every time the backend adds a route. The blast    */
/*  radius stays small because the prefix is fixed: this handler can only ever */
/*  reach `/v2/life/...`, never another backend namespace.                     */
/*                                                                            */
/*  STATUS CODES ARE PASSED THROUGH VERBATIM, and three of them are load-      */
/*  bearing (spec §1.4):                                                      */
/*    404 → the feature does not exist for this caller. Either the global kill */
/*          switch is off, or the surface is allowlisted and this user is not  */
/*          on it. It is deliberately NOT 403: a 403 confirms the surface      */
/*          exists. The FE renders nothing at all on a 404.                    */
/*    409 → signed in, but has not passed the consent screen. The FE routes to */
/*          the Principles tab. The note is still stored by the backend.       */
/*    401 → no session. The panel is signed-in only.                           */
/*                                                                            */
/*  PRIVACY (spec §2): this corpus contains addiction, confession-shaped       */
/*  religious material, named third parties and financial history. NOTHING     */
/*  here logs a request or response body, on any path, including errors. Only  */
/*  the method, the sanitised path and the status may be logged.               */
/* -------------------------------------------------------------------------- */

/** Path segments are single URL path components. Anything that could climb out
 *  of the `/v2/life` prefix (dots, slashes, empties) is refused outright. */
function safePath(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return null;
  const clean: string[] = [];
  for (const raw of segments) {
    if (typeof raw !== "string") return null;
    const seg = raw.trim();
    if (!seg || seg === "." || seg === ".." || seg.includes("/")) return null;
    clean.push(encodeURIComponent(seg));
  }
  return clean.join("/");
}

async function forward(
  req: NextRequest,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  params: { path: string[] }
): Promise<NextResponse> {
  const path = safePath(params.path);
  if (!path) {
    return NextResponse.json(
      { code: "NOT_FOUND", error: "Not found" },
      { status: 404 }
    );
  }

  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Not authenticated" },
      { status: 401 }
    );
  }

  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
      { status: 502 }
    );
  }

  const qs = req.nextUrl.search || "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  let body: string | undefined;
  if (method !== "GET") {
    // Read as text and forward verbatim. We never parse, inspect or log it.
    const raw = await req.text();
    if (raw) {
      body = raw;
      headers["Content-Type"] =
        req.headers.get("Content-Type") || "application/json";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}/v2/life/${path}${qs}`, {
      method,
      headers,
      body,
      cache: "no-store",
    });
  } catch (err) {
    // Message only. `err` can carry the request body on some fetch failures.
    console.error(
      `${method} /api/v2/life/${path} — upstream unreachable:`,
      err instanceof Error ? err.message : "unknown error"
    );
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Panel service unavailable." },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("Content-Type") || "";

  // The export endpoint hands back a file. Stream it through untouched so a
  // download stays a download instead of being re-wrapped as JSON.
  if (contentType && !contentType.includes("application/json")) {
    const buf = await upstream.arrayBuffer();
    const out = new NextResponse(buf, { status: upstream.status });
    out.headers.set("Content-Type", contentType);
    const disposition = upstream.headers.get("Content-Disposition");
    if (disposition) out.headers.set("Content-Disposition", disposition);
    out.headers.set("Cache-Control", "no-store");
    return out;
  }

  const text = await upstream.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          code: "UPSTREAM_NON_JSON",
          error: `Unexpected backend response (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 }
      );
    }
  }

  const out = NextResponse.json(data, { status: upstream.status });
  out.headers.set("Cache-Control", "no-store");
  return out;
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, "GET", ctx.params);
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, "POST", ctx.params);
}

export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, "PUT", ctx.params);
}

export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, "PATCH", ctx.params);
}

export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, "DELETE", ctx.params);
}
