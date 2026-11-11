// @vitest-environment jsdom
/*
STORY    As a person on the chat builder's ring recording Takes in my chat
         with a speaking host, I want the host's own messages in that chat
         too, each in its place among my Takes, so that nothing I had in the
         chat is gone once it shows my Takes (backend N648 item 8).
OUTCOME
  O1  The chat's own messages are read for the chat open, and lie among the
      Take rows by time: those before a row right before it, the newer ones
      after the last.
  O2  The tag of a Take made in the chat is not drawn as a message: the
      Take shows through its own rows; opened, the chat no longer reads as
      new in the list.
  O3  A message that asks something of me opens the chat as it is today in
      one tap; one that asks nothing is only read.
PROVES   O1 -> "N648-8 the host's messages lie among the Takes by time"
         O2 -> "N648-8 the chat is read for the chat open, without a Take's tag"
         O3 -> "N648-8 a message that asks something opens the chat as it is today"
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/services/api/chats", async (orig) => ({
  ...(await orig<typeof import("@/services/api/chats")>()),
  getChatThread: vi.fn(async (chatId: string) => {
    reads.calls.push(chatId);
    return {
      messages: [
        { id: "h1", mine: false, author: "Artur", kind: "text", body: "Welcome. Record your first Take.", meta: null, created_at: "2026-11-11T09:00:00Z" },
        { id: "t1", mine: true, author: "Ana", kind: "take", body: "", meta: { made_here: "s-1", take_index: 1 }, created_at: "2026-11-11T09:05:00Z" },
        { id: "h2", mine: false, author: "Artur", kind: "text", body: "Good start.", meta: null, created_at: "2026-11-11T09:30:00Z" },
      ],
      joinedThrough: null, joinedAsks: false, joinedBy: null, blocked: false,
    };
  }),
}));

import { hostRowsAround, useHostMessages } from "./hostChatMessages";
import HostChatRow from "./HostChatRow";
import { isNewSince } from "./chatOpened";
import type { ChatMessage } from "@/services/api/chats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  reads.calls = [];
});

const msg = (id: string, at: string) => ({ id, mine: false, author: "Artur", kind: "text", body: id, meta: null, created_at: at }) as ChatMessage;

describe("a host's chat's own messages among its Takes (N648 item 8)", () => {
  it("N648-8 the host's messages lie among the Takes by time", () => {
    const host = [msg("after-all", "2026-11-11T12:00:00Z"), msg("first", "2026-11-11T08:00:00Z"), msg("between", "2026-11-11T10:00:00Z")];
    // Two Take rows: the Ideal Text card at 09:00, the walk at 11:00.
    const laid = hostRowsAround(host, ["2026-11-11T09:00:00.000Z", "2026-11-11T11:00:00.000Z"]);
    expect(laid.before.map((b) => b.map((m) => m.id))).toEqual([["first"], ["between"]]);
    expect(laid.after.map((m) => m.id)).toEqual(["after-all"]);
    // No Take rows yet: every message after.
    expect(hostRowsAround(host, []).after.map((m) => m.id)).toEqual(["first", "between", "after-all"]);
  });

  it("N648-8 the chat is read for the chat open, without a Take's tag", async () => {
    const box: { got: ChatMessage[] } = { got: [] };
    function Probe({ chat }: { chat: string | null }) {
      box.got = useHostMessages(chat);
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe, { chat: null })));
    expect(reads.calls).toEqual([]);
    expect(box.got).toEqual([]);
    await act(async () => root.render(createElement(Probe, { chat: "c-artur" })));
    expect(reads.calls).toEqual(["c-artur"]);
    expect(box.got.map((m) => m.id)).toEqual(["h1", "h2"]);
    // Opened: its newest message no longer reads as new in the list.
    expect(isNewSince("c-artur", "2026-11-11T09:30:00Z")).toBe(false);
    // Left: nothing of the chat stays.
    await act(async () => root.render(createElement(Probe, { chat: null })));
    expect(box.got).toEqual([]);
    await act(async () => root.unmount());
  });

  it("N648-8 a message that asks something opens the chat as it is today", async () => {
    const said = msg("h1", "2026-11-11T09:00:00Z");
    const asks = { ...msg("h2", "2026-11-11T09:30:00Z"), body: "Record your answer: what is your goal?", meta: { record_answer: true } } as ChatMessage;
    const all = [said, asks];
    const opened: string[] = [];
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () =>
      root.render(
        createElement("div", null,
          createElement(HostChatRow, { chatId: "c-artur", name: "Artur", message: said, all, onOpen: () => opened.push("h1") }),
          createElement(HostChatRow, { chatId: "c-artur", name: "Artur", message: asks, all, onOpen: () => opened.push("h2") }),
        ),
      ),
    );
    expect(host.textContent).toContain("Record your answer: what is your goal?");
    expect(host.querySelector('[data-host-asks="h1"]')).toBeNull();
    await act(async () => (host.querySelector('[data-host-asks="h2"]') as HTMLElement).click());
    expect(opened).toEqual(["h2"]);
    await act(async () => root.unmount());
  });
});
