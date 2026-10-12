/* The account-deletion contract, read in one place (founder 2026-10-05:
 * Q3a, N48.4 Q14 A, Q19 A). Pins the shapes this client accepts from the
 * Wave 3 interface — and from the receipt the backend sent before it — so a
 * change to the backend's "AS BUILT" lands here and nowhere else. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelAccountDeletion,
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

  it("a refusal or no answer records nothing", async () => {
    stubFetch(503, { code: "PURGE_REQUEST_FAILED" });
    expect(await requestAccountDeletion()).toEqual({ ok: false, pending: null });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await requestAccountDeletion()).toEqual({ ok: false, pending: null });
  });
});

describe("cancelAccountDeletion", () => {

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
});
