import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { ApiError } from "./types";
import type { Session } from "@supabase/supabase-js";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

if (!BACKEND_BASE_URL) {
  console.error("[BFF] NEXT_PUBLIC_API_URL is not set! Backend requests will fail.");
}

function unauthorizedResponse(): NextResponse<ApiError> {
  return NextResponse.json(
    { code: "UNAUTHORIZED", error: "Session expired" },
    { status: 401 }
  );
}

/**
 * Get session using request cookies and write any refreshed cookies to a response.
 * Caller must merge cookieResponse's cookies onto the final response so the client gets refreshed tokens.
 */
export async function getSessionForRequest(req: NextRequest): Promise<{
  session: Session | null;
  cookieResponse: NextResponse;
}> {
  const cookieResponse = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieResponse.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieResponse.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes the session if needed; refreshed tokens are written to cookieResponse
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { session: null, cookieResponse };
  }

  const { data: { session } } = await supabase.auth.getSession();
  return { session, cookieResponse };
}

/** Copy cookies from one response to another (e.g. so routes that transform body can keep session cookies). */
export function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, { path: "/" });
  });
}

/**
 * Generic helper for JSON proxying (non-multipart).
 * Uses request-scoped session so refreshed cookies are written to the response.
 */
// Helper type to avoid BodyInit conflict
type ProxyJsonBody = unknown;

export async function proxyJson<RequestBody = ProxyJsonBody, ResponseBody = unknown>(
  path: string,
  init?: {
    method?: string;
    headers?: HeadersInit;
    body?: RequestBody | null;
    signal?: AbortSignal;
  },
  req?: NextRequest
): Promise<NextResponse<ResponseBody | ApiError>> {
  let accessToken: string | null = null;
  let cookieResponse: NextResponse | null = null;

  // Prefer Authorization header from client (avoids cookie issues)
  let usedHeaderToken = false;
  if (req) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token && token !== "undefined" && token !== "null") {
        accessToken = token;
        usedHeaderToken = true;
        console.log("[BFF] Request to", path, "– using Authorization header, token length:", accessToken.length);
      }
    }
    if (!accessToken) {
      console.log("[BFF] Request to", path, "– no valid Auth header, attempting cookie session...");
      const result = await getSessionForRequest(req);
      accessToken = result.session?.access_token ?? null;
      cookieResponse = result.cookieResponse;
      if (accessToken) console.log("[BFF] Cookie session found.");
      else console.log("[BFF] Cookie session failed: no session.");
    }
  } else {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    const sessionResult = await supabase.auth.getSession();
    accessToken = sessionResult.data?.session?.access_token ?? null;
  }

  if (!accessToken) {
    console.error("[BFF] No session/token available for request to:", path);
    return unauthorizedResponse();
  }

  const url = `${BACKEND_BASE_URL}${path}`;
  const method = init?.method ?? "GET";

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let bodyString: string | undefined = undefined;
  if (init?.body != null) {
    headers.set("Content-Type", "application/json");
    bodyString = JSON.stringify(init.body as any);
  }

  const fetchInit: RequestInit = {
    method,
    headers,
    body: bodyString,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let resp = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Fix B: If we used header token and Flask returned 401, try cookie refresh and retry once
    if (usedHeaderToken && req && resp.status === 401) {
      console.log("[BFF] Header token got 401 from Flask. Attempting cookie refresh and retry...");
      const result = await getSessionForRequest(req);
      const refreshedToken = result.session?.access_token ?? null;
      if (refreshedToken) {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
        resp = await fetch(url, {
          method,
          headers: new Headers({
            Accept: "application/json",
            Authorization: `Bearer ${refreshedToken}`,
            ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
          }),
          body: bodyString,
          signal: retryController.signal,
        });
        clearTimeout(retryTimeoutId);
        console.log("[BFF] Retry with refreshed token – status:", resp.status);
        if (cookieResponse == null) cookieResponse = result.cookieResponse;
      }
    } else if (resp.status === 401) {
      console.log("[BFF] Flask response status: 401 for", path);
    }

    const text = await resp.text();
    
    // Handle empty responses
    if (!text) {
      if (!resp.ok) {
        const out = NextResponse.json(
          { code: `HTTP_${resp.status}`, error: resp.statusText || "Request failed" },
          { status: resp.status }
        );
        if (cookieResponse) copyCookies(cookieResponse, out);
        return out;
      }
      const out = NextResponse.json(null as ResponseBody, { status: resp.status });
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    // Backend returned HTML (e.g. 404 page) instead of JSON — return a clean JSON error
    if (text.includes("<!doctype html>") || text.includes("<html") || text.includes("<title>")) {
      const status = resp.status === 404 ? 404 : resp.status || 500;
      const out = NextResponse.json(
        status === 404
          ? { code: "NOT_FOUND", error: `Backend route not found: ${path}. The endpoint may not be implemented yet.` }
          : { code: "HTML_ERROR_RESPONSE", error: `Backend returned HTML (status ${resp.status}).` },
        { status }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON response. Raw text:", text.substring(0, 200));
      const out = NextResponse.json(
        {
          code: "INVALID_RESPONSE",
          error: "Backend returned an invalid response.",
        },
        { status: 500 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    // Handle 502 Bad Gateway (backend not responding)
    if (resp.status === 502) {
      console.error("[BFF] Backend returned 502 - Application failed to respond");
      console.error("[BFF] Backend URL:", url);
      console.error("[BFF] Check if Flask backend is running and accessible at:", BACKEND_BASE_URL);

      const out = NextResponse.json(
        {
          code: "BACKEND_UNAVAILABLE",
          error: `Backend server is not responding. Please check:
1. Is your Flask backend running?
2. Is NEXT_PUBLIC_API_URL set correctly? (Current: ${BACKEND_BASE_URL || "NOT SET"})
3. Can you reach the backend URL directly?`,
        },
        { status: 502 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    if (!resp.ok && json) {
      console.error("Backend error response:", json);
    }

    const out = NextResponse.json(json, { status: resp.status });
    if (cookieResponse) copyCookies(cookieResponse, out);
    return out;
  } catch (fetchError) {
    console.error("BFF fetch error:", fetchError);

    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      const out = NextResponse.json(
        {
          code: "TIMEOUT",
          error: "Backend request timed out after 30 seconds",
        },
        { status: 504 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    const out = NextResponse.json(
      {
        code: "FETCH_ERROR",
        error: fetchError instanceof Error ? fetchError.message : "Failed to reach backend",
      },
      { status: 500 }
    );
    if (cookieResponse) copyCookies(cookieResponse, out);
    return out;
  }
}

/**
 * Helper for multipart upload proxying.
 * Pass req so session is request-scoped and refreshed cookies are returned.
 */
export async function proxyMultipart<ResponseBody = unknown>(
  path: string,
  formData: FormData,
  method: "POST" | "PUT" = "POST",
  req?: NextRequest
): Promise<NextResponse<ResponseBody | ApiError>> {
  let accessToken: string | null = null;
  let cookieResponse: NextResponse | null = null;

  if (req) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.slice(7).trim();
    }
    if (!accessToken) {
      const result = await getSessionForRequest(req);
      accessToken = result.session?.access_token ?? null;
      cookieResponse = result.cookieResponse;
    }
  } else {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    const sessionResult = await supabase.auth.getSession();
    accessToken = sessionResult.data?.session?.access_token ?? null;
  }

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const url = `${BACKEND_BASE_URL}${path}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  // Let the runtime set multipart boundary; do not override Content-Type.

  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads

    const resp = await fetch(url, {
      method,
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await resp.text();
    
    // Log response for debugging (especially for upload endpoint)
    if (path.includes("upload")) {
      console.log("[BFF proxyMultipart] Upload response status:", resp.status);
      console.log("[BFF proxyMultipart] Upload response text length:", text.length);
      try {
        const parsed = JSON.parse(text);
        console.log("[BFF proxyMultipart] Upload response JSON:", parsed);
        if (parsed.post_questions) {
          console.log("[BFF proxyMultipart] Post questions count:", parsed.post_questions.length);
        } else {
          console.warn("[BFF proxyMultipart] No post_questions in response!");
        }
      } catch (e) {
        console.error("[BFF proxyMultipart] Failed to parse upload response:", e);
      }
    }
    
    // Handle empty responses
    if (!text) {
      if (!resp.ok) {
        const out = NextResponse.json(
          { code: `HTTP_${resp.status}`, error: resp.statusText || "Request failed" },
          { status: resp.status }
        );
        if (cookieResponse) copyCookies(cookieResponse, out);
        return out;
      }
      const out = NextResponse.json(null as ResponseBody, { status: resp.status });
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    if (resp.status === 502) {
      console.error("[BFF proxyMultipart] Backend returned 502");
      const out = NextResponse.json(
        {
          code: "BACKEND_UNAVAILABLE",
          error: `Backend server is not responding. Please check:
1. Is your Flask backend running?
2. Is NEXT_PUBLIC_API_URL set correctly? (Current: ${BACKEND_BASE_URL || "NOT SET"})
3. Can you reach the backend URL directly?`,
        },
        { status: 502 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    if (text.includes("<!doctype html>") || text.includes("<html") || text.includes("<title>")) {
      const status = resp.status === 404 ? 404 : resp.status || 500;
      const out = NextResponse.json(
        status === 404
          ? { code: "NOT_FOUND", error: `Flask backend route not found: ${path}.` }
          : { code: "HTML_ERROR_RESPONSE", error: `Backend returned HTML (status ${resp.status}).` },
        { status }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      const out = NextResponse.json(
        { code: "INVALID_RESPONSE", error: `Backend returned invalid JSON: ${text.substring(0, 200)}` },
        { status: 500 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    if (!resp.ok) {
      console.error("Backend error response:", json);
      const out = json
        ? NextResponse.json(json, { status: resp.status })
        : NextResponse.json({ code: `HTTP_${resp.status}`, error: resp.statusText || "Request failed" }, { status: resp.status });
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    const out = NextResponse.json(json, { status: resp.status });
    if (cookieResponse) copyCookies(cookieResponse, out);
    return out;
  } catch (fetchError) {
    console.error("BFF multipart fetch error:", fetchError);

    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      const out = NextResponse.json(
        { code: "TIMEOUT", error: "Backend request timed out after 60 seconds" },
        { status: 504 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    const out = NextResponse.json(
      { code: "FETCH_ERROR", error: fetchError instanceof Error ? fetchError.message : "Failed to reach backend" },
      { status: 500 }
    );
    if (cookieResponse) copyCookies(cookieResponse, out);
    return out;
  }
}

/**
 * Proxy a request with binary body (e.g. application/octet-stream) to the backend.
 * Forwards body as-is and selected headers.
 */
export async function proxyBinary<ResponseBody = unknown>(
  path: string,
  req: NextRequest
): Promise<NextResponse<ResponseBody | ApiError>> {
  let accessToken: string | null = null;
  let cookieResponse: NextResponse | null = null;

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7).trim();
  }
  if (!accessToken) {
    const result = await getSessionForRequest(req);
    accessToken = result.session?.access_token ?? null;
    cookieResponse = result.cookieResponse;
  }

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const body = await req.arrayBuffer();
  const url = `${BACKEND_BASE_URL}${path}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", req.headers.get("Content-Type") || "application/octet-stream");
  headers.set("Accept", "application/json");
  const seq = req.headers.get("X-Chunk-Seq");
  if (seq !== null) headers.set("X-Chunk-Seq", seq);
  const startMs = req.headers.get("X-Chunk-Start-Ms");
  if (startMs !== null) headers.set("X-Chunk-Start-Ms", startMs);
  const slot = req.headers.get("X-Recording-Slot");
  if (slot !== null) headers.set("X-Recording-Slot", slot);
  const debug = req.headers.get("X-Debug");
  if (debug !== null) headers.set("X-Debug", debug);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await resp.text();

    if (!text) {
      if (!resp.ok) {
        const out = NextResponse.json(
          { code: `HTTP_${resp.status}`, error: resp.statusText || "Request failed" },
          { status: resp.status }
        );
        if (cookieResponse) copyCookies(cookieResponse, out);
        return out;
      }
      const out = NextResponse.json(null as ResponseBody, { status: resp.status });
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    if (resp.status === 502) {
      const out = NextResponse.json(
        {
          code: "BACKEND_UNAVAILABLE",
          error: "Backend server is not responding.",
        },
        { status: 502 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    if (text.includes("<!doctype html>") || text.includes("<html") || text.includes("<title>")) {
      const status = resp.status === 404 ? 404 : resp.status || 500;
      const out = NextResponse.json(
        status === 404
          ? { code: "NOT_FOUND", error: `Backend route not found: ${path}.` }
          : { code: "HTML_ERROR_RESPONSE", error: `Backend returned HTML (status ${resp.status}).` },
        { status }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    let json: ResponseBody;
    try {
      json = JSON.parse(text) as ResponseBody;
    } catch {
      const out = NextResponse.json(
        { code: "INVALID_RESPONSE", error: "Backend returned invalid JSON." },
        { status: 500 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }

    const out = NextResponse.json(json, { status: resp.status });
    if (cookieResponse) copyCookies(cookieResponse, out);
    return out;
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      const out = NextResponse.json(
        { code: "TIMEOUT", error: "Chunk request timed out." },
        { status: 504 }
      );
      if (cookieResponse) copyCookies(cookieResponse, out);
      return out;
    }
    const out = NextResponse.json(
      { code: "FETCH_ERROR", error: fetchError instanceof Error ? fetchError.message : "Failed to reach backend" },
      { status: 500 }
    );
    if (cookieResponse) copyCookies(cookieResponse, out);
    return out;
  }
}

