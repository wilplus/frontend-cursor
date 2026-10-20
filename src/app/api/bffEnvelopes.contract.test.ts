/*
STORY    As a speaker, I want the app's answers (status and error words) to
         stay exactly as signed off when the plumbing behind them changes,
         so that no screen breaks or shows new words.
OUTCOME
  O1  Each of the 9 routes moved onto the shared backend call answers with
      the same status, body, content type and cache header as before, in
      every scenario recorded for it (ok, errors, signed out, backend down).
  O2  The recording-progress stream only asks the backend for the readout,
      never for an endpoint the backend does not have.
PROVES   O1 -> one test per route in bffEnvelopes.golden.json (named
               file#handler#body)
         O2 -> "never calls the native-SSE endpoint the backend never served"
WHY      Never 4 (no new words without the founder's OK): change the golden
         only on purpose, never regenerate it to turn red green.
*/
import { describe, expect, it, vi } from "vitest";
import {
  absolute,
  LAB_EVENTS_FILE,
  runScenario,
  SCENARIOS,
  LAB_EVENTS_SCENARIOS,
  type BodyKind,
  type Outcome,
  type RouteSpec,
  type Scenario,
} from "@/app/api/_lib/bffTestkit";
import golden from "./bffEnvelopes.golden.json";

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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
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

type Pinned = { status: number; body: unknown; contentType: string | null; cacheControl: string | null } | { throws: string };
const GOLDEN = golden as Record<string, Record<string, Pinned>>;
const SCENARIO_BY_NAME = new Map<string, Scenario>(
  [...SCENARIOS, ...LAB_EVENTS_SCENARIOS].map((s) => [s.name, s])
);
const MATRIX_NAMES = new Set(SCENARIOS.map((s) => s.name));

const importRoute = (file: string) => import(/* @vite-ignore */ absolute(file));

function observed(outcome: Outcome): Pinned {
  return {
    status: outcome.status,
    body: outcome.body,
    contentType: outcome.contentType,
    cacheControl: outcome.cacheControl,
  };
}

describe("BFF envelopes are the ones each route shipped with", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  for (const [key, cells] of Object.entries(GOLDEN)) {
    const [file, handler, bodyKind] = key.split("#");
    const spec: RouteSpec = { file, handler, bodyKind: bodyKind as BodyKind };
    it(key, async () => {
      for (const [name, pinned] of Object.entries(cells)) {
        const base = SCENARIO_BY_NAME.get(name);
        expect(base, `unknown scenario ${name}`).toBeDefined();
        const scenario: Scenario =
          file === LAB_EVENTS_FILE && MATRIX_NAMES.has(name) ? { ...base!, aborted: true } : base!;
        let actual: Pinned;
        try {
          actual = observed(await runScenario(ctx, spec, scenario, importRoute));
        } catch (err) {
          actual = { throws: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
        }
        expect(actual, `${key} under ${name}`).toEqual(pinned);
      }
    }, 60_000);
  }
});

describe("the lab progress stream only polls the readout", () => {
  it("never calls the native-SSE endpoint the backend never served", async () => {
    const scenario = SCENARIO_BY_NAME.get("bridge_terminal")!;
    const spec: RouteSpec = { file: LAB_EVENTS_FILE, handler: "GET", bodyKind: "none" };
    const outcome = await runScenario(ctx, spec, scenario, importRoute);
    expect(outcome.status).toBe(200);
    expect(outcome.upstream.length).toBeGreaterThan(0);
    for (const call of outcome.upstream) {
      expect(call.url).toMatch(/\/v2\/lab\/recordings\/[^/]+\/readout$/);
    }
  }, 60_000);
});
