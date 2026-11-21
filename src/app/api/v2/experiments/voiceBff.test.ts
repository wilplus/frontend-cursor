/*
STORY    The voice-model screens reach the backend only through this app,
         with the person's own session token.
OUTCOME
  O1  Each listed route is forwarded to the same path on the backend,
      and a 404 or a 403 comes back unchanged.
  O2  A recording is forwarded as multipart, and the reply-example
      query is forwarded with it.
PROVES   O1 -> "a missing catalog stays a 404 and a refused host stays a 403"
         O2 -> "a take upload and the reply-example query are forwarded"
*/
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { absolute, runScenario, type BodyKind, type RouteSpec, type Scenario } from "@/app/api/_lib/bffTestkit";

const ctx = vi.hoisted(() => ({
  headerToken: null as string | null,
  cookieToken: null as string | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(ctx.headerToken ? { Authorization: `Bearer ${ctx.headerToken}` } : {}),
  cookies: () => ({ getAll: () => [], set: () => {}, get: () => undefined }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: ctx.cookieToken ? { id: "u1" } : null } }),
      getSession: async () => ({
        data: { session: ctx.cookieToken ? { access_token: ctx.cookieToken } : null },
      }),
    },
  }),
}));

const load = (file: string) => import(/* @vite-ignore */ absolute(file));

const signed: Scenario = {
  name: "signed",
  headerToken: "hdr-tok",
  cookieToken: null,
  backendUrl: "http://backend.test",
  upstream: { status: 200, body: '{"ok":true}', headers: { "content-type": "application/json" } },
};

async function run(file: string, handler: string, bodyKind: BodyKind, scenario: Scenario = signed) {
  const spec: RouteSpec = { file, handler, bodyKind };
  return runScenario(ctx, spec, scenario, load);
}

function status(code: number): Scenario {
  return { ...signed, name: String(code), upstream: { status: code, body: "{}", headers: { "content-type": "application/json" } } };
}

describe("voice-model BFF", () => {
  it("a missing catalog stays a 404 and a refused host stays a 403", async () => {
    const catalog = await run("src/app/api/v2/experiments/models/route.ts", "GET", "none", status(404));
    expect(catalog.status).toBe(404);
    expect(catalog.upstream[0].url).toBe("http://backend.test/v2/experiments/models");
    expect(catalog.upstream[0].headers.authorization).toBe("Bearer hdr-tok");
    expect(JSON.stringify(catalog.upstream[0].headers)).not.toContain("service_role");

    const refused = await run("src/app/api/v2/chats/[chatId]/experiment-config/route.ts", "PUT", "json", status(403));
    expect(refused.status).toBe(403);
    expect(refused.upstream[0].url).toBe("http://backend.test/v2/chats/chatId-1/experiment-config");
    expect(refused.upstream[0].method).toBe("PUT");

    const queued = await run("src/app/api/v2/experiments/analyze-take/route.ts", "POST", "json", status(202));
    expect(queued.status).toBe(202);
    expect(queued.upstream[0].url).toBe("http://backend.test/v2/experiments/analyze-take");

    const reading = await run("src/app/api/v2/experiments/takes/[takeId]/analysis/route.ts", "GET", "none");
    expect(reading.upstream[0].url).toBe("http://backend.test/v2/experiments/takes/takeId-1/analysis");
  });

  it("a take upload and the reply-example query are forwarded", async () => {
    const examples = await run("src/app/api/v2/chats/[chatId]/reply-examples/route.ts", "GET", "none");
    expect(examples.upstream[0].url).toContain("http://backend.test/v2/chats/chatId-1/reply-examples?");
    expect(examples.upstream[0].url).toContain("limit=5");

    const session = await run("src/app/api/v2/experiments/sessions/route.ts", "POST", "json");
    expect(session.upstream[0].url).toBe("http://backend.test/v2/experiments/sessions");
    expect(session.upstream[0].body).toContain("password");

    ctx.headerToken = "hdr-tok";
    process.env.BACKEND_URL = "http://backend.test";
    process.env.NEXT_PUBLIC_API_URL = "http://backend.test";
    delete process.env.BACKEND_URL_INTERNAL;
    vi.resetModules();
    const calls: { url: string; body: string | null }[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body;
      calls.push({
        url: String(input),
        body: body instanceof FormData ? `form:${[...body.keys()].sort().join(",")}` : null,
      });
      return new Response('{"id":"t1"}', { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const mod = await load("src/app/api/v2/experiments/sessions/[sessionId]/takes/route.ts");
    const form = new FormData();
    form.set("audio", new Blob(["a"], { type: "audio/webm" }), "talk.webm");
    form.set("prompt_id", "b1");
    form.set("tag", "baseline_calm");
    form.set("self_rating", "{\"energy\":\"low\",\"feeling\":\"good\"}");
    const req = new NextRequest("http://localhost/api/v2/experiments/sessions/sess-1/takes", {
      method: "POST",
      headers: { Authorization: "Bearer hdr-tok" },
      body: form,
    });
    const handler = mod.POST as (req: NextRequest, ctx: { params: { sessionId: string } }) => Promise<Response>;
    const res = await handler(req, { params: { sessionId: "sess-1" } });
    expect(res.status).toBe(200);
    expect(calls[0].url).toBe("http://backend.test/v2/experiments/sessions/sess-1/takes");
    expect(calls[0].body).toBe("form:audio,prompt_id,self_rating,tag");
  });
});
