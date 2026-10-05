/* The account-deletion contract, read in one place (founder 2026-10-05:
 * Q3a, N48.4 Q14 A, Q19 A). Pins the shapes this client accepts from the
 * Wave 3 interface — and from the receipt the backend sent before it — so a
 * change to the backend's "AS BUILT" lands here and nowhere else. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelAccountDeletion,
  mapPendingDeletion,
  requestAccountDeletion,
} from "./accountDeletion";

const PURGE = "0f8fad5b-d9cb-469f-a165-70867728950e";

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) =>
    new Response(body === undefined ? "" : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mapPendingDeletion", () => {
  it("reads the contract's pending_deletion", () => {
    expect(mapPendingDeletion({
      purge_id: PURGE, kind: "project", project_id: "p-1",
      completes_after: "2026-10-12T17:00:00Z", cancellable: true,
    })).toEqual({
      purgeId: PURGE, kind: "project", projectId: "p-1",
      completesAfter: "2026-10-12T17:00:00Z", cancellable: true,
    });
  });

  it("reads the pre-Q14 receipt as an account deletion nobody can cancel", () => {
    expect(mapPendingDeletion({ purge_request_id: PURGE, state: "requested" }, "account"))
      .toEqual({
        purgeId: PURGE, kind: "account", projectId: null,
        completesAfter: null, cancellable: false,
      });
  });

  it("a missing word on the cancel is a no", () => {
    for (const cancellable of [undefined, "true", 1, null]) {
      expect(mapPendingDeletion({ purge_id: PURGE, kind: "account", cancellable })?.cancellable)
        .toBe(false);
    }
  });

  it("is null for nothing, a closed request, or one it cannot name", () => {
    expect(mapPendingDeletion(null)).toBeNull();
    expect(mapPendingDeletion([])).toBeNull();
    expect(mapPendingDeletion({ kind: "account" })).toBeNull();
    expect(mapPendingDeletion({ purge_id: PURGE })).toBeNull();
    expect(mapPendingDeletion({ purge_id: PURGE, kind: "everything" })).toBeNull();
    for (const state of ["cancelled", "done", "completed"]) {
      expect(mapPendingDeletion({ purge_id: PURGE, kind: "account", state })).toBeNull();
    }
  });
});

describe("requestAccountDeletion", () => {
  it("sends one account_deletion request and reads what came back", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("1-2-3-4-5");
    const fn = stubFetch(202, {
      purge_id: PURGE, state: "requested",
      completes_after: "2026-10-12T17:00:00Z", cancellable: true,
    });
    expect(await requestAccountDeletion()).toEqual({
      ok: true,
      pending: {
        purgeId: PURGE, kind: "account", projectId: null,
        completesAfter: "2026-10-12T17:00:00Z", cancellable: true,
      },
    });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/processing-authorization/terminate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      trigger_kind: "account_deletion",
      idempotency_key: "account-deletion:1-2-3-4-5",
    });
  });

  it("is recorded even when the answer says nothing more", async () => {
    stubFetch(202, undefined);
    expect(await requestAccountDeletion()).toEqual({ ok: true, pending: null });
  });

  it("a refusal or no answer records nothing", async () => {
    stubFetch(503, { code: "PURGE_REQUEST_FAILED" });
    expect(await requestAccountDeletion()).toEqual({ ok: false, pending: null });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await requestAccountDeletion()).toEqual({ ok: false, pending: null });
  });
});

describe("cancelAccountDeletion", () => {
  it("posts to the purge's own cancel route", async () => {
    const fn = stubFetch(200, { purge_id: PURGE, state: "cancelled" });
    expect(await cancelAccountDeletion(PURGE)).toEqual({ kind: "cancelled" });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v2/processing-authorization/deletion/${PURGE}/cancel`);
    expect(init.method).toBe("POST");
  });

  it("a 409 is the backend's no, with its code", async () => {
    stubFetch(409, { code: "DELETION_WINDOW_CLOSED" });
    expect(await cancelAccountDeletion(PURGE)).toEqual({
      kind: "refused", code: "DELETION_WINDOW_CLOSED",
    });
    stubFetch(409, undefined);
    expect(await cancelAccountDeletion(PURGE)).toEqual({
      kind: "refused", code: "DELETION_NOT_CANCELLABLE",
    });
  });

  it("anything else is a failure worth retrying", async () => {
    stubFetch(503, {});
    expect(await cancelAccountDeletion(PURGE)).toEqual({ kind: "failed" });
    stubFetch(404, { code: "NOT_FOUND" });
    expect(await cancelAccountDeletion(PURGE)).toEqual({ kind: "failed" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await cancelAccountDeletion(PURGE)).toEqual({ kind: "failed" });
  });

  it("an id cannot leave its segment", async () => {
    const fn = stubFetch(200, {});
    await cancelAccountDeletion("../terminate");
    expect(fn.mock.calls[0][0]).toBe(
      "/api/v2/processing-authorization/deletion/..%2Fterminate/cancel",
    );
  });
});
