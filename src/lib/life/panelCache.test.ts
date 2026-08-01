import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPanelResource,
  invalidatePanelData,
  prefetchPanelResource,
  readPanelCache,
} from "./panelCache";

beforeEach(() => invalidatePanelData());

describe("panelCache", () => {
  it("serves the second read from memory, which is the whole point", async () => {
    const load = vi.fn().mockResolvedValue(["a"]);
    await fetchPanelResource("k", load);
    expect(readPanelCache("k")).toEqual(["a"]);
    // The view can render this synchronously on mount, so no spinner.
    await fetchPanelResource("k", load);
    expect(load).toHaveBeenCalledTimes(2); // still revalidates
  });

  it("shares one request between a prefetch and the mount that follows", async () => {
    // Hovering a pill then tapping it must not fetch twice.
    let resolve!: (v: unknown) => void;
    const load = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    prefetchPanelResource("k", load);
    const mount = fetchPanelResource("k", load);
    resolve(["x"]);
    await mount;
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejection", async () => {
    const load = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(fetchPanelResource("k", load)).rejects.toThrow();
    // An error is a moment, not a value: caching it would leave the view
    // broken until something else invalidated.
    expect(readPanelCache("k")).toBeUndefined();
  });

  it("swallows a failed prefetch", async () => {
    // The user has not asked for anything yet, so nothing may surface.
    const load = vi.fn().mockRejectedValue(new Error("boom"));
    expect(() => prefetchPanelResource("k", load)).not.toThrow();
    await Promise.resolve();
  });

  it("does not let a read started BEFORE a write repopulate the cache", async () => {
    // The bug this exists for: a list read is in flight, the user deletes a
    // row, the read lands and puts the deleted row straight back.
    let resolve!: (v: unknown) => void;
    const load = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const inFlight = fetchPanelResource("k", load);
    invalidatePanelData(); // the write
    resolve(["stale row"]);
    await inFlight;
    expect(readPanelCache("k")).toBeUndefined();
  });

  it("clears everything on a write, not just the key that was written", async () => {
    // One document yields goals AND habits AND distractions, so a per-key
    // invalidation would leave some view quietly short.
    await fetchPanelResource("goals", vi.fn().mockResolvedValue([1]));
    await fetchPanelResource("items:habit", vi.fn().mockResolvedValue([2]));
    invalidatePanelData();
    expect(readPanelCache("goals")).toBeUndefined();
    expect(readPanelCache("items:habit")).toBeUndefined();
  });
});
