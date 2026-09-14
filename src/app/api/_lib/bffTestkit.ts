/**
 * Test kit for BFF route handlers (audit Q-A8, Phase 4). Not a test itself.
 *
 * Runs one route handler under one scenario — who is signed in, whether the
 * backend URL is configured, and what the upstream answers — with `fetch`
 * stubbed, and records what came back plus every upstream request the route
 * made. bffEnvelopes.contract.test.ts uses it to pin every route's failure
 * envelope to the copy it shipped with.
 *
 * The test file that uses this kit owns the `vi.mock` calls for `server-only`,
 * `next/headers`, `next/cache` and `@supabase/ssr` (they must be hoisted in
 * the test file); their factories read the `Ctx` the file passes to
 * `runScenario`. `vi.resetModules()` runs before every import so the base URL
 * is read from the scenario's environment; the mocked modules are re-created
 * by their factories against the same `Ctx` object.
 */
import { vi } from "vitest";
import path from "node:path";
import { NextRequest } from "next/server";

/** The state the test file's mocks read. Created with `vi.hoisted` in the
 *  test file (mock factories are hoisted above imports) and passed in. */
export type Ctx = { headerToken: string | null; cookieToken: string | null };

export type Upstream =
  | { status: number; body: string | null; headers?: Record<string, string> }
  | { throws: "TypeError" | "AbortError" };

export type Scenario = {
  name: string;
  headerToken: string | null;
  cookieToken: string | null;
  backendUrl: string;
  upstream: Upstream;
  /** The inbound request's signal is already aborted (the SSE bridge's exit). */
  aborted?: boolean;
};

export type BodyKind = "none" | "json" | "multipart";

export type RouteSpec = {
  /** Repository-relative path of the module. */
  file: string;
  /** Exported handler name, or "relayTokensGet" for the tokens helper. */
  handler: string;
  bodyKind: BodyKind;
};

export type UpstreamCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
};

export type Outcome = {
  status: number;
  body: unknown;
  contentType: string | null;
  cacheControl: string | null;
  upstream: UpstreamCall[];
};

export const GUEST_OWNER = "guest-owner-1";
export const QUERY =
  "version=3&force=true&limit=5&before=2026-01-01&user_id=u1&search=s&offset=2&extra=1";

const OK_JSON = '{"ok":true,"items":[1]}';

/** The scenario matrix every route runs under. */
export const SCENARIOS: Scenario[] = [
  { name: "ok_json", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 200, body: OK_JSON, headers: { "content-type": "application/json" } } },
  { name: "err_json_404", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 404, body: '{"code":"NOT_FOUND","error":"nope"}', headers: { "content-type": "application/json" } } },
  { name: "json_502", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 502, body: '{"error":"upstream down"}', headers: { "content-type": "application/json" } } },
  { name: "empty_200", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 200, body: "" } },
  { name: "empty_204", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 204, body: null } },
  { name: "html_502", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 502, body: "<html>bad gateway</html>", headers: { "content-type": "text/html" } } },
  { name: "nonjson_200", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 200, body: "not json", headers: { "content-type": "text/plain" } } },
  { name: "cookie_token", headerToken: null, cookieToken: "cookie-tok", backendUrl: "http://backend.test", upstream: { status: 200, body: OK_JSON, headers: { "content-type": "application/json" } } },
  { name: "no_token", headerToken: null, cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 200, body: OK_JSON, headers: { "content-type": "application/json" } } },
  { name: "no_url", headerToken: "hdr-tok", cookieToken: null, backendUrl: "", upstream: { status: 200, body: OK_JSON, headers: { "content-type": "application/json" } } },
  { name: "fetch_throws", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { throws: "TypeError" } },
  { name: "fetch_aborts", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { throws: "AbortError" } },
];

/** The SSE bridge polls for up to 55 s unless the request is gone or the job
 *  is terminal, so it runs the matrix with an aborted request and gets two
 *  scenarios of its own. */
export const LAB_EVENTS_FILE = "src/app/api/v2/lab/recordings/[sessionId]/events/route.ts";
export const LAB_EVENTS_SCENARIOS: Scenario[] = [
  { name: "sse_passthrough", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 200, body: "event: status\ndata: {}\n\n", headers: { "content-type": "text/event-stream" } } },
  { name: "bridge_terminal", headerToken: "hdr-tok", cookieToken: null, backendUrl: "http://backend.test", upstream: { status: 200, body: '{"state":"ready"}', headers: { "content-type": "application/json" } } },
];

const PARAM_VALUES: Record<string, string> = {
  arcId: "arc-1",
  blockKey: "b1",
  pieceKey: "p1",
  revision: "7",
  sessionId: "sess-1",
  snippetId: "snip-1",
  userId: "user-1",
  presentationId: "pres-1",
  takeNumber: "2",
  id: "rec-1",
};

/** `src/app/api/v2/x/[y]/route.ts` → URL path + params object. */
export function routeAddress(file: string): {
  urlPath: string;
  params: Record<string, string | string[]>;
} {
  const rel = file.replace(/^src\/app/, "").replace(/\/route\.ts$/, "").replace(/\/proxy\.ts$/, "");
  const params: Record<string, string | string[]> = {};
  const segments = rel.split("/").filter(Boolean).map((seg) => {
    const rest = seg.match(/^\[\.\.\.(\w+)\]$/);
    if (rest) {
      params[rest[1]] = ["notes", "today"];
      return "notes/today";
    }
    const one = seg.match(/^\[(\w+)\]$/);
    if (one) {
      const value = PARAM_VALUES[one[1]] ?? `${one[1]}-1`;
      params[one[1]] = value;
      return value;
    }
    return seg;
  });
  return { urlPath: "/" + segments.join("/"), params };
}

function describeBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (body instanceof FormData) {
    const keys: string[] = [];
    body.forEach((_v, k) => keys.push(k));
    return `formdata:${keys.sort().join(",")}`;
  }
  if (body instanceof ArrayBuffer) return `bytes:${body.byteLength}`;
  if (ArrayBuffer.isView(body)) return `bytes:${body.byteLength}`;
  return `other:${Object.prototype.toString.call(body)}`;
}

function stubFetch(scenario: Scenario): UpstreamCall[] {
  const calls: UpstreamCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const headersIn = init?.headers;
    const headers: Record<string, string> = {};
    if (headersIn instanceof Headers) headersIn.forEach((v, k) => (headers[k.toLowerCase()] = v));
    else if (headersIn) for (const [k, v] of Object.entries(headersIn as Record<string, string>)) headers[k.toLowerCase()] = v;
    calls.push({
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      headers,
      body: describeBody(init?.body),
    });
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const up = scenario.upstream;
    if ("throws" in up) {
      if (up.throws === "AbortError") throw new DOMException("aborted", "AbortError");
      throw new TypeError("fetch failed");
    }
    return new Response(up.body, { status: up.status, headers: up.headers ?? {} });
  }) as typeof fetch;
  return calls;
}

function buildRequest(
  urlPath: string,
  method: string,
  bodyKind: BodyKind,
  scenario: Scenario
): NextRequest {
  const headers: Record<string, string> = { "X-Willab-Guest-Owner": GUEST_OWNER };
  if (scenario.headerToken) headers.Authorization = `Bearer ${scenario.headerToken}`;
  let body: BodyInit | undefined;
  if (method !== "GET" && bodyKind === "json") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ k: "v", password: "pw", token: "t-1", paths: ["/blog"] });
  } else if (method !== "GET" && bodyKind === "multipart") {
    const form = new FormData();
    form.append("question", "why");
    form.append("file", new Blob(["abc"], { type: "text/plain" }), "a.txt");
    body = form;
  }
  const controller = new AbortController();
  if (scenario.aborted) controller.abort();
  return new NextRequest(`http://localhost${urlPath}?${QUERY}`, {
    method,
    headers,
    body,
    signal: controller.signal,
  });
}

/**
 * Run `route.handler` under `scenario`. `importRoute` loads the module (the
 * caller decides where the file lives); modules are reset first so the base
 * URL is read from the scenario's environment.
 */
export async function runScenario(
  ctx: Ctx,
  route: RouteSpec,
  scenario: Scenario,
  importRoute: (file: string) => Promise<Record<string, unknown>>
): Promise<Outcome> {
  ctx.headerToken = scenario.headerToken;
  ctx.cookieToken = scenario.cookieToken;
  if (scenario.backendUrl) {
    process.env.BACKEND_URL = scenario.backendUrl;
    process.env.NEXT_PUBLIC_API_URL = scenario.backendUrl;
  } else {
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  }
  delete process.env.BACKEND_URL_INTERNAL;
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
  vi.resetModules();
  const mod = await importRoute(route.file);
  const { urlPath, params } = routeAddress(route.file);
  const calls = stubFetch(scenario);
  const method = route.handler === "relayTokensGet" ? "GET" : route.handler;
  const req = buildRequest(urlPath, method, route.bodyKind, scenario);
  let res: Response;
  if (route.handler === "relayTokensGet") {
    const relay = mod.relayTokensGet as (
      req: NextRequest,
      path: string,
      search?: URLSearchParams
    ) => Promise<Response>;
    res = await relay(req, "history", new URLSearchParams("limit=5"));
  } else {
    const handler = mod[route.handler] as (
      req: NextRequest,
      context: { params: Record<string, string | string[]> }
    ) => Promise<Response>;
    res = await handler(req, { params });
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : text;
  } catch {
    body = text;
  }
  return {
    status: res.status,
    body,
    contentType: res.headers.get("content-type"),
    cacheControl: res.headers.get("cache-control"),
    upstream: calls,
  };
}

/** Absolute path of a repository-relative file, for `import()`. */
export function absolute(file: string): string {
  return path.resolve(process.cwd(), file);
}

