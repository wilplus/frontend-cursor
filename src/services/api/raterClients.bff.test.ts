/* Pins what the profile and readout clients answer
 * before and after they move onto bffFetch (audit D5): the signed-out,
 * network, refused and success cases, and exactly what each sends. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { fetchReadouts } from "./readouts";
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
