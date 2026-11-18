/*
STORY    As a returning speaker, I want retired presentation links to land in
         project conversations, so old bookmarks remain safe and useful.
OUTCOME  O1  The old audit/transcript and feedback paths redirect to /chat.
PROVES   O1 -> both retired route modules issue the project-chat redirect.
*/
import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn((destination: string): never => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
}));

vi.mock("next/navigation", () => ({ redirect }));

import AuditsPage from "./audits/page";
import RetiredFeedbackPage from "./recordings/[id]/feedback/page";

describe("retired presentation routes", () => {
  it("sends the old audit/transcript list to the project conversations", () => {
    expect(() => AuditsPage()).toThrow("NEXT_REDIRECT:/chat");
    expect(redirect).toHaveBeenCalledWith("/chat");
  });

  it("sends old feedback deep links to the project conversations", () => {
    redirect.mockClear();
    expect(() => RetiredFeedbackPage()).toThrow("NEXT_REDIRECT:/chat");
    expect(redirect).toHaveBeenCalledWith("/chat");
  });
});
