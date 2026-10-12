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

  it("answers false, never throws, when the post fails", async () => {
    bffFetch.mockResolvedValueOnce({ kind: "response", ok: false, status: 409, body: {} });
    await expect(postJourneyForSavedTake({ arcId: "a", takeIndex: 1 }, true)).resolves.toBe(false);
    bffFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(postJourneyForSavedTake({ arcId: "a", takeIndex: 1 }, true)).resolves.toBe(false);
  });
});

