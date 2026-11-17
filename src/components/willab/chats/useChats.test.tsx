// @vitest-environment jsdom
/*
STORY    As a speaker, I want a current chat read before any retained rows,
         so an old list never flashes over the current state.
OUTCOME  The kept list is fallback-only when the current read fails.
PROVES   The retained people-chat read remains a backend side effect without
         becoming the primary Speaking Coach IA.
*/
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "@/services/api/chats";

const api = vi.hoisted(() => ({
  takeChats: vi.fn(),
  getChats: vi.fn(),
  getInquiries: vi.fn(),
  whoseChats: vi.fn(),
  keptChats: vi.fn(),
  keepChats: vi.fn(),
  forgetChats: vi.fn(),
}));

vi.mock("../useSignedIn", () => ({ useSignedIn: () => true }));
vi.mock("@/services/api/chats", () => ({ getChats: api.getChats }));
vi.mock("@/services/api/bootPrefetch", () => ({ takeChats: api.takeChats }));
vi.mock("@/services/api/takeMatches", () => ({ getInquiries: api.getInquiries }));
vi.mock("./chatsKept", () => ({
  whoseChats: api.whoseChats,
  keptChats: api.keptChats,
  keepChats: api.keepChats,
  forgetChats: api.forgetChats,
}));

import { useChatList } from "./useChats";

const chat = (id: string): Chat => ({
  id,
  kind: "team",
  title: id,
  subtitle: "",
  last: null,
});

function Probe() {
  const { chats } = useChatList(true);
  return createElement("div", { "data-chat-list": "", "data-chats": chats ? chats.map((item) => item.id).join(",") : "loading" });
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.takeChats.mockReset();
  api.getChats.mockReset();
  api.getInquiries.mockReset().mockResolvedValue([]);
  api.whoseChats.mockReset().mockResolvedValue("speaker");
  api.keptChats.mockReset().mockReturnValue([chat("old")]);
  api.keepChats.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

describe("the people-chat read behind Speaking Coach", () => {
  it("waits for the current read instead of flashing the kept list", async () => {
    let answer: (value: Chat[] | null) => void = () => {};
    api.takeChats.mockImplementation(() => new Promise<Chat[] | null>((resolve) => (answer = resolve)));

    act(() => root.render(createElement(Probe)));
    expect(host.querySelector("[data-chats]")?.getAttribute("data-chats")).toBe("loading");

    await act(async () => answer([chat("current")]));
    expect(host.querySelector("[data-chats]")?.getAttribute("data-chats")).toBe("current");
  });

  it("uses the kept list only when the current read fails", async () => {
    api.takeChats.mockResolvedValue(null);

    act(() => root.render(createElement(Probe)));
    await flush();

    expect(host.querySelector("[data-chats]")?.getAttribute("data-chats")).toBe("old");
    expect(api.keptChats).toHaveBeenCalledWith("speaker");
  });

  it("does not duplicate the list read when visibility refresh overlaps it", async () => {
    api.takeChats.mockImplementation(() => new Promise<Chat[] | null>(() => undefined));

    act(() => root.render(createElement(Probe)));
    await flush();
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(api.takeChats).toHaveBeenCalledTimes(1);
    expect(api.getInquiries).toHaveBeenCalledTimes(1);
  });
});
