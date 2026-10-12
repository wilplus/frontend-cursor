import { describe, expect, it } from "vitest";
import {
  IDEAL_TEXT_UNCONFIRMED_BODY,
  idealTextUnconfirmedDraft,
} from "./loungeReports";

describe("idealTextUnconfirmedDraft", () => {
  it("is the exact Take 1 terminal card under the session identity", () => {
    const sessionId = "77777777-7777-4777-8777-777777777777";
    expect(
      idealTextUnconfirmedDraft({ sessionId, arcId: "arc-1", takeIndex: 1 }),
    ).toEqual({
      clientId: sessionId,
      role: "bot",
      kind: "ideal_text",
      body: IDEAL_TEXT_UNCONFIRMED_BODY,
      metadata: {
        variant: "ideal_text_unconfirmed",
        arc_id: "arc-1",
        take_session_id: sessionId,
        take_index: 1,
        actions: ["retry_ideal_text", "view_take_feedback"],
      },
    });
    expect(IDEAL_TEXT_UNCONFIRMED_BODY).toBe(
      "We processed your take, but couldn’t create your Ideal Text.",
    );
  });
});
