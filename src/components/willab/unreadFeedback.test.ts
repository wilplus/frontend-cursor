import { describe, expect, it } from "vitest";
import { repeatedWalkStepIds } from "./unreadFeedback";
import type { LoungeMessage } from "@/services/api/loungeMessages";

/** A walk step in the chat, as the walk posts it. */
function step(id: string, meta: Record<string, unknown>, body = "Exercise\nSay it slower."): { kind: string; message: LoungeMessage } {
  return {
    kind: "message",
    message: {
      client_id: id,
      client_created_at: id,
      role: "bot",
      kind: "walk_step",
      body,
      metadata: { take_session_id: "take-1", author: "app", ...meta },
    } as LoungeMessage,
  };
}

describe("one bubble per walk step in the Lounge (founder 2026-10-18)", () => {
  it("hides the same Exercise bubble posted again under another moment number", () => {
    const items = [
      step("a", { step: "exVideo", moment: 2, part_id: "p1" }),
      step("b", { step: "exVideo", moment: 0, part_id: "p1" }),
    ];
    expect([...repeatedWalkStepIds(items)]).toEqual(["b"]);
  });

  it("keeps bubbles that differ in paragraph, words or Take", () => {
    const items = [
      step("a", { step: "exVideo", moment: 0, part_id: "p1" }),
      step("b", { step: "exVideo", moment: 1, part_id: "p2" }),
      step("c", { step: "exVideo", moment: 0, part_id: "p1" }, "Exercise\nOther words."),
      step("d", { step: "exVideo", moment: 0, part_id: "p1", take_session_id: "take-2" }),
      step("e", { step: "coachnote" }),
    ];
    expect(repeatedWalkStepIds(items).size).toBe(0);
  });
});
