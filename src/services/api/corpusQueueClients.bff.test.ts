/* Pins what the corpus index, the blind labelling queue and the coach's
 * language confirmation answer before and after they move onto bffFetch
 * (audit D5): the signed-out, network, refused and success cases, and
 * exactly what each sends. The audio import is not part of this move. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import {
  confirmCoachSessionLanguage,
  fetchConfidenceQueueResult,
  fetchTrainingImports,
} from "./trainingCorpus";

const token = vi.mocked(getAuthToken);
const BEARER = { Authorization: "Bearer tok" };

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function offline() {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
}

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchTrainingImports", () => {
  it("reads the index uncached, for one user when asked", async () => {
    const fn = stubFetch(200, { imports: [{ session_id: "s1" }, { nope: 1 }] });
    const rows = await fetchTrainingImports();
    expect(rows?.map((r) => r.sessionId)).toEqual(["s1"]);
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/training-imports", {
      headers: BEARER, cache: "no-store",
    });
    await fetchTrainingImports("u/1");
    expect(fn.mock.calls[1]?.[0]).toBe("/api/v2/coach/training-imports?user_id=u%2F1");
  });

  it("is null when refused, malformed, offline or signed out", async () => {
    stubFetch(500, { imports: [] });
    expect(await fetchTrainingImports()).toBeNull();
    stubFetch(200, { imports: "x" });
    expect(await fetchTrainingImports()).toBeNull();
    stubFetch(200, null);
    expect(await fetchTrainingImports()).toBeNull();
    offline();
    expect(await fetchTrainingImports()).toBeNull();
    token.mockResolvedValue(null);
    const fn = stubFetch(200, { imports: [] });
    expect(await fetchTrainingImports()).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("fetchConfidenceQueueResult", () => {
  it("reads the queue uncached and keeps its order", async () => {
    const fn = stubFetch(200, { session_id: "s1", queue: [] });
    expect(await fetchConfidenceQueueResult("s/1")).toEqual({
      ok: true, queue: { sessionId: "s1", queue: [] },
    });
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/sessions/s%2F1/confidence-queue", {
      headers: BEARER, cache: "no-store",
    });
  });

  it("types every failure", async () => {
    stubFetch(409, { code: "CLIP_LANGUAGE_UNKNOWN", error: "", language: "pl" });
    expect(await fetchConfidenceQueueResult("s")).toEqual({
      ok: false, status: 409, code: "CLIP_LANGUAGE_UNKNOWN",
      error: "Labelling queue unavailable.", language: "pl",
    });
    stubFetch(500, "not json");
    expect(await fetchConfidenceQueueResult("s")).toEqual({
      ok: false, status: 500, code: null,
      error: "Labelling queue unavailable.", language: null,
    });
    stubFetch(200, { queue: "x" });
    expect(await fetchConfidenceQueueResult("s")).toEqual({
      ok: false, status: 200, code: "INVALID_QUEUE_RESPONSE",
      error: "Labelling queue returned an invalid response.", language: null,
    });
    offline();
    expect(await fetchConfidenceQueueResult("s")).toEqual({
      ok: false, status: 0, code: "NETWORK_ERROR",
      error: "Labelling queue unavailable.", language: null,
    });
    token.mockResolvedValue(null);
    const fn = stubFetch(200, { queue: [] });
    expect(await fetchConfidenceQueueResult("s")).toEqual({
      ok: false, status: 401, code: "UNAUTHENTICATED",
      error: "Not authenticated", language: null,
    });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("confirmCoachSessionLanguage", () => {
  it("puts the normalised language and reports only ok", async () => {
    const fn = stubFetch(204, null);
    expect(await confirmCoachSessionLanguage("s/1", " EN ")).toBe(true);
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/sessions/s%2F1/confidence-queue", {
      method: "PUT",
      headers: { ...BEARER, "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en" }),
    });
    stubFetch(409, null);
    expect(await confirmCoachSessionLanguage("s", "en")).toBe(false);
    offline();
    expect(await confirmCoachSessionLanguage("s", "en")).toBe(false);
  });

  it("sends nothing for an unsupported language or when signed out", async () => {
    const fn = stubFetch(200, null);
    expect(await confirmCoachSessionLanguage("s", "klingon")).toBe(false);
    token.mockResolvedValue(null);
    expect(await confirmCoachSessionLanguage("s", "en")).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
