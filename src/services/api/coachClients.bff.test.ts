/* Pins what the coach review's three clients and the project deletion
 * client answer before and after they move onto bffFetch (audit D5): the
 * signed-out, network, refused and success cases. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/api/auth-client";
import { publishArc } from "./arcBatch";
import { fetchCoachReviewState } from "./coachReviewState";
import { cancelProjectDeletion, requestProjectDeletion } from "./projectDeletion";
import { saveCoachFeedback } from "./saveCoachFeedback";

const token = vi.mocked(getAuthToken);

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
  const fn = vi.fn(async () => { throw new TypeError("offline"); });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => token.mockResolvedValue("tok"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchCoachReviewState", () => {
  it("reads the wrap-up with the Bearer header, uncached", async () => {
    const fn = stubFetch(200, { arc_id: "a/1", published: true });
    const state = await fetchCoachReviewState("a/1");
    expect(state).toMatchObject({ arcId: "a/1", published: true, takes: [] });
    expect(fn).toHaveBeenCalledWith("/api/v2/coach/arc/a%2F1/review-state", {
      headers: { Authorization: "Bearer tok" }, cache: "no-store",
    });
  });

  it("is null when refused, unparsable, offline or signed out", async () => {
    stubFetch(500, { arc_id: "a" });
    expect(await fetchCoachReviewState("a")).toBeNull();
    stubFetch(200, "not an object");
    expect(await fetchCoachReviewState("a")).toBeNull();
    offline();
    expect(await fetchCoachReviewState("a")).toBeNull();
    token.mockResolvedValue(null);
    const fn = stubFetch(200, { arc_id: "a" });
    expect(await fetchCoachReviewState("a")).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("saveCoachFeedback", () => {
  it("posts the checkpoint, with snippets only when given", async () => {
    const fn = stubFetch(200, {});
    expect(await saveCoachFeedback({ sessionId: "s/1", overallMessage: "Hi" }))
      .toEqual({ ok: true });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/coach/sessions/s%2F1/save-feedback");
    expect(init).toEqual({
      method: "POST",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s/1", overall_message: "Hi" }),
    });
    await saveCoachFeedback({ sessionId: "s", overallMessage: null, snippets: [] });
    expect(JSON.parse((fn.mock.calls[1]?.[1] as RequestInit).body as string))
      .toEqual({ session_id: "s", overall_message: null, snippets: [] });
  });

  it("names the failure", async () => {
    const input = { sessionId: "s", overallMessage: null };
    stubFetch(409, { error: "Already delivered." });
    expect(await saveCoachFeedback(input))
      .toEqual({ ok: false, message: "Already delivered." });
    stubFetch(500, null);
    expect(await saveCoachFeedback(input))
      .toEqual({ ok: false, message: "Couldn't save (HTTP 500)." });
    offline();
    expect(await saveCoachFeedback(input))
      .toEqual({ ok: false, message: "Network error. Try again." });
    token.mockResolvedValue(null);
    const fn = stubFetch(200, {});
    expect(await saveCoachFeedback(input))
      .toEqual({ ok: false, message: "Not signed in." });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("publishArc", () => {
  const review = { sessionId: "s1", overallMessage: "Well done", feedbackItems: [{ a: 1 }] };

  it("posts every review with its own idempotency key", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("k-1-2-3-4");
    const fn = stubFetch(200, { takes_published: 3, delivered_at: "2026-09-28" });
    expect(await publishArc("a/1", [review])).toEqual({
      kind: "ok", takesPublished: 3, deliveredAt: "2026-09-28",
    });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/coach/arc/a%2F1/publish");
    expect(init).toEqual({
      method: "POST",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: JSON.stringify({ reviews: [{
        session_id: "s1", idempotency_key: "k-1-2-3-4",
        overall_message: "Well done", feedback_items: [{ a: 1 }],
      }] }),
    });
    stubFetch(200, null);
    expect(await publishArc("a", [])).toEqual({
      kind: "ok", takesPublished: 0, deliveredAt: null,
    });
  });

  it("prefers the server's words, then the code, then the status", async () => {
    stubFetch(409, { code: "TAKES_NOT_SAVED", detail: "Two takes unsaved." });
    expect(await publishArc("a", [])).toEqual({
      kind: "error", status: 409, message: "Two takes unsaved.",
    });
    stubFetch(409, { code: "TAKES_NOT_SAVED" });
    expect((await publishArc("a", [])) as { message: string })
      .toMatchObject({ message: "Save each recording's feedback first." });
    stubFetch(409, { code: "IDEAL_TEXT_NOT_APPROVED", error: "" });
    expect((await publishArc("a", [])) as { message: string })
      .toMatchObject({ message: "Verify the ideal text first." });
    stubFetch(502, null);
    expect(await publishArc("a", [])).toEqual({
      kind: "error", status: 502, message: "Publish failed (HTTP 502).",
    });
  });

  it("names the offline and signed-out cases", async () => {
    offline();
    expect(await publishArc("a", [review])).toEqual({
      kind: "error", status: 0, message: "Couldn't reach the server. Try again.",
    });
    token.mockResolvedValue(null);
    const fn = stubFetch(200, {});
    expect(await publishArc("a", [review])).toEqual({
      kind: "error", status: 401, message: "Sign in as a coach to publish.",
    });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("project deletion", () => {
  it("asks with an idempotency key and reads the open request", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("k-1-2-3-4");
    const fn = stubFetch(200, { deletion: { state: "pending", due_at: "d" } });
    expect(await requestProjectDeletion("p/1")).toEqual({
      ok: true, deletion: { state: "pending", dueAt: "d" },
    });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/projects/p%2F1/deletion-request");
    expect(init).toEqual({
      method: "POST",
      credentials: "include",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: JSON.stringify({ idempotency_key: "k-1-2-3-4" }),
    });
  });

  it("cancels with no body", async () => {
    const fn = stubFetch(200, { deletion: null });
    expect(await cancelProjectDeletion("p")).toEqual({ ok: true, deletion: null });
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    expect(init).toEqual({
      method: "DELETE", credentials: "include",
      headers: { Authorization: "Bearer tok" },
    });
    expect(init.body).toBeUndefined();
  });

  it("changes nothing when refused, offline or signed out", async () => {
    stubFetch(409, { deletion: { state: "pending" } });
    expect(await requestProjectDeletion("p")).toEqual({ ok: false, deletion: null });
    offline();
    expect(await cancelProjectDeletion("p")).toEqual({ ok: false, deletion: null });
    token.mockResolvedValue(null);
    const fn = stubFetch(200, {});
    expect(await requestProjectDeletion("p")).toEqual({ ok: false, deletion: null });
    expect(fn).not.toHaveBeenCalled();
  });
});
