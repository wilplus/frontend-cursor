// @vitest-environment jsdom
/*
STORY    As a speaker who opens my coach's WhatsApp or email link while
         signed in to my other account, I want to be told so and taken to
         log in with the right one, so that I reach my coach's feedback
         instead of a wait that never ends.
OUTCOME
  O1  The server's "arc not found" (the project is not in this account)
      reads as another account's link, never as a text still being built;
      any other 404 still reads as pending.
  O2  "Log in with that account" signs out and goes to log in, which comes
      back to the same link.
PROVES   O1 -> "another account's project is said, not waited on"
         O2 -> "the button signs out and goes to log in, back to the link"
WHY      Founder 2026-10-21 (WIL-93): the coach's link opened in the other
         of two signed-in accounts sat on "Building your Ideal Text" at 99%.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

import { fetchIdealText } from "@/services/api/idealText";
import OtherAccountLink, { OTHER_ACCOUNT_COPY } from "./OtherAccountLink";

afterEach(() => {
  vi.unstubAllGlobals();
  signOut.mockClear();
});

const serverSays = (status: number, body: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

describe("the coach's link in another account (WIL-93)", () => {
  it("another account's project is said, not waited on", async () => {
    serverSays(404, { code: "NOT_FOUND", error: "arc not found" });
    expect(await fetchIdealText("arc-1")).toEqual({ kind: "notYours" });
    serverSays(404, {});
    expect(await fetchIdealText("arc-1")).toEqual({ kind: "pending" });
  });

  it("the button signs out and goes to log in, back to the link", async () => {
    const link = "/chat?lens=arc-1&take=take-1";
    window.history.replaceState({}, "", link);
    const go = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    act(() => root.render(createElement(OtherAccountLink, { go })));
    expect(container.textContent).toContain(OTHER_ACCOUNT_COPY.title);
    const button = container.querySelector("button")!;
    expect(button.textContent).toBe(OTHER_ACCOUNT_COPY.logIn);
    await act(async () => button.click());
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(`/login?redirectTo=${encodeURIComponent(link)}`);
    act(() => root.unmount());
    container.remove();
  });
});
