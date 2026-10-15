import { describe, expect, it, vi } from "vitest";

vi.mock("./page.client", () => ({ default: () => null }));

import ChatPage from "./page";

const modeOf = (searchParams: Record<string, string>) =>
  (ChatPage({ searchParams }).props.children.props as { idealTextMode: string | null }).idealTextMode;

describe("/chat deep links to the lens", () => {
  it("opens the coach's feedback from the WhatsApp and email links, the review with mode=review", () => {
    expect(modeOf({ lens: "arc-1" })).toBe("feedback");
    expect(modeOf({ idealArc: "arc-1", feedback: "1" })).toBe("feedback");
    expect(modeOf({ lens: "arc-1", mode: "review" })).toBe("review");
    expect(modeOf({ idealArc: "arc-1" })).toBeNull();
  });
});
