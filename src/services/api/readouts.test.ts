/*
STORY    As a signed-in speaker, I want the background status check to be
         shared while it is relevant, but never reused by another account.
OUTCOME
  O1  Concurrent status checks for one owner make one request and reuse the
      successful result until an explicit state refresh.
  O2  A different owner gets a fresh read, even if the previous owner's result
      is still in memory.
PROVES   O1 -> "one status read per owner/state, including concurrent callers"
         O2 -> "readout rows never cross an auth switch"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const bff = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: bff.fetch }));

import {
  __resetReadoutStatusCacheForTests,
  fetchReadoutsForStatus,
} from "./readouts";

const response = (sessionId: string) => ({
  kind: "response" as const,
  ok: true,
  status: 200,
  body: {
    readouts: [{ session_id: sessionId, created_at: "2026-11-17", topic: "Talk", state: "review_pending" }],
  },
});

beforeEach(() => {
  __resetReadoutStatusCacheForTests();
  bff.fetch.mockReset();
});

describe("owner-scoped home status read", () => {
  it("shares concurrent work, reuses one state result, and refreshes explicitly", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    bff.fetch.mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve; }),
    );

    const first = fetchReadoutsForStatus("maria");
    const second = fetchReadoutsForStatus("maria");
    expect(bff.fetch).toHaveBeenCalledTimes(1);

    release(response("maria-take"));
    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(second).resolves.toMatchObject({ rows: [{ sessionId: "maria-take" }] });
    await expect(fetchReadoutsForStatus("maria")).resolves.toMatchObject({ rows: [{ sessionId: "maria-take" }] });
    expect(bff.fetch).toHaveBeenCalledTimes(1);

    bff.fetch.mockResolvedValueOnce(response("maria-next"));
    await expect(fetchReadoutsForStatus("maria", { refresh: true })).resolves.toMatchObject({
      rows: [{ sessionId: "maria-next" }],
    });
    expect(bff.fetch).toHaveBeenCalledTimes(2);
  });

  it("starts a fresh read after the signed-in owner changes", async () => {
    bff.fetch
      .mockResolvedValueOnce(response("maria-take"))
      .mockResolvedValueOnce(response("noa-take"));

    await expect(fetchReadoutsForStatus("maria")).resolves.toMatchObject({
      rows: [{ sessionId: "maria-take" }],
    });
    await expect(fetchReadoutsForStatus("noa")).resolves.toMatchObject({
      rows: [{ sessionId: "noa-take" }],
    });
    expect(bff.fetch).toHaveBeenCalledTimes(2);
  });

  it("allows an explicit state refresh to recover after a failed background read", async () => {
    bff.fetch
      .mockResolvedValueOnce({ kind: "network" })
      .mockResolvedValueOnce(response("maria-recovered"));

    await expect(fetchReadoutsForStatus("maria")).resolves.toMatchObject({ ok: false });
    await expect(fetchReadoutsForStatus("maria", { refresh: true })).resolves.toMatchObject({
      rows: [{ sessionId: "maria-recovered" }],
      ok: true,
    });
    expect(bff.fetch).toHaveBeenCalledTimes(2);
  });
});
