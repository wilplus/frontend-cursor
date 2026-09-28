/* Pins what the profile, star-verdict, A/B-pair and readout clients answer
 * before and after they move onto bffFetch (audit D5): the signed-out,
 * network, refused and success cases, and exactly what each sends. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { fetchAbPairs, saveAbVerdict } from "./abPairs";
import { fetchReadouts } from "./readouts";
import { fetchCoachArcStars, saveStarVerdict } from "./starVerdicts";
import { fetchUserProfile, saveUserProfile, type UserProfileDraft } from "./userProfile";

const token = vi.mocked(getAuthToken);
const BEARER = { Authorization: "Bearer tok" };
const JSON_BEARER = { ...BEARER, "Content-Type": "application/json" };

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

async function signedOutSendsNothing(call: () => Promise<unknown>, answer: unknown) {
  token.mockResolvedValue(null);
  const fn = stubFetch(200, {});
  expect(await call()).toEqual(answer);
  expect(fn).not.toHaveBeenCalled();
}

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("user profile", () => {
  it("reads uncached with the Bearer header", async () => {
    const fn = stubFetch(200, { goal: "Pitch", is_coach: true });
    expect(await fetchUserProfile()).toMatchObject({ goal: "Pitch", is_coach: true });
    expect(fn).toHaveBeenCalledWith("/api/v2/user/profile", {
      headers: BEARER, cache: "no-store",
    });
  });

  it("reads null when refused, empty, offline or signed out", async () => {
    stubFetch(401, { goal: "x" });
    expect(await fetchUserProfile()).toBeNull();
    stubFetch(200, null);
    expect(await fetchUserProfile()).toBeNull();
    offline();
    expect(await fetchUserProfile()).toBeNull();
    await signedOutSendsNothing(fetchUserProfile, null);
  });

  it("saves with a JSON POST and reports only ok", async () => {
    const draft: UserProfileDraft = { domain: "sales", goal: "g" };
    const fn = stubFetch(204, null);
    expect(await saveUserProfile(draft)).toBe(true);
    expect(fn).toHaveBeenCalledWith("/api/v2/user/profile", {
      method: "POST", headers: JSON_BEARER, body: JSON.stringify(draft),
    });
    stubFetch(500, null);
    expect(await saveUserProfile(draft)).toBe(false);
    offline();
    expect(await saveUserProfile(draft)).toBe(false);
    await signedOutSendsNothing(() => saveUserProfile(draft), false);
  });
});

describe("star verdicts", () => {
  it("reads the arc's stars uncached", async () => {
    const fn = stubFetch(200, { arc_id: "a", stars: [] });
    expect(await fetchCoachArcStars("a/1")).not.toBeNull();
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/arc/a%2F1/stars", {
      headers: BEARER, cache: "no-store",
    });
  });

  it("reads null when refused, malformed, offline or signed out", async () => {
    stubFetch(500, { stars: [] });
    expect(await fetchCoachArcStars("a")).toBeNull();
    stubFetch(200, { stars: "no" });
    expect(await fetchCoachArcStars("a")).toBeNull();
    offline();
    expect(await fetchCoachArcStars("a")).toBeNull();
    await signedOutSendsNothing(() => fetchCoachArcStars("a"), null);
  });

  it("puts one verdict and names the server's refusal", async () => {
    const body = { verdict: "keep" } as unknown as Parameters<typeof saveStarVerdict>[1];
    const fn = stubFetch(200, null);
    expect(await saveStarVerdict("s/1", body)).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/snippets/s%2F1/star-verdict", {
      method: "PUT", headers: JSON_BEARER, body: JSON.stringify(body),
      cache: "no-store",
    });
    stubFetch(400, { error: "wrong_kind needs a correction" });
    expect(await saveStarVerdict("s", body)).toEqual({
      ok: false, error: "wrong_kind needs a correction",
    });
    stubFetch(500, { error: 7 });
    expect(await saveStarVerdict("s", body)).toEqual({ ok: false, error: null });
    offline();
    expect(await saveStarVerdict("s", body)).toEqual({ ok: false, error: null });
    await signedOutSendsNothing(() => saveStarVerdict("s", body), { ok: false, error: null });
  });
});

describe("A/B pairs", () => {
  it("reads the queue, or every pair on request", async () => {
    const fn = stubFetch(200, { pairs: [], rated_count: 2, reason: "none" });
    expect(await fetchAbPairs("a/1")).toEqual({ pairs: [], ratedCount: 2, reason: "none" });
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/arcs/a%2F1/ab-pairs", {
      headers: BEARER, cache: "no-store",
    });
    await fetchAbPairs("a", { all: true });
    expect(fn.mock.calls[1]?.[0]).toBe("/api/v2/coach/arcs/a/ab-pairs?all=1");
  });

  it("reads null when refused, empty, offline or signed out", async () => {
    stubFetch(403, { pairs: [] });
    expect(await fetchAbPairs("a")).toBeNull();
    stubFetch(200, null);
    expect(await fetchAbPairs("a")).toBeNull();
    offline();
    expect(await fetchAbPairs("a")).toBeNull();
    await signedOutSendsNothing(() => fetchAbPairs("a"), null);
  });

  it("puts one verdict and reports only ok", async () => {
    const fn = stubFetch(200, null);
    expect(await saveAbVerdict("a/1", "p1", "left")).toBe(true);
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/arcs/a%2F1/ab-verdict", {
      method: "PUT", headers: JSON_BEARER,
      body: JSON.stringify({ pair_id: "p1", verdict: "left" }), cache: "no-store",
    });
    stubFetch(409, null);
    expect(await saveAbVerdict("a", "p", "left")).toBe(false);
    offline();
    expect(await saveAbVerdict("a", "p", "left")).toBe(false);
    await signedOutSendsNothing(() => saveAbVerdict("a", "p", "left"), false);
  });
});

describe("readouts", () => {
  it("reads the list uncached and keeps only rows with a session", async () => {
    const fn = stubFetch(200, { readouts: [{ session_id: "s1" }, { nope: 1 }] });
    const rows = await fetchReadouts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sessionId: "s1" });
    expect(fn).toHaveBeenCalledWith("/api/v2/user/readouts", {
      headers: BEARER, cache: "no-store",
    });
  });

  it("is empty when refused, malformed, offline or signed out", async () => {
    stubFetch(500, { readouts: [{ session_id: "s1" }] });
    expect(await fetchReadouts()).toEqual([]);
    stubFetch(200, { readouts: "x" });
    expect(await fetchReadouts()).toEqual([]);
    offline();
    expect(await fetchReadouts()).toEqual([]);
    await signedOutSendsNothing(fetchReadouts, []);
  });
});
