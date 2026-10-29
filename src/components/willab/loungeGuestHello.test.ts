// @vitest-environment jsdom
/*
STORY    As a visitor who has not signed in or recorded yet, I want Will to
         answer my first message with a hello and a way to record, so that
         the chat does not look broken and I know what to do next.
OUTCOME
  O1  A refused chat turn (no processing agreement yet) for a signed-out
      visitor with no project gets Will's hello and "Start your first
      recording" under it, never the lab error.
  O2  A signed-in speaker, or a real failure, still gets the lab error.
  O3  A guest who accepted chats with Will: the chat carries their guest
      identity, which holds the acceptance until they sign up.
PROVES   O1 -> "greets a signed-out visitor and points to the first recording"
         O2 -> "keeps the lab error for everyone else"
         O3 -> "sends the guest's identity with every chat turn"
WHY      Founder 2026-10-29: "answer something intelligible, but then push the
         user to actually record the first recording".
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatQueryRequestError, postChatQuery } from "@/services/api/chatQuery";
import { GUEST_OWNER_HEADER } from "@/services/api/projects";
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

describe("a guest's chat turn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("sends the guest's identity with every chat turn", async () => {
    localStorage.setItem("willab_guest_owner:v1", "guest-token");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ answer: "Hi" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await postChatQuery({ question: "hello" });
    await postChatQuery({ question: "hello", audioBlob: new Blob(["x"]) });
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(new Headers(call[1].headers).get(GUEST_OWNER_HEADER)).toBe("guest-token");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
