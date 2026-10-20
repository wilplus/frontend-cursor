/*
GUARD    The 76 relay-only routes answer and forward exactly what they did
         before they became one-line proxyRoute() calls.
CATCHES  Any change in status, body, content type, cache header or the
         request sent to the backend (URL, method, headers, body), under each
         of the 12 scenarios in bffTestkit (ok, errors, empty, HTML, signed
         out, no backend URL, network failure, timeout).
IF REMOVED  A refactor of the relay code can change what speakers, coaches
         or the admin pages get, with nothing failing.
PROVES   any drift -> one test per route in bffProxyRoutes.golden.json
                      (named file#handler#body)
WHY      Frontend glue cut (founder 2026-10-12); never regenerate the golden
         to turn red green.
*/
import { describe, expect, it, vi } from "vitest";
import {
  absolute,
  runScenario,
  SCENARIOS,
  type BodyKind,
  type Outcome,
  type RouteSpec,
} from "@/app/api/_lib/bffTestkit";
import golden from "./bffProxyRoutes.golden.json";

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

const importRoute = (file: string) => import(/* @vite-ignore */ absolute(file));

/** What one scenario gave: the outcome without the random request id, or
 *  the error the handler threw. */
async function observe(spec: RouteSpec, scenario: (typeof SCENARIOS)[number]) {
  try {
    return pinned(await runScenario(ctx, spec, scenario, importRoute));
  } catch (err) {
    return { throws: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

/** Everything but the request id, which is random per call. */
function pinned(outcome: Outcome) {
  return {
    status: outcome.status,
    body: outcome.body,
    contentType: outcome.contentType,
    cacheControl: outcome.cacheControl,
    upstream: outcome.upstream.map(({ headers, ...call }) => ({
      ...call,
      headers: Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "x-request-id")),
    })),
  };
}

const GOLDEN = golden as Record<string, Record<string, unknown>>;

describe("relay-only BFF routes answer and forward what they always did", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const key of Object.keys(GOLDEN)) {
    const [file, handler, bodyKind] = key.split("#");
    const spec: RouteSpec = { file, handler, bodyKind: bodyKind as BodyKind };
    it(key, async () => {
      for (const scenario of SCENARIOS) {
        const actual = await observe(spec, scenario);
        expect(actual, `${key} under ${scenario.name}`).toEqual(GOLDEN[key][scenario.name]);
      }
    }, 60_000);
  }
});
