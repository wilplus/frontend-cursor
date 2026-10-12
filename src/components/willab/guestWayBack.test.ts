/* A GUEST'S WAY BACK TO THE TEXT (founder live test 2026-10-05). The
   recording bubble was saved without its project on a new deck, so it could
   not be tapped; and its tap opened the coach's feedback page, which needs an
   account. A guest gets no "your text is ready" bubble, so this bubble is the
   way back. Source pins: the Lounge and the Lab are too large to mount here. */
import { describe, expect, it } from "vitest";

describe("a guest's \"your text is ready\" bubble (founder 2026-10-05)", () => {
  it("is the server's ready bubble: same kind, words and metadata", async () => {
    const { idealTextReadyDraft, IDEAL_TEXT_READY_BODY } = await import("./loungeReports");
    expect(IDEAL_TEXT_READY_BODY).toBe("Your ideal text is ready.");
    expect(idealTextReadyDraft({ arcId: "arc-1", version: 1, topic: "Pitch" })).toEqual({
      role: "bot",
      kind: "ideal_text",
      body: "Your ideal text is ready.",
      metadata: { arc_id: "arc-1", variant: "ready", version: 1, topic: "Pitch" },
    });
  });

});
