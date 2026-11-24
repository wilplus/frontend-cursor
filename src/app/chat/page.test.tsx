/*
STORY    As a speaker tapping my coach's WhatsApp, push or email link, I want
         to land in my chat on the coach's word for that Take, so that the
         link takes me where it says (backend N691 item 3).
OUTCOME
  O1  `?take=` names the Take and asks for the coach's bubble; `session` is
      its old name; the coach's old `lens` and `idealArc` links still ask
      for the coach's bubble (their Take, else the newest); a plain open
      asks for nothing.
  O2  Every old parameter leaves the address; only `take` stays.
  O3  Tapped signed out, the coach's link goes to log in and back to the
      same link (WIL-93), once per tab.
PROVES   O1 -> "reads the one link and the links already sent"
         O2 -> "keeps only take in the address"
         O3 -> "sends a signed-out speaker to log in and back to the coach's link"
*/
import { describe, expect, it, vi } from "vitest";

vi.mock("./page.client", () => ({ default: () => null }));

import ChatPage from "./page";
import { coachLinkLogin } from "@/lib/willab/coachLink";
import { chatLinkHref } from "@/lib/willab/chatLink";

const linkOf = (searchParams: Record<string, string>) =>
  ChatPage({ searchParams }).props.children.props as { take: string | null; coach: boolean };

describe("/chat's one link", () => {
  it("reads the one link and the links already sent", () => {
    expect(linkOf({ take: "take-1" })).toEqual({ take: "take-1", coach: true });
    expect(linkOf({ session: "take-1" })).toEqual({ take: "take-1", coach: true });
    expect(linkOf({ lens: "arc-1", take: "take-1" })).toEqual({ take: "take-1", coach: true });
    expect(linkOf({ idealArc: "arc-1", feedback: "1" })).toEqual({ take: null, coach: true });
    expect(linkOf({})).toEqual({ take: null, coach: false });
    expect(linkOf({ insight: "take-1" })).toEqual({ take: null, coach: false });
  });

  it("keeps only take in the address", () => {
    const at = (path: string) => chatLinkHref(`https://www.willpowerlab.com${path}`);
    expect(at("/chat?idealArc=arc-1&feedback=1&take=take-1")).toBe("/chat?take=take-1");
    expect(at("/chat?lens=arc-1&mode=review")).toBe("/chat");
    expect(at("/chat?session=take-1")).toBe("/chat?take=take-1");
    expect(at("/chat?with=thread-1&arc=arc-1")).toBe("/chat?with=thread-1");
  });
});

describe("/chat coach links, signed out", () => {
  it("sends a signed-out speaker to log in and back to the coach's link", () => {
    const path = "/chat?take=take-1";
    const link = { coach: true, signedIn: false, sentBefore: null };
    const href = coachLinkLogin({ ...link, path });
    expect(href!.startsWith("/login?")).toBe(true);
    expect(new URLSearchParams(href!.split("?")[1]).get("redirectTo")).toBe(path);
    expect(coachLinkLogin({ ...link, path, signedIn: true })).toBeNull();
    expect(coachLinkLogin({ ...link, path, coach: false })).toBeNull();
    // Sent once already and back still signed out: no second trip, no loop.
    expect(coachLinkLogin({ ...link, path, sentBefore: path })).toBeNull();
  });
});
