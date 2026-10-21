/*
STORY    As a speaker tapping a WhatsApp or email link, I want to land on my
         coach's feedback or on the review, so that the link takes me where
         it says.
OUTCOME
  O1  A feedback link (lens, or idealArc with feedback) opens the feedback;
      a link with mode=review opens the review; a bare idealArc link opens
      neither.
  O2  Tapped signed out, the coach's link goes to log in and back to the
      same link (WIL-93), once per tab; a project this device holds as a
      guest's work stays on the guest's own screens.
PROVES   O1 -> "opens the coach's feedback from the WhatsApp and email links, the review with mode=review"
         O2 -> "sends a signed-out speaker to log in and back to the coach's link, never a guest's own project"
*/
import { describe, expect, it, vi } from "vitest";

vi.mock("./page.client", () => ({ default: () => null }));

import ChatPage from "./page";
import { coachLinkLogin } from "@/lib/willab/coachLink";

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

describe("/chat coach links, signed out", () => {
  it("sends a signed-out speaker to log in and back to the coach's link, never a guest's own project", () => {
    const whatsapp = "/chat?lens=arc-1&take=take-1";
    const email = "/chat?idealArc=arc-1&feedback=1&take=take-1";
    const link = { arcId: "arc-1", mode: "feedback" as const, signedIn: false, guestArcIds: [], sentBefore: null };
    for (const path of [whatsapp, email]) {
      const href = coachLinkLogin({ ...link, path });
      expect(new URLSearchParams(href!.split("?")[1]).get("redirectTo")).toBe(path);
      expect(href!.startsWith("/login?")).toBe(true);
    }
    expect(coachLinkLogin({ ...link, path: whatsapp, signedIn: true })).toBeNull();
    expect(coachLinkLogin({ ...link, path: whatsapp, guestArcIds: [null, "arc-1"] })).toBeNull();
    expect(coachLinkLogin({ ...link, path: "/chat?lens=arc-1&mode=review", mode: "review" })).toBeNull();
    // Sent once already and back still signed out: no second trip, no loop.
    expect(coachLinkLogin({ ...link, path: whatsapp, sentBefore: whatsapp })).toBeNull();
  });
});
