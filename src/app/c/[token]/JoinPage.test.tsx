// @vitest-environment jsdom
/*
STORY    As someone who got a colleague's link in an email, I want to see who
         invites me and what I get, then join in one tap, signing in first if
         I must, so that I land in my chat with them (N308, N328, N335, N348).
OUTCOME
  O1  The page names who invites me and what I get, in the signed words,
      with one button, Join (N307, N310, N335).
  O2  Signed in, Join posts to the link and opens my chat with the one who
      invited me (/chat?with=<chat>).
  O3  Signed out, Join goes to sign in and comes back to this link to
      finish (?join=1); back here, it joins without a second tap.
PROVES   O1 -> "the page names who invites me and what I get"
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
  it("the page names who invites me and what I get", async () => {
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("Tomek asks you to join them on WillpowerLab");
    expect(text).toContain("A chat with Tomek");
    expect(text).toContain("Your own chat with Will, your speaking coach");
    expect(text).toContain("Nobody else can reach you here unless you open their link too.");
    expect(text).toContain("Opens in your browser. Nothing to install.");
    expect(container.querySelector("[data-join-button]")?.textContent).toBe("Join");
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
