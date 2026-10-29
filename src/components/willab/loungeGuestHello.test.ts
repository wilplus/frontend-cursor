/*
STORY    As a visitor who has not signed in or recorded yet, I want Will to
         answer my first message with a hello and a way to record, so that
         the chat does not look broken and I know what to do next.
OUTCOME
  O1  A refused chat turn (no processing agreement yet) for a signed-out
      visitor with no project gets Will's hello and "Start your first
      recording" under it, never the lab error.
  O2  A signed-in speaker, or a real failure, still gets the lab error.
PROVES   O1 -> "greets a signed-out visitor and points to the first recording"
         O2 -> "keeps the lab error for everyone else"
WHY      Founder 2026-10-29: "answer something intelligible, but then push the
         user to actually record the first recording".
*/
import { describe, expect, it } from "vitest";
import { ChatQueryRequestError } from "@/services/api/chatQuery";
import { FLOW_COPY } from "./flowCopy";
import { chatFailureReply } from "./Lounge";
import { CHIP_LABEL, coerceSuggestedAction } from "./loungePrompts";

const LAB_ERROR = "I'm having trouble reaching the lab right now. Give it another try in a moment.";

describe("Will's reply when the chat is refused", () => {
  it("greets a signed-out visitor and points to the first recording", () => {
    for (const status of [401, 403]) {
      const reply = chatFailureReply(new ChatQueryRequestError(status), false, false);
      expect(reply.body).toBe(FLOW_COPY.firstTakeHello);
      const chip = coerceSuggestedAction(reply.metadata?.suggested_action);
      expect(chip && CHIP_LABEL[chip]).toBe("Start your first recording");
    }
  });

  it("keeps the lab error for everyone else", () => {
    expect(chatFailureReply(new ChatQueryRequestError(401), true, false).body).toBe(LAB_ERROR);
    expect(chatFailureReply(new ChatQueryRequestError(403), false, true).body).toBe(LAB_ERROR);
    expect(chatFailureReply(new ChatQueryRequestError(500), false, false).body).toBe(LAB_ERROR);
    expect(chatFailureReply(new TypeError("offline"), false, false).body).toBe(LAB_ERROR);
  });
});
