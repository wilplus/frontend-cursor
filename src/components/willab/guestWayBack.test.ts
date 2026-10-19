// @vitest-environment jsdom
/*
STORY    As a guest, I want the "your text is ready" bubble to reopen my text,
         so that I can find my Ideal Text again (record -> Ideal Text -> next
         Take, for a speaker with no account).
OUTCOME
  O1  The bubble the page posts for a guest is the server's ready bubble:
      same kind, words and metadata, and it carries the project (arc id).
  O2  A tap on that bubble opens the Ideal Text of that project, and never
      the coach's feedback page (which needs an account).
PROVES   O1 -> "is the server's ready bubble, carrying the project"
         O2 -> "a tap opens the Ideal Text of its project, not the feedback page"
WHY      Founder live test 2026-10-05: the bubble had no project, so it could
         not be tapped, and its tap opened the coach's feedback page.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportCard from "./ReportCard";
import { IDEAL_TEXT_READY_BODY, idealTextReadyDraft } from "./loungeReports";
import type { LoungeMessage } from "@/services/api/loungeMessages";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => null) }));
vi.mock("@/services/api/idealText", async (load) => {
  const actual = await load<typeof import("@/services/api/idealText")>();
  return {
    ...actual,
    primeIdealTextDisplay: vi.fn(),
    fetchIdealTextCore: vi.fn(async () => ({ kind: "none" })),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("a guest's \"your text is ready\" bubble (founder 2026-10-05)", () => {
  it("is the server's ready bubble, carrying the project", () => {
    expect(IDEAL_TEXT_READY_BODY).toBe("Your ideal text is ready.");
    expect(idealTextReadyDraft({ arcId: "arc-1", version: 1, topic: "Pitch" })).toEqual({
      role: "bot",
      kind: "ideal_text",
      body: "Your ideal text is ready.",
      metadata: { arc_id: "arc-1", variant: "ready", version: 1, topic: "Pitch" },
    });
  });

  it("a tap opens the Ideal Text of its project, not the feedback page", async () => {
    const message = {
      ...idealTextReadyDraft({ arcId: "arc-1", version: 1, topic: "Pitch" }),
      client_id: "guest-ready-1",
      client_created_at: "2026-10-05T09:00:00Z",
    } as LoungeMessage;
    const onOpenIdealText = vi.fn();
    const onOpenFeedback = vi.fn();
    await act(async () => {
      root.render(createElement(ReportCard, { message, onOpenIdealText, onOpenFeedback }));
    });
    const card = container.querySelector("[data-review-card]") as HTMLElement | null;
    expect(card?.textContent).toContain("Pitch");
    await act(async () => card!.click());
    expect(onOpenIdealText).toHaveBeenCalledTimes(1);
    expect(onOpenIdealText).toHaveBeenCalledWith("arc-1");
    expect(onOpenFeedback).not.toHaveBeenCalled();
  });
});
