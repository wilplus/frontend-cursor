// @vitest-environment jsdom
/*
STORY    As a coach, I want every moment a speaker meets in their chat to
         reach my queue, so that no speaker's Take goes unheard (backend N691
         item 1; the promise the Feedback walk kept before it moved into the
         chat).
OUTCOME  O1  A coach reply that shows a moment records it as opened, once,
             with what it showed beside it.
         O2  The speaker's own message that cites a moment records nothing.
         O3  A record that failed is tried again the next time it shows.
PROVES   O1 -> "a moment shown in the chat reaches the coach once"
         O2 -> "the speaker's own message records nothing"
         O3 -> "a failed record is tried again"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { forgetMomentsReached } from "@/lib/willab/momentReached";
import TakeConversationMessage from "./chats/TakeConversationMessage";

const report = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/momentEvents", () => ({ reportMomentEvent: report }));
vi.mock("./CoachMoment", () => ({ default: () => <span data-moment="" /> }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  forgetMomentsReached();
  report.mockReset().mockResolvedValue({ kind: "recorded", followUp: "none" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const moment = { arc_id: "project", take_session_id: "take-1", snippet_id: "moment-1", practise: true };
const reply = (over: Partial<LoungeMessage> = {}): LoungeMessage => ({
  client_id: "reply-1", client_created_at: "2026-11-24T10:00:00Z", role: "bot", kind: "text",
  body: "This part landed. Try it once more, slower.", metadata: { coach_moment: moment }, ...over,
} as LoungeMessage);

const show = async (message: LoungeMessage) => {
  await act(async () => root.render(<TakeConversationMessage message={message} />));
};

it("a moment shown in the chat reaches the coach once", async () => {
  await show(reply());
  await show(reply({ client_id: "reply-2" }));
  expect(report).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith("moment-1", "opened", ["exercise"]);
});

it("the speaker's own message records nothing", async () => {
  await show(reply({ role: "user", metadata: { snippet_id: "moment-1" } }));
  expect(report).not.toHaveBeenCalled();
});

it("a failed record is tried again", async () => {
  report.mockResolvedValueOnce({ kind: "failed" });
  await show(reply());
  act(() => root.unmount());
  root = createRoot(host);
  await show(reply());
  expect(report).toHaveBeenCalledTimes(2);
});
