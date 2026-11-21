/*
STORY    As a speaker finishing project feedback, I want the close action to
         reveal Ideal Text in the same project flow, so the handoff stays local.
OUTCOME  O1  Project-flow close reveals Ideal Text; other close paths return normally.
PROVES   O1 -> the close policy selects the correct callback for each mode.
*/
import { describe, expect, it, vi } from "vitest";
import { walkCloseFor } from "./IdealTextOverlay";

describe("project Feedback Walk closing", () => {
  it("reveals the Ideal Text in the project flow", () => {
    const close = vi.fn();
    const reveal = vi.fn();

    walkCloseFor(true, close, reveal)();

    expect(reveal).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps the normal return-to-chat behavior elsewhere", () => {
    const close = vi.fn();
    const reveal = vi.fn();

    walkCloseFor(false, close, reveal)();

    expect(close).toHaveBeenCalledOnce();
    expect(reveal).not.toHaveBeenCalled();
  });
});
