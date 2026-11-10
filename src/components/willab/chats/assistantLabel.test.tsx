// @vitest-environment jsdom
/*
STORY    As someone who invites people, I want each chat with a person to say
         whose assistant answers there, and my link's join page to name my
         assistant and what Will's chat is for, so that whoever joins knows
         an AI answers for me (backend N578 item 1, N580 items 1 and 3, N586
         item 2; behind the ring row chat_builder, N579 item 2).
OUTCOME
  O1  HOST-N578-1: with the ring, a chat with a person in my list says
      "Tomek's assistant" under the name, with the assistant's mark on the
      circle; without the ring (no `assistant` from the backend) the row is
      as it was, with no mark.
  O2  HOST-N586-2: the join page of a tester's link says "Tomek's
      assistant" and Will's line in the backend's words ("Will's chat is
      where you can set up a chat of your own."); anyone else's link keeps
      "Your own chat with Will, your speaking coach" and no assistant.
  O3  HOST-N586-2: the join page's read takes `assistant` and `will_line`
      from the backend only when it sends them.
  O4  HOST-N586-1: the join page draws the host's `about` lines (who they
      are, what you can learn with them) as the chat's top does, only when
      the backend sends them.
PROVES   O1 -> "HOST-N578-1: the list says whose assistant answers, only with the ring"
         O2 -> "HOST-N586-2: a tester's join page names the assistant and Will's chat"
         O3 -> "HOST-N586-2: the join page's read keeps the two lines only when sent"
         O4 -> "HOST-N586-1: the join page says who the host is and what you can learn with them, in their words, when sent"
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
  it("HOST-N578-1: the list says whose assistant answers, only with the ring", async () => {
    await list([tomek("Tomek's assistant")]);
    const row = container.querySelector('[data-chat-row="c-1"]')!;
    expect(row.textContent).toContain("Tomek's assistant");
    expect(row.querySelector("[data-assistant-mark]")?.getAttribute("aria-label")).toBe("Tomek's assistant");

    for (const off of [undefined, null]) {
      await list([tomek(off)]);
      const plain = container.querySelector('[data-chat-row="c-1"]')!;
      expect(plain.textContent).not.toContain("assistant");
      expect(plain.querySelector("[data-assistant-mark]")).toBeNull();
    }
  });

  it("HOST-N586-2: a tester's join page names the assistant and Will's chat", async () => {
    const page = (props: { assistant?: string | null; willLine?: string | null }) =>
      act(async () => root.render(createElement(JoinPage, { token: "AbCd", name: "Tomek", finish: false, ...props })));

    await page({ assistant: "Tomek's assistant", willLine: "Will's chat is where you can set up a chat of your own." });
    let text = container.textContent ?? "";
    expect(container.querySelector("[data-join-assistant]")?.textContent).toBe("Tomek's assistant");
    expect(container.querySelector("[data-join-will-line]")?.textContent).toBe("Will's chat is where you can set up a chat of your own.");
    expect(text).not.toContain("Your own chat with Will, your speaking coach");

    await page({});
    text = container.textContent ?? "";
    expect(container.querySelector("[data-join-assistant]")).toBeNull();
    expect(text).toContain("Your own chat with Will, your speaking coach");
  });

  it("HOST-N586-2: the join page's read keeps the two lines only when sent", async () => {
    expect(joinLinkInfo({ name: "Tomek", assistant: "Tomek's assistant", will_line: "Will's chat is where you can set up a chat of your own." })).toEqual({
      name: "Tomek",
      assistant: "Tomek's assistant",
      willLine: "Will's chat is where you can set up a chat of your own.",
      about: [],
    });
    expect(joinLinkInfo({ name: "Tomek" })).toEqual({ name: "Tomek", assistant: null, willLine: null, about: [] });
    expect(joinLinkInfo({ code: "NOT_FOUND" })).toBeNull();
  });

  it("HOST-N586-1: the join page says who the host is and what you can learn with them, in their words, when sent", async () => {
    const info = joinLinkInfo({ name: "Tomek", about: ["Tomek coaches gymnastics.", " ", 7, "In Tomek's chat you can practise your first handstand."] });
    expect(info?.about).toEqual(["Tomek coaches gymnastics.", "In Tomek's chat you can practise your first handstand."]);
    await act(async () => root.render(createElement(JoinPage, { token: "AbCd", name: "Tomek", finish: false, about: info!.about })));
    expect(container.querySelector("[data-host-about]")?.textContent).toBe(
      "Tomek coaches gymnastics.In Tomek's chat you can practise your first handstand.",
    );
    await act(async () => root.render(createElement(JoinPage, { token: "AbCd", name: "Tomek", finish: false })));
    expect(container.querySelector("[data-host-about]")).toBeNull();
  });
});
