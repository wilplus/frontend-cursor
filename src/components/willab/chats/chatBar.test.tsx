// @vitest-environment jsdom
/*
STORY    As someone in a host's chat or a chat with another person, I want
         the bar to be two places, the "+" and the one thing to do now, so
         that I always know what to do next: ask, answer, or say thanks
         (backend N610, the locked page "The Bar, To Lock"; replaces N600's
         bar and, for these chats, N483's three emoji in the middle).
OUTCOME
  O1  BAR-N610-FE-1: the bar holds two things and nothing else: the "+"
      (named "Add") and one black "Ask {name}" while nothing is asked, in a
      chat with no host, a host's chat that takes recordings and one that
      takes only taps; it is never disabled, opens "Ask {name}", and there
      are no emoji and no mic in the bar.
  O2  BAR-N610-FE-2: when the chat asks, the middle answers: "Record your
      answer" where the chat takes recordings, handing the recording
      screens the question; where it takes only taps the middle stays
      "Ask {name}". Answers to tap sit above the bar with "Not now" under
      them; "Not now" takes them away until the chat is opened again and
      the system keeps the decline.
  O3  BAR-N610-FE-3: after a person's recorded answer, three thanks to tap
      above the bar, 👀, 👍 and 🙏, the last filled; one tap posts
      {"kind":"emoji","body":…}, shows it at once, large, with its meaning,
      and the taps go; none after the assistant's message, none while
      something is asked, and none again once my thanks is the newest.
  O4  BAR-N610-FE-4: the "+" sheet. Nothing asked: "Ask {name}" with
      "Record your question" (the default presentation) and "Send a photo",
      which posts the photo picked to the chat's photo route and shows it.
      While the chat asks: "Answer {name}" with "Send a photo" and no
      "Record your question".
  O5  BAR-N610-FE-5: typing waits for the backend. A host who chose Type
      gets no box while the chat's read does not say `typed`. Once it does:
      nothing asked, the box "Ask {name}" (recording on too: still the
      box), and the words go as {"kind":"text","body":…}, shown at once;
      asked where recording is on too, "Record your answer" keeps the
      middle and "Type your answer" behind the "+" opens the box; asked
      where only typing is on, the box "Type your answer"; and no thanks
      taps, you type your thanks.
  O6  BAR-N610-FE-6: a photo the chat asks for (`meta.photo_asked`, not
      sent by the backend yet) puts "Add a photo" in the middle, and the
      photo picked goes to the chat's photo route.
PROVES   O1 -> "BAR-N610-FE-1: two places, the + and Ask {name}, while nothing is asked"
         O2 -> "BAR-N610-FE-2: the chat asks and the middle answers; taps above the bar, Not now under them"
         O3 -> "BAR-N610-FE-3: thanks is one tap after a person's answer, never after the assistant, never twice"
         O4 -> "BAR-N610-FE-4: the + sheet asks, answers and sends a photo"
         O5 -> "BAR-N610-FE-5: the box types only once the backend keeps typed words"
         O6 -> "BAR-N610-FE-6: a photo asked for takes Add a photo in the middle"
WHY      The founder locked the two-place bar on 10 November 2026 ("ok lock
         that", backend N610) after a morning of drafts; N600's bar, built
         that morning, put a mic on the right and kept the emoji.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

import ChatThread from "./ChatThread";
import type { Chat } from "@/services/api/chats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Route = (init: RequestInit | undefined) => Response;
let routes: Record<string, Route> = {};
const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  const route = routes[`${init?.method ?? "GET"} ${String(url)}`];
  return route ? route(init) : new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const calls = (key: string) => fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key);
const sent = (key: string) => JSON.parse(String(calls(key).at(-1)?.[1]?.body ?? "null"));

let container: HTMLDivElement;
let root: Root;
const onRecordAnswer = vi.fn();

beforeEach(() => {
  routes = {};
  fetchMock.mockClear();
  onRecordAnswer.mockClear();
  window.localStorage.clear();
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

const CHAT: Chat = { id: "c-1", kind: "team", title: "Tomek", subtitle: "", last: null };
type With = { tap: boolean; type: boolean; record: boolean };
const RECORDS: With = { tap: true, type: false, record: true };
const TAPS: With = { tap: true, type: false, record: false };
const TYPES: With = { tap: true, type: true, record: false };
const BOTH: With = { tap: true, type: true, record: true };

const theirs = (id: string, extra: Record<string, unknown>) => ({
  id,
  mine: false,
  author: "Tomek",
  kind: "text",
  body: "",
  meta: null,
  created_at: "2026-11-10T10:00:00Z",
  ...extra,
});
const ASKED = theirs("m-q", { body: "Which shampoo suits me?", meta: { record_answer: true } });
const TO_TAP = theirs("m-t", { body: "What do you know better than most?", meta: { setup: { i: 0, kind: "tap", answers: ["A hobby", "Something I lived through"] } } });
const ANSWER = theirs("m-a", { kind: "voice", meta: { answer: true, duration_ms: 64000 } });

/** Opens the chat: its messages, the host's answer_with (null: no host),
 *  and whether the backend says it keeps typed words. */
async function open(messages: unknown[], answerWith: With | null = null, typed = false) {
  routes["GET /api/v2/chats/c-1/messages"] = () => json({ messages, ...(typed ? { typed: true } : {}) });
  routes["GET /api/v2/chats/c-1/host"] = () =>
    json({ host: answerWith ? { assistant: "Tomek's assistant", about: [], questions: [], answer_with: answerWith } : null });
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(createElement(ChatThread, { chat: CHAT, onBack: () => undefined, onRecordAnswer })));
  await flush();
}

const bar = () => container.querySelector("[data-chat-bar]")!;
/** What the bar holds, left to right, in words. */
const inBar = () =>
  [...bar().querySelectorAll<HTMLElement>("button, input:not([type=file])")].map(
    (el) => el.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label"),
  );
const within = (scope: string, text: string) =>
  [...container.querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === text);
const tap = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await flush();
};
const sheetTitle = () => container.querySelector("[data-ask-sheet] [role=dialog] p")?.textContent ?? null;
const sheetRows = () => [...container.querySelectorAll("[data-ask-sheet] [role=dialog] button")].map((b) => b.textContent);
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

async function pickPhoto() {
  const input = container.querySelector<HTMLInputElement>("[data-chat-photo-pick]")!;
  const photo = new File(["photo"], "hair.jpg", { type: "image/jpeg" });
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [photo] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}
const PHOTO = "POST /api/v2/chats/c-1/photo";
const photoSent = () => json({ message: { id: "m-p", mine: true, author: "", kind: "photo", body: "", meta: { question: true }, created_at: "2026-11-10T10:05:00Z" } });

describe("the bar in a host's chat and between people (N610)", () => {
  it("BAR-N610-FE-1: two places, the + and Ask {name}, while nothing is asked", async () => {
    for (const answerWith of [null, RECORDS, TAPS]) {
      await open([], answerWith);
      expect(inBar()).toEqual(["Add", "Ask Tomek"]);
      expect([...bar().querySelectorAll("button")].some((b) => b.disabled)).toBe(false);
      expect(bar().textContent).not.toMatch(/👍|👀|🙏/);
    }
    await tap(bar().querySelector("[data-chat-ask]"));
    expect(sheetTitle()).toBe("Ask Tomek");
  });

  it("BAR-N610-FE-2: the chat asks and the middle answers; taps above the bar, Not now under them", async () => {
    // A chat that takes recordings: "Record your answer", with the question.
    await open([ASKED], RECORDS);
    expect(inBar()).toEqual(["Add", "Record your answer"]);
    await tap(bar().querySelector("[data-chat-record-answer]"));
    expect(onRecordAnswer).toHaveBeenLastCalledWith({ chatId: "c-1", name: "Tomek", customer: false, question: "Which shampoo suits me?", slides: undefined });

    // Only taps: the middle stays; the answers above the bar, "Not now" under them.
    routes["POST /api/v2/chats/c-1/messages/m-t/not-now"] = () => json({ kept: true });
    await open([TO_TAP], TAPS);
    expect(inBar()).toEqual(["Add", "Ask Tomek"]);
    const above = [...container.querySelectorAll("[data-chat-thread] button")].map((b) => b.textContent);
    expect(above).toEqual(["A hobby", "Something I lived through", "Not now"]);
    await tap(within("[data-chat-not-now]", "Not now"));
    expect(container.querySelector("[data-chat-setup]")).toBeNull();
    expect(container.querySelector("[data-chat-not-now]")).toBeNull();
    expect(calls("POST /api/v2/chats/c-1/messages/m-t/not-now")).toHaveLength(1);
    expect(inBar()).toEqual(["Add", "Ask Tomek"]);
  });

  it("BAR-N610-FE-3: thanks is one tap after a person's answer, never after the assistant, never twice", async () => {
    const thanks = () => [...container.querySelectorAll<HTMLButtonElement>("[data-chat-thanks] button")];
    const mine = { id: "m-me", mine: true, author: "", kind: "emoji", body: "🙏", meta: null, created_at: "2026-11-10T10:06:00Z" };
    routes["POST /api/v2/chats/c-1/messages"] = () => json({ message: mine });

    await open([ANSWER]);
    expect(thanks().map((b) => b.textContent)).toEqual(["👀", "👍", "🙏"]);
    expect(thanks().map((b) => b.hasAttribute("data-goes"))).toEqual([false, false, true]);
    expect(inBar()).toEqual(["Add", "Ask Tomek"]);
    await tap(thanks()[2]);
    expect(sent("POST /api/v2/chats/c-1/messages")).toEqual({ kind: "emoji", body: "🙏" });
    expect(container.querySelector("[data-chat-emoji]")?.textContent).toMatch(/^🙏Thanks · \d\d:\d\d$/);
    expect(thanks()).toEqual([]);

    // Opened again, my thanks is the newest: not twice.
    await open([ANSWER, mine]);
    expect(thanks()).toEqual([]);
    // The assistant's message, a text, and a question still waiting: none.
    await open([{ ...ANSWER, meta: { answer: true, assistant: true } }], RECORDS);
    expect(thanks()).toEqual([]);
    await open([theirs("m-x", { body: "See you Monday" })]);
    expect(thanks()).toEqual([]);
    await open([ANSWER, ASKED]);
    expect(thanks()).toEqual([]);
  });

  it("BAR-N610-FE-4: the + sheet asks, answers and sends a photo", async () => {
    routes[PHOTO] = photoSent;
    await open([], RECORDS);
    await tap(bar().querySelector("[data-chat-plus]"));
    expect(sheetTitle()).toBe("Ask Tomek");
    expect(sheetRows()).toEqual(["Record your question", "Send a photo", "Cancel"]);
    await tap(within("[data-ask-sheet]", "Record your question"));
    expect(onRecordAnswer).toHaveBeenLastCalledWith({ chatId: "c-1", name: "Tomek", customer: false, question: "", asks: true });
    expect(sheetTitle()).toBeNull();

    await tap(bar().querySelector("[data-chat-plus]"));
    await tap(within("[data-ask-sheet]", "Send a photo"));
    expect(sheetTitle()).toBeNull();
    await pickPhoto();
    const body = calls(PHOTO).at(-1)?.[1]?.body as FormData;
    expect((body.get("file") as File).name).toBe("hair.jpg");
    expect(container.querySelector('[data-row="me"] [data-chat-photo]')?.getAttribute("data-chat-photo")).toBe("/api/v2/chats/c-1/messages/m-p/file");

    // While the chat asks: "Answer Tomek"; the middle already records.
    await open([ASKED], RECORDS);
    await tap(bar().querySelector("[data-chat-plus]"));
    expect(sheetTitle()).toBe("Answer Tomek");
    expect(sheetRows()).toEqual(["Send a photo", "Cancel"]);
  });

  it("BAR-N610-FE-5: the box types only once the backend keeps typed words", async () => {
    // The host chose Type, the backend does not keep typed words yet: no box.
    for (const messages of [[], [ASKED]]) {
      await open(messages, BOTH);
      expect(box()).toBeNull();
    }
    await open([], TYPES);
    expect(inBar()).toEqual(["Add", "Ask Tomek"]);

    // The backend says `typed`. Nothing asked: the box asks, recording on or not.
    routes["POST /api/v2/chats/c-1/messages"] = (init) =>
      json({ message: { id: "m-w", mine: true, author: "", kind: "text", body: JSON.parse(String(init?.body)).body, meta: null, created_at: "2026-11-10T10:07:00Z" } });
    await open([], TYPES, true);
    expect(inBar()).toEqual(["Add", "Ask Tomek"]);
    expect(box()?.disabled).toBe(false);
    await open([], BOTH, true);
    expect(box()?.getAttribute("placeholder")).toBe("Ask Tomek");
    await say("What should my first offer cost?");
    expect(sent("POST /api/v2/chats/c-1/messages")).toEqual({ kind: "text", body: "What should my first offer cost?" });
    expect(container.querySelector('[data-row="me"]')?.textContent).toContain("What should my first offer cost?");
    expect(box()?.value).toBe("");

    // Asked, recording on too: the button records; "Type your answer" is behind the "+".
    await open([ASKED], BOTH, true);
    expect(inBar()).toEqual(["Add", "Record your answer"]);
    await tap(bar().querySelector("[data-chat-plus]"));
    expect(sheetRows()).toEqual(["Type your answer", "Send a photo", "Cancel"]);
    await tap(within("[data-ask-sheet]", "Type your answer"));
    expect(inBar()).toEqual(["Add", "Type your answer"]);
    await say("The gentle one");
    expect(sent("POST /api/v2/chats/c-1/messages")).toEqual({ kind: "text", body: "The gentle one" });

    // Asked, only typing: the box answers. And no thanks taps: you type them.
    await open([ASKED], TYPES, true);
    expect(inBar()).toEqual(["Add", "Type your answer"]);
    await open([ANSWER], TYPES, true);
    expect(container.querySelector("[data-chat-thanks]")).toBeNull();
  });

  it("BAR-N610-FE-6: a photo asked for takes Add a photo in the middle", async () => {
    routes[PHOTO] = photoSent;
    await open([theirs("m-ph", { body: "Send me a photo of your hair.", meta: { photo_asked: true } })], RECORDS);
    expect(inBar()).toEqual(["Add", "Add a photo"]);
    await tap(bar().querySelector("[data-chat-add-photo]"));
    await pickPhoto();
    expect(calls(PHOTO)).toHaveLength(1);
    expect(inBar()).toEqual(["Add", "Ask Tomek"]);
  });
});
