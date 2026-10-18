import { describe, expect, it, vi } from "vitest";

vi.mock("./page.client", () => ({ default: () => null }));

import ChatPage from "./page";

const propsOf = (searchParams: Record<string, string>) =>
  ChatPage({ searchParams }).props.children.props as {
    idealTextArcId: string | null;
    idealTextMode: string | null;
  };
const modeOf = (searchParams: Record<string, string>) => propsOf(searchParams).idealTextMode;

// A project id as the server mints them (UUID); the links carry these.
const ARC = "3f2c1b7a-9d4e-4c6b-8a1f-2e5d7c9b0a13";

describe("/chat deep links to the lens", () => {
  it("opens the coach's feedback from the WhatsApp and email links, the review with mode=review", () => {
    expect(modeOf({ lens: ARC })).toBe("feedback");
    expect(modeOf({ idealArc: ARC, feedback: "1" })).toBe("feedback");
    expect(modeOf({ lens: ARC, mode: "review" })).toBe("review");
    expect(modeOf({ idealArc: ARC })).toBeNull();
  });

  it("a link whose id is not a project id opens the chat and nothing more", () => {
    /* FOUNDER 2026-10-18: `/chat?lens=…&mode=review` — an ellipsis where
       the id should be — opened the Ideal Text on a project the server could
       never have, and its waiting screen asked for that document for 27
       minutes. Such a link is just the chat. */
    expect(propsOf({ lens: "…", mode: "review" })).toMatchObject({
      idealTextArcId: null,
      idealTextMode: null,
    });
    expect(propsOf({ idealArc: "arc-1" }).idealTextArcId).toBeNull();
  });
});
