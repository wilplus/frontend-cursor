/*
GUARD    Teach it, and keeping or dropping a model at a new price, save with
         PUT /api/v2/chats/setup/models. A static models folder hides the
         setup's [part] route, so that PUT has to be exported here or Next
         answers 405 and the host sees "That didn't save. Try again."
CATCHES  The models route dropping PUT, or any other setup part the host
         saves (Keep on "what", "walk", "models", …) whose static folder
         does not export the PUT the client sends.
IF REMOVED  Teach it fails again with a 405 that never reaches the backend,
         and the next static setup folder can do the same with nothing failing.
PROVES   the models PUT reaches /v2/chats/setup/models with the JSON body
         -> "PUT /api/v2/chats/setup/models is proxied to the backend"
         every saved setup part has a route that exports PUT
         -> "every setup part the host saves has a PUT route"
WHY      The client already sends the PUT (hostSetup.keepPart). The backend
         already accepts it on PUT /v2/chats/setup/<part>. Only this file
         was missing the method.
*/
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { absolute, runScenario, type BodyKind, type RouteSpec } from "@/app/api/_lib/bffTestkit";

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

const SAVED_IN = [
  "src/components/willab/chats/hostsetup/HostSetup.tsx",
  "src/components/willab/chats/hostsetup/hostWork.ts",
];

/** Parts the host setup actually saves, from keep("models") and keepPart("models"). */
function savedParts(): string[] {
  const parts = new Set<string>();
  for (const file of SAVED_IN) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(/keep(?:Part)?\(\s*["']([a-z0-9_-]+)["']/g)) parts.add(match[1]);
  }
  return [...parts].sort();
}

/** Next serves a static folder ahead of [part], so that file must export PUT. */
function putRoute(part: string): string {
  const own = `src/app/api/v2/chats/setup/${part}/route.ts`;
  return existsSync(own) ? own : "src/app/api/v2/chats/setup/[part]/route.ts";
}

describe("host setup models PUT", () => {
  it("PUT /api/v2/chats/setup/models is proxied to the backend", async () => {
    const spec: RouteSpec = {
      file: "src/app/api/v2/chats/setup/models/route.ts",
      handler: "PUT",
      bodyKind: "json" as BodyKind,
    };
    const outcome = await runScenario(ctx, spec, {
      name: "ok_json",
      headerToken: "hdr-tok",
      cookieToken: null,
      backendUrl: "http://backend.test",
      upstream: { status: 200, body: '{"ok":true}', headers: { "content-type": "application/json" } },
    }, (file) => import(/* @vite-ignore */ absolute(file)));
    expect(outcome.status).toBe(200);
    expect(outcome.upstream).toEqual([
      expect.objectContaining({
        url: expect.stringMatching(/^http:\/\/backend\.test\/v2\/chats\/setup\/models(\?|$)/),
        method: "PUT",
        body: expect.stringContaining('"k":"v"'),
      }),
    ]);
  });

  it("every setup part the host saves has a PUT route", () => {
    const parts = savedParts();
    expect(parts).toContain("models");
    expect(parts).toContain("walk");
    const missing = parts.filter((part) => !/export const PUT =/.test(readFileSync(putRoute(part), "utf8")));
    expect(missing).toEqual([]);
  });
});
