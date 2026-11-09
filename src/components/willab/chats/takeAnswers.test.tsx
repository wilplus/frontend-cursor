// @vitest-environment jsdom
/*
STORY    As a speaker who sent a Take to my coach and to others, I want their
         answers gathered under my Take, so that I see my coach's answer and
         the best of the others in one place, and only I see the gathering
         (backend N587 items 3 to 5, N588 item 4; behind the ring row
         chat_builder, N579 item 2).
OUTCOME
  O1  HOST-N587-1: under my own Take, one bubble with the faces of everyone
      who answered and the names the backend shows (my coach's and the best
      other); a tap opens all of them under "On your speaking" and "On the
      matter", each with the way into that person's chat, which opens it.
  O2  HOST-N587-2: without the ring, or for a Take sent nowhere (404), and
      under a Take someone else sent me, nothing is gathered or drawn.
PROVES   O1 -> "HOST-N587-1: my Take's answers, gathered under it, under the two headings"
         O2 -> "HOST-N587-2: nothing under a Take without the ring, nor under theirs"
WHY      "if you send them the request and they all answered, you should be
         able to receive all of them" (founder, 9 November 2026, N587).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => false }));

import ChatThread from "./ChatThread";
import type { Chat } from "@/services/api/chats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let routes: Record<string, () => Response> = {};
const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  const route = routes[`${init?.method ?? "GET"} ${String(url)}`];
  return route ? route() : new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const asked = (key: string) => fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key);

const ARTUR: Chat = { id: "c-artur", kind: "team", title: "Artur", subtitle: "", last: null };
const take = (mine: boolean) => ({
  id: "m-take",
  mine,
  author: mine ? "" : "Artur",
  kind: "take",
  body: "",
  meta: { take_session_id: "s-1", take_index: 2, duration_ms: 60000, project_title: "My pitch" },
  created_at: "2026-11-09T10:00:00Z",
});
const answer = (chat: string, name: string, coach: boolean, title: string) => ({ message_id: `m-${name}`, chat, coach, name, title, at: "2026-11-09T11:00:00Z" });
const GATHERED = {
  bubble: {
    shown: [answer("c-artur", "Artur", true, "On your speaking"), answer("c-ola", "Ola", false, "On the matter")],
    faces: ["Artur", "Marta", "Ola"],
  },
  groups: [
    { title: "On your speaking", answers: [answer("c-artur", "Artur", true, "On your speaking"), answer("c-marta", "Marta", false, "On your speaking")] },
    { title: "On the matter", answers: [answer("c-ola", "Ola", false, "On the matter")] },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  routes = {};
  fetchMock.mockClear();
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

async function render(onOpenChat?: (id: string) => void) {
  await act(async () => root.render(createElement(ChatThread, { chat: ARTUR, onBack: () => undefined, onOpenChat })));
  await flush();
}

describe("one Take, its answers in one place", () => {
  it("HOST-N587-1: my Take's answers, gathered under it, under the two headings", async () => {
    routes["GET /api/v2/chats/c-artur/messages"] = () => json({ messages: [take(true)] });
    routes["GET /api/v2/user/takes/s-1/answers"] = () => json(GATHERED);
    const onOpenChat = vi.fn();
    await render(onOpenChat);
    const bubble = container.querySelector<HTMLButtonElement>("[data-take-answers]")!;
    expect(bubble.querySelectorAll("[data-chat-letter]")).toHaveLength(3);
    expect(bubble.textContent).toContain("Artur, Ola answered");

    await act(async () => bubble.click());
    const all = container.querySelector("[data-take-answers-all]")!;
    expect([...all.querySelectorAll("h4")].map((h) => h.textContent)).toEqual(["On your speaking", "On the matter"]);
    expect([...all.querySelectorAll("[data-take-answer]")].map((a) => a.textContent)).toEqual([
      "AArturOpen your chat with Artur",
      "MMartaOpen your chat with Marta",
      "OOlaOpen your chat with Ola",
    ]);
    await act(async () => all.querySelector<HTMLButtonElement>('[data-take-answer-open="c-ola"]')!.click());
    expect(onOpenChat).toHaveBeenCalledWith("c-ola");
  });

  it("HOST-N587-2: nothing under a Take without the ring, nor under theirs", async () => {
    routes["GET /api/v2/chats/c-artur/messages"] = () => json({ messages: [take(true)] });
    await render();
    expect(asked("GET /api/v2/user/takes/s-1/answers")).toHaveLength(1);
    expect(container.querySelector("[data-take-answers]")).toBeNull();

    fetchMock.mockClear();
    routes["GET /api/v2/chats/c-artur/messages"] = () => json({ messages: [take(false)] });
    routes["GET /api/v2/user/takes/s-1/answers"] = () => json(GATHERED);
    act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(asked("GET /api/v2/user/takes/s-1/answers")).toHaveLength(0);
    expect(container.querySelector("[data-take-answers]")).toBeNull();
  });
});
