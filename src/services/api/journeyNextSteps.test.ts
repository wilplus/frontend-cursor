/* The Lounge's Take 1–3 journey messages are posted when the Take is saved,
   for a signed-in speaker only (founder 2026-10-08, Q-IT643 A). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const bffFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));

import { postJourneyForSavedTake } from "./journeyNextSteps";

beforeEach(() => {
  bffFetch.mockReset();
  bffFetch.mockResolvedValue({ kind: "response", ok: true, status: 200, body: {} });
});

describe("postJourneyForSavedTake", () => {
  it("posts the project's next steps for a signed-in speaker's Take 1, 2 and 3", async () => {
    for (const takeIndex of [1, 2, 3]) {
      await expect(postJourneyForSavedTake({ arcId: "arc 1", takeIndex }, true)).resolves.toBe(true);
    }
    expect(bffFetch).toHaveBeenCalledTimes(3);
    expect(bffFetch).toHaveBeenCalledWith(
      "/api/v2/explore/arc/arc%201/journey/next-steps",
      { method: "POST", cache: "no-store" },
    );
  });

  it("lets the backend count the Take when the marker does not know it", async () => {
    await expect(postJourneyForSavedTake({ arcId: "a", takeIndex: null }, true)).resolves.toBe(true);
    expect(bffFetch).toHaveBeenCalledTimes(1);
  });

  it("asks nothing past Take 3, for a guest, before sign-in is known, or without a project", async () => {
    await postJourneyForSavedTake({ arcId: "a", takeIndex: 4 }, true);
    await postJourneyForSavedTake({ arcId: "a", takeIndex: 0 }, true);
    await postJourneyForSavedTake({ arcId: "a", takeIndex: 1 }, false);
    await postJourneyForSavedTake({ arcId: "a", takeIndex: 1 }, null);
    await postJourneyForSavedTake({ arcId: null, takeIndex: 1 }, true);
    expect(bffFetch).not.toHaveBeenCalled();
  });

  it("answers false, never throws, when the post fails", async () => {
    bffFetch.mockResolvedValueOnce({ kind: "response", ok: false, status: 409, body: {} });
    await expect(postJourneyForSavedTake({ arcId: "a", takeIndex: 1 }, true)).resolves.toBe(false);
    bffFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(postJourneyForSavedTake({ arcId: "a", takeIndex: 1 }, true)).resolves.toBe(false);
  });
});

