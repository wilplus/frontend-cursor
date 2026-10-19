/*
 * STORY    As a speaker, I want one Ideal Text bubble per Take in the Lounge,
 *          so that the thread is not cluttered with duplicates.
 * OUTCOME  (versionBubblesWithReviewCard returns the bubble ids to HIDE)
 *   O1  A version bubble whose Take already has its review card is hidden;
 *       another Take's bubble stays.
 *   O2  A version the thread holds twice keeps only the later copy.
 *   O3  Different versions with no review card all stay.
 * PROVES   O1 -> "hides the bubble of a Take that already has its review card"
 *          O2 -> "hides the earlier copy of a version the thread holds twice"
 *          O3 -> "keeps each version's own bubble"
 * WHY      Founder 2026-10-14 (walk first) and 2026-10-18 ("I can see two bubbles").
 */
import { describe, expect, it } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { versionBubblesWithReviewCard } from "./unreadFeedback";

type Item = { kind: "message"; message: LoungeMessage };

const ready = (client_id: string, version: number, at: string): Item => ({
  kind: "message",
  message: {
    client_id,
    role: "bot",
    kind: "ideal_text",
    body: "Your ideal text is ready.",
    metadata: { arc_id: "arc", variant: "ready", version },
    client_created_at: at,
  },
});

/** The review's own end card for one Take. */
const reviewCard = (client_id: string, take_index: number, at: string): Item => ({
  kind: "message",
  message: {
    client_id,
    role: "bot",
    kind: "walk_step",
    body: "",
    metadata: { arc_id: "arc", step: "end", take_index },
    client_created_at: at,
  },
});

describe("versionBubblesWithReviewCard (the bubbles to hide)", () => {
  it("hides the bubble of a Take that already has its review card", () => {
    const items = [
      ready("v1", 1, "2026-10-18T10:00:00Z"),
      ready("v2", 2, "2026-10-18T11:00:00Z"),
      reviewCard("review-2", 2, "2026-10-18T11:05:00Z"),
    ];
    expect([...versionBubblesWithReviewCard(items)]).toEqual(["v2"]);
  });

  it("hides the earlier copy of a version the thread holds twice", () => {
    const items = [
      ready("guest-copy", 1, "2026-10-18T10:00:00Z"),
      ready("server-copy", 1, "2026-10-18T10:01:00Z"),
    ];
    expect([...versionBubblesWithReviewCard(items)]).toEqual(["guest-copy"]);
  });

  it("keeps each version's own bubble", () => {
    const items = [ready("v1", 1, "2026-10-18T10:00:00Z"), ready("v2", 2, "2026-10-18T11:00:00Z")];
    expect(versionBubblesWithReviewCard(items).size).toBe(0);
  });
});
