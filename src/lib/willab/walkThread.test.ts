import { describe, expect, it } from "vitest";
import { stableUuid, walkStepDraft } from "./walkThread";

describe("the walk's steps in the Lounge (lock 2026-10-12, section 1)", () => {
  it("stores a step seen twice once, as the app's or the speaker's own message, with no score", () => {
    const entry = { take: "t1", arcId: "a1", key: "praise", moment: 0, attempt: null, author: "app" as const, body: "Good job" };
    const first = walkStepDraft(entry);
    expect(walkStepDraft(entry).clientId).toBe(first.clientId);
    expect(first.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.role).toBe("bot");
    expect(walkStepDraft({ ...entry, author: "speaker", key: "try" }).role).toBe("user");
    expect(walkStepDraft({ ...entry, moment: 1 }).clientId).not.toBe(first.clientId);
    expect(stableUuid("x")).not.toBe(stableUuid("y"));
    expect(JSON.stringify(first.metadata)).not.toMatch(/score|band|read/i);
  });
});
