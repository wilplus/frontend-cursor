/**
 * The Journal CMS's internal tools, as the CMS reaches them (frontend glue
 * cut, founder 2026-10-12). Written against the fifteen one-file routes and
 * kept green when they became one `[...path]` route: each tool path answers
 * exactly as before, with no session, the password in the body, the status
 * and body relayed, and the same envelope when the backend cannot be reached.
 * A path that is not a tool is a 404, as it was with no file there.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: () => ({ getAll: () => [], set: () => {}, get: () => undefined }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
    },
  }),
}));

const TOOLS = [
  "posts/list", "posts/get", "posts/create", "posts/update", "posts/delete",
  "posts/publish", "posts/unpublish", "reorder", "media/presign",
  "community/list", "community/update", "community/delete",
  "image/list", "image/select", "image/delete",
];
const DIR = "src/app/api/v2/internal/journal";

type Handler = (req: NextRequest, ctx: { params: { path: string[] } }) => Promise<Response>;

/** The handler Next would route `tool` to: its own file first, else the
 *  catch-all; null when neither exists (Next's own 404). */
async function resolve(tool: string): Promise<Handler | null> {
  process.env.BACKEND_URL = "http://backend.test";
  vi.resetModules();
  for (const file of [`${DIR}/${tool}/route.ts`, `${DIR}/[...path]/route.ts`]) {
    if (existsSync(file)) return (await import(/* @vite-ignore */ path.resolve(file))).POST as Handler;
  }
  return null;
}

async function post(tool: string, upstream: () => Promise<Response>) {
  const calls: { url: string; method?: string; auth: string | null; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method,
      auth: new Headers(init.headers).get("authorization"),
      body: init.body,
    });
    return upstream();
  }));
  const handler = await resolve(tool);
  if (!handler) return { status: 404, body: null, calls };
  const req = new NextRequest(`http://localhost/api/v2/internal/journal/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "pw", id: "p1" }),
  });
  try {
    const res = await handler(req, { params: { path: tool.split("/") } });
    return { status: res.status, body: await res.json().catch(() => null), calls };
  } catch (err) {
    // next/navigation's notFound(): Next answers 404.
    if (err instanceof Error && err.message === "NEXT_NOT_FOUND") return { status: 404, body: null, calls };
    throw err;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("the Journal CMS tools relay as they always did", () => {
  it.each(TOOLS)("%s", async (tool) => {
    const ok = await post(tool, async () => Response.json({ code: "WRONG" }, { status: 401 }));
    expect(ok).toEqual({
      status: 401,
      body: { code: "WRONG" },
      calls: [{
        url: `http://backend.test/v2/internal/journal/${tool}`,
        method: "POST",
        auth: null,
        body: JSON.stringify({ password: "pw", id: "p1" }),
      }],
    });
    const down = await post(tool, async () => { throw new TypeError("fetch failed"); });
    expect({ status: down.status, body: down.body }).toEqual({
      status: 502,
      body: { code: "PROXY_ERROR", error: "Journal service unavailable." },
    });
  });

  it("does not forward a path that is not a tool", async () => {
    const res = await post("settings/secret", async () => Response.json({}));
    expect(res).toEqual({ status: 404, body: null, calls: [] });
  });
});
