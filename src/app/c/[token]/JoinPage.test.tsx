// @vitest-environment jsdom
/*
STORY    As someone who got a colleague's link in an email, I want to see who
         invites me and what I get, then join in one tap, signing in first if
         I must, so that I land in my chat with them (N308, N328, N348, N601).
OUTCOME
  O1  The page is three lines and Join, nothing under it (N601): "Tomek
      invited you", what I'll learn when the host's words are sent, "Only
      the two of you are in this chat."; the old title and lines are gone.
  O2  Signed in, Join posts to the link and opens my chat with the one who
      invited me (/chat?with=<chat>).
  O3  Signed out, Join goes to sign in and comes back to this link to
      finish (?join=1); back here, it joins without a second tap.
PROVES   O1 -> "N601-1: the page is three lines and Join, nothing under it"
         O2 -> "signed in, Join joins and opens my chat with the one who invited me"
         O3 -> "signed out, Join goes to sign in and finishes on the way back"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let token: string | null = "t";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => token) }));

import JoinPage from "./JoinPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LINK = "AbCdEfGhIjKlMnOpQrStUvWx";
let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  token = "t";
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

async function render(finish = false) {
  await act(async () => root.render(createElement(JoinPage, { token: LINK, name: "Tomek", finish })));
  await flush();
}

const joinPosts = () => fetchMock.mock.calls.filter(([url, init]) => init?.method === "POST" && String(url) === `/api/v2/chats/join/${LINK}`);

describe("the join page", () => {
  it("N601-1: the page is three lines and Join, nothing under it", async () => {
    await render();
    const main = container.querySelector("[data-join-page]")!;
    expect(main.querySelector("h1")?.textContent).toBe("Tomek invited you");
    expect(main.querySelector("[data-join-only-two]")?.textContent).toBe("Only the two of you are in this chat.");
    expect(main.querySelector("[data-join-learn]")).toBeNull();
    expect(container.querySelector("[data-join-button]")?.textContent).toBe("Join");
    // Nothing under Join.
    expect(container.querySelector("[data-join-button]")?.nextElementSibling).toBeNull();
    const text = container.textContent ?? "";
    for (const gone of [
      "asks you to join them on WillpowerLab",
      "A chat with Tomek",
      "Your own chat with Will, your speaking coach",
      "Nobody else can reach you here unless you open their link too.",
      "Opens in your browser. Nothing to install.",
    ]) {
      expect(text).not.toContain(gone);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signed in, Join joins and opens my chat with the one who invited me", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ chat: { id: "c-1" } }), { status: 200 }));
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("[data-join-button]")!.click());
    await flush();
    expect(joinPosts()).toHaveLength(1);
    expect(push).toHaveBeenCalledWith("/chat?with=c-1");
  });

  it("signed out, Join goes to sign in and finishes on the way back", async () => {
    token = null;
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("[data-join-button]")!.click());
    await flush();
    expect(joinPosts()).toHaveLength(0);
    expect(push).toHaveBeenCalledWith(`/login?redirectTo=${encodeURIComponent(`/c/${LINK}?join=1`)}`);

    // Back from signing in: it joins by itself.
    push.mockReset();
    token = "t";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ chat: { id: "c-1" } }), { status: 200 }));
    act(() => root.unmount());
    root = createRoot(container);
    await render(true);
    expect(joinPosts()).toHaveLength(1);
    expect(push).toHaveBeenCalledWith("/chat?with=c-1");
  });
});
