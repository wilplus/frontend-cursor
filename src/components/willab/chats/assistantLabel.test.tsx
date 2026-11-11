// @vitest-environment jsdom
/*
STORY    As someone who invites people, I want each chat with a person to say
         whose assistant answers there, so that whoever joins knows an AI
         answers for me (backend N578 item 1, N580 items 1 and 3; behind the
         ring row chat_builder, N579 item 2). The join page is three lines
         (N601; its own story is JoinPage.test.tsx).
OUTCOME
  O1  HOST-N578-1: with the ring, a chat with a person in my list has the
      assistant's mark on the circle, named "Tomek's assistant" for a
      screen reader, and no "Tomek's assistant" beside the name (the
      founder's walk-through, 11 November 2026); without the ring (no
      `assistant` from the backend) the row is as it was, with no mark.
  O2  HOST-N601-1: the join page's read keeps only the name and the host's
      `about` words, and the page draws them as one line of what you'll
      learn, only when the backend sends them.
PROVES   O1 -> "HOST-N578-1: the list marks whose assistant answers, only with the ring, with no words by the name"
         O2 -> "HOST-N601-1: the join page says what you'll learn with the host, in their words, when sent"
WHY      Every inviter has a chat of their own, answered by "{name}'s
         assistant" (founder, 9 November 2026, N578 to N580, N586).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "@/services/api/chats";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

import ChatList from "./ChatList";
import JoinPage from "@/app/c/[token]/JoinPage";
import { joinLinkInfo } from "@/lib/chats/joinLink";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const tomek = (assistant?: string | null): Chat => ({
  id: "c-1",
  kind: "team",
  title: "Tomek",
  subtitle: "",
  last: { kind: "text", body: "Hi", created_at: "2026-11-09T10:00:00Z" },
  ...(assistant === undefined ? {} : { assistant }),
});

async function list(chats: Chat[]) {
  await act(async () => root.render(createElement(ChatList, { chats, onOpenWill: () => undefined, onOpen: () => undefined })));
}

describe("{name}'s assistant", () => {
  it("HOST-N578-1: the list marks whose assistant answers, only with the ring, with no words by the name", async () => {
    await list([{ ...tomek("Tomek's assistant"), subtitle: "Coach" }]);
    const row = container.querySelector('[data-chat-row="c-1"]')!;
    expect(row.textContent).not.toContain("assistant");
    expect(row.textContent).toContain("Coach");
    expect(row.textContent).not.toContain("·");
    expect(row.querySelector("[data-assistant-mark]")?.getAttribute("aria-label")).toBe("Tomek's assistant");

    for (const off of [undefined, null]) {
      await list([tomek(off)]);
      const plain = container.querySelector('[data-chat-row="c-1"]')!;
      expect(plain.textContent).not.toContain("assistant");
      expect(plain.querySelector("[data-assistant-mark]")).toBeNull();
    }
  });

  it("HOST-N601-1: the join page says what you'll learn with the host, in their words, when sent", async () => {
    const info = joinLinkInfo({
      name: "Lena",
      assistant: "Lena's assistant",
      will_line: "Will's chat is where you can set up a chat of your own.",
      about: ["Ask her what to use on your hair, and why.", " ", 7],
    });
    expect(info).toEqual({ name: "Lena", about: ["Ask her what to use on your hair, and why."] });
    expect(joinLinkInfo({ name: "Lena" })).toEqual({ name: "Lena", about: [] });
    expect(joinLinkInfo({ code: "NOT_FOUND" })).toBeNull();
    await act(async () => root.render(createElement(JoinPage, { token: "AbCd", name: "Lena", finish: false, about: info!.about })));
    expect(container.querySelector("[data-join-learn]")?.textContent).toBe("Ask her what to use on your hair, and why.");
    expect(container.textContent).not.toContain("Lena's assistant");
    await act(async () => root.render(createElement(JoinPage, { token: "AbCd", name: "Lena", finish: false })));
    expect(container.querySelector("[data-join-learn]")).toBeNull();
  });
});
