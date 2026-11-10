// @vitest-environment jsdom
/*
STORY    As someone who opens a chat set up with the blank setup, I meet the
         host's hello and taps, send in the way the host takes, get back what
         the host chose with each model's line naming whose model it is, and
         may say whether it was useful without it ever standing before my next
         message (backend N616 items 4 to 6, N618 item 8; VIS-01 to VIS-06).
OUTCOME
  O1  What the backend's host read and reply rows carry (the recipe v2
      contract, backend #1893) is what the visitor sees, in its words.
  O2  "Was this useful?" never takes the bar away.
PROVES   one test per story, named by its id
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => false }));

import ChatThread from "../ChatThread";
import type { Chat } from "@/services/api/chats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Route = (init: RequestInit | undefined) => Response;
let routes: Record<string, Route> = {};
const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  const route = routes[`${init?.method ?? "GET"} ${String(url)}`];
  return route ? route(init) : new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
});
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const sentTo = (key: string) =>
  fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key).map(([, init]) => JSON.parse(String(init?.body ?? "null")));

const chat: Chat = { id: "c-9", kind: "team", title: "Lena", subtitle: "", last: null };
const HELLO = "Hi. Send me a photo of your scalp, and tell me what worries you.";
const TAPS = ["Look at my scalp", "My hair is falling out", "Which shampoo", "Something else"];
const host = (send: string[]) => ({
  host: {
    assistant: "Lena's assistant",
    about: [],
    questions: [],
    answer_with: { tap: true, type: true, record: true },
    hello: HELLO,
    taps: TAPS,
    send,
    out: "answer",
    models: [{ q: "Is this a dry scalp?", by: "Lena's model" }],
  },
});
const row = (id: string, body: string, meta: Record<string, unknown> | null, mine = false) => ({
  id, mine, author: mine ? "" : "Lena", kind: "text", body, meta, created_at: "2026-11-10T10:00:00Z",
});
const ANSWER = row("r-1", "Thank you. I can see the crown clearly.", { reply: { to: "m-1", by: "assistant", name: "Lena's assistant", out: "answer" } });
const MODEL = row("r-2", "Your scalp looks dry here.", { model_line: { q: "Is this a dry scalp?", by: "Kasia's model" }, useful_ask: true });

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
const flush = () => act(async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
});
async function open(messages: unknown[], send = ["text"]) {
  routes["GET /api/v2/chats/c-9/messages"] = () => json({ messages });
  routes["GET /api/v2/chats/c-9/host"] = () => json(host(send));
  await act(async () => root.render(createElement(ChatThread, { chat, onBack: () => undefined })));
  await flush();
}
const thread = () => container.querySelector("[data-chat-thread]")?.textContent ?? "";
const bar = () => container.querySelector("[data-chat-bar]")!;
const box = () => bar().querySelector<HTMLInputElement>("[data-chat-box] input");
async function say(words: string) {
  const input = box()!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, words);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await flush();
}
async function tap(label: string) {
  const b = [...container.querySelectorAll("button")].find((x) => x.textContent?.trim() === label) as HTMLButtonElement;
  await act(async () => b.click());
  await flush();
}

describe("what a visitor meets (VIS-)", () => {
  it("VIS-01 the host's hello first, then the taps with Something else; a tap is sent as theirs", async () => {
    routes["POST /api/v2/chats/c-9/messages"] = () => json({ message: row("m-1", "Look at my scalp", null, true) });
    await open([]);
    expect(thread()).toContain(HELLO);
    expect(thread()).toContain("Tell me what you'd like to do, and I'll show you where.");
    expect([...container.querySelectorAll("[data-visitor-taps] button")].map((b) => b.textContent)).toEqual(TAPS);
    await tap("Look at my scalp");
    expect(sentTo("POST /api/v2/chats/c-9/messages")).toEqual([{ kind: "text", body: "Look at my scalp" }]);
    expect(container.querySelector("[data-visitor-taps]")).toBeNull();
  });

  it("VIS-01 a chat whose recipe has no taps draws no lone Something else", async () => {
    routes["GET /api/v2/chats/c-9/messages"] = () => json({ messages: [] });
    routes["GET /api/v2/chats/c-9/host"] = () => json({ host: { ...host(["text"]).host, taps: ["Something else"] } });
    await act(async () => root.render(createElement(ChatThread, { chat, onBack: () => undefined })));
    await flush();
    expect(thread()).toContain(HELLO);
    expect(container.querySelector("[data-visitor-taps]")).toBeNull();
    expect(thread()).not.toContain("Something else");
    expect(thread()).not.toContain("Tell me what you'd like to do");
  });

  it("N633-2 in a chat the two already share, the other's hello row and taps show once, never doubled; never one's own", async () => {
    const welcome = (id: string, mine: boolean) => ({ ...row(id, HELLO, { welcome: { i: 0 } }, mine) });
    // Lena's chat opened after the two had talked: her hello is written here once.
    await open([row("m-0", "See you Thursday", null, true), row("m-1", "Great, see you", null), welcome("w-1", false)], ["text"]);
    expect(thread().split(HELLO)).toHaveLength(2);
    expect([...container.querySelectorAll("[data-visitor-taps] button")].map((b) => b.textContent)).toEqual(TAPS);
    expect(box()).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    // The reverse: she joined through my link (my hello row first, mine), we
    // talked, then her chat opened: her hello and taps show to me.
    await open([welcome("w-a", true), row("m-a", "Hello!", null), row("m-b", "Hi Lena", null, true), welcome("w-b", false)], ["text"]);
    expect([...container.querySelectorAll("[data-visitor-taps] button")].map((b) => b.textContent)).toEqual(TAPS);
    act(() => root.unmount());
    root = createRoot(container);
    // Once I have sent something after her hello, its taps are gone (once).
    await open([welcome("w-0", false), row("m-2", "Look at my scalp", null, true)], ["text"]);
    expect(container.querySelector("[data-visitor-taps]")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    // My own hello row in a chat with someone whose chat is not open: no host,
    // so none of my own taps are shown to me.
    routes["GET /api/v2/chats/c-9/messages"] = () => json({ messages: [welcome("w-2", true), row("m-3", "Hi", null)] });
    routes["GET /api/v2/chats/c-9/host"] = () => new Response(JSON.stringify({ host: null }), { status: 200 });
    await act(async () => root.render(createElement(ChatThread, { chat, onBack: () => undefined })));
    await flush();
    expect(container.querySelector("[data-visitor-taps]")).toBeNull();
    expect(container.querySelector("[data-host-hello]")).toBeNull();
  });

  it("VIS-02 the bar follows what the host takes: a message, the box; a recording alone, no box", async () => {
    await open([], ["text"]);
    expect(box()).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await open([], ["rec"]);
    expect(box()).toBeNull();
  });

  it("VIS-03 what comes back says who it is from", async () => {
    routes["POST /api/v2/chats/c-9/messages"] = () =>
      json({ message: row("m-1", "My scalp itches.", null, true), reply: { messages: [ANSWER], useful: true } });
    await open([row("m-0", "Look at my scalp", null, true)]);
    await say("My scalp itches.");
    expect(thread()).toContain("Thank you. I can see the crown clearly.");
    expect(container.querySelector("[data-reply-by]")?.textContent).toContain("Lena's assistant");
  });

  it("VIS-04 each model's line names whose model it is", async () => {
    await open([row("m-1", "My scalp itches.", null, true), ANSWER, MODEL]);
    const by = [...container.querySelectorAll("[data-reply-by]")].map((el) => el.textContent);
    expect(by[0]).toContain("Lena's assistant");
    expect(by[1]).toContain("Your scalp looks dry here.");
    expect(by[1]).toContain("Kasia's model");
  });

  it("VIS-05 'Was this useful?' with Yes, No and Skip never takes the bar away", async () => {
    routes["POST /api/v2/chats/c-9/messages/r-2/useful"] = () => json({ ok: true });
    await open([row("m-1", "My scalp itches.", null, true), ANSWER, MODEL]);
    expect(thread()).toContain("Was this useful?");
    expect([...container.querySelectorAll("[data-useful-taps] button")].map((b) => b.textContent)).toEqual(["Yes", "No", "Skip"]);
    expect(box()).not.toBeNull();
    await tap("No");
    expect(sentTo("POST /api/v2/chats/c-9/messages/r-2/useful")).toEqual([{ answer: "no" }]);
    expect(container.querySelector("[data-useful-ask]")).toBeNull();
  });

  it("VIS-06 before the minimum the question waits for the host: nothing is answered for them", async () => {
    routes["POST /api/v2/chats/c-9/messages"] = () => json({ message: row("m-1", "My scalp itches.", null, true), reply: { waits: true } });
    await open([row("m-0", "Look at my scalp", null, true)]);
    await say("My scalp itches.");
    expect(thread()).toContain("My scalp itches.");
    expect(container.querySelector("[data-reply-by]")).toBeNull();
    expect(container.querySelector("[data-useful-ask]")).toBeNull();
  });
});
