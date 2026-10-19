import { describe, expect, it } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { versionBubblesWithReviewCard } from "./unreadFeedback";

/* ONE IDEAL TEXT BUBBLE PER TAKE (founder 2026-10-14; 2026-10-18: "I can see
   two bubbles; there should be just one"). */

const ready = (client_id: string, version: number, at: string): { kind: "message"; message: LoungeMessage } => ({
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

describe("versionBubblesWithReviewCard", () => {
  it("draws one card for a version the thread holds twice, the later one", () => {
    const items = [
      ready("guest-copy", 1, "2026-10-18T10:00:00Z"),
      ready("server-copy", 1, "2026-10-18T10:01:00Z"),
    ];
    expect([...versionBubblesWithReviewCard(items)]).toEqual(["guest-copy"]);
  });

  it("keeps each version's own card", () => {
    const items = [ready("v1", 1, "2026-10-18T10:00:00Z"), ready("v2", 2, "2026-10-18T11:00:00Z")];
    expect(versionBubblesWithReviewCard(items).size).toBe(0);
  });
});
