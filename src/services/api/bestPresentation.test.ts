import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBestPresentation,
  fetchArcBreakthroughs,
} from "./bestPresentation";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "tok",
}));

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }))
  );
}

const progress = { takes_done: 3, takes_target: 3, takes_remaining: 0 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchBestPresentation — preparing / ready state machine", () => {
  it("402 → null (payment gate removed; the ideal text is free)", async () => {
    mockFetch(402, { code: "PAYMENT_REQUIRED" });
    expect(await fetchBestPresentation("a")).toBeNull();
  });

  it("200 ready + coach_finalized:false → preparing (coach not done)", async () => {
    mockFetch(200, {
      arc_id: "a",
      ready: true,
      coach_finalized: false,
      progress,
      slides: [{ index: 0, title: "t", text: "" }],
    });
    expect(await fetchBestPresentation("a")).toEqual({ preparing: true });
  });

  it("200 ready + coach_finalized:true → the real result (not preparing)", async () => {
    mockFetch(200, {
      arc_id: "a",
      ready: true,
      coach_finalized: true,
      progress,
      slides: [{ index: 0, title: "t", text: "Corrected line." }],
    });
    const r = await fetchBestPresentation("a");
    expect(r).not.toBeNull();
    expect(r && "preparing" in r).toBe(false);
    expect(r && "ready" in r && r.ready).toBe(true);
  });

  it("200 not-ready (<3 takes, coach_finalized:false) → NOT preparing — the progress state", async () => {
    // Guarded on `ready`: an arc still owing takes must show "need N more takes",
    // never "preparing" (the coach can't finalize what isn't recorded yet).
    mockFetch(200, {
      arc_id: "a",
      ready: false,
      coach_finalized: false,
      progress: { takes_done: 1, takes_target: 3, takes_remaining: 2 },
      slides: [],
    });
    const r = await fetchBestPresentation("a");
    expect(r && "preparing" in r).toBe(false);
    expect(r && "ready" in r && r.ready).toBe(false);
  });

  it("absent coach_finalized → treated as finalized (older payload serves content)", async () => {
    mockFetch(200, { arc_id: "a", ready: true, progress, slides: [] });
    const r = await fetchBestPresentation("a");
    expect(r && "preparing" in r).toBe(false);
  });
});

describe("fetchArcBreakthroughs — free deliverable", () => {
  it("402 → null (payment gate removed)", async () => {
    mockFetch(402, { code: "PAYMENT_REQUIRED" });
    expect(await fetchArcBreakthroughs("a")).toBeNull();
  });

  it("200 → the breakthroughs list", async () => {
    mockFetch(200, {
      arc_id: "a",
      count: 1,
      breakthroughs: [{ snippet_id: "s1", transcript: "The line.", note: "why" }],
    });
    const r = await fetchArcBreakthroughs("a");
    expect(r && "breakthroughs" in r && r.breakthroughs).toHaveLength(1);
  });
});
