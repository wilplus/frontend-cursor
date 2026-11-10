// @vitest-environment jsdom
/*
STORY    As a host, I want the questions people ask me gathered by meaning in
         Will's chat, so that one recording answers everyone who asked the
         same thing, each in their own chat with me under their own question
         (backend N584, N602; behind the ring row chat_builder, N579 item 2).
OUTCOME
  O1  HOST-N602-1: in Will's chat, each bundle still waiting is one card,
      in the backend's words: "2 people asked", the question large, the
      faces of who asked, "See who asked ›" and "Record one answer"; no
      list of every asker's question on the card; an answered bundle is not
      shown; without the ring or the route (404) the queue draws nothing.
  O4  HOST-N602-2: "See who asked ›" opens "Who asked": each person's own
      words and name with the match's colour (never a number); "Split them
      up ›" turns the rows into picks and "Split them up" sends the picked
      ones to the split route {questions}, then the queue is read again;
      a sheet the backend refuses (404) does not open.
  O2  HOST-N584-2: "Record one answer" hands the recording screens the first
      question and the bundle; once the Take is up it goes to the bundle's
      route {take, duration_ms}, at once and with no Undo, and the queue is
      read again.
  O3  HOST-N584-3: the person who asked meets the answer in their own chat
      with me, under their own question quoted, with the match's colour.
PROVES   O1 -> "HOST-N602-1: each waiting bundle is one card in the backend's words, and nothing without the ring"
         O2 -> "HOST-N584-2: one recording goes to the bundle's route, at once"
         O3 -> "HOST-N584-3: the answer comes under the asker's own question, with its colour"
         O4 -> "HOST-N602-2: See who asked opens the sheet, and Split them up moves the picked questions out"
WHY      "how do we bundle the people who have similar questions ... so that
         I can answer it to that whole group with my one recording?"
         (founder, 9 November 2026, N584).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => false }));

import BundleQueue from "./BundleQueue";
import ChatThread from "./ChatThread";
import { answerRecorded, answerTake, forgetAnswers, startAnswer, usePendingAnswer, type AnswerFor } from "@/lib/willab/chatAnswer";
import type { Chat } from "@/services/api/chats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Route = () => Response;
let routes: Record<string, Route> = {};
const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  const route = routes[`${init?.method ?? "GET"} ${String(url)}`];
  return route ? route() : new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const calls = (key: string) => fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key);

const WAITING = {
  id: "b-1",
  title: "2 people asked",
  question: "How do I start a handstand?",
  faces: ["Ariel", "Piotr"],
  who: "Ariel and Piotr",
  note: null,
  see: "See who asked",
  answered: false,
  record: "Record one answer",
};
const ANSWERED = { id: "b-2", title: "Kasia asked", question: "Which shoes?", faces: ["Kasia"], note: null, see: "See who asked", answered: true, record: null };
const WHO = {
  title: "Who asked",
  split: "Split them up",
  people: [
    { id: "a-1", words: "How do I start a handstand?", mark: "green", name: "Ariel", where: "in your chat", chat: "c-ariel", sent: false },
    { id: "a-2", words: "How should I begin with handstands?", mark: "yellow", name: "Piotr", where: "in your chat", chat: "c-piotr", sent: false },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  routes = {};
  fetchMock.mockClear();
  forgetAnswers();
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

async function render(node: React.ReactElement) {
  await act(async () => root.render(node));
  await flush();
}

describe("one recording answers everyone who asked", () => {
  it("HOST-N602-1: each waiting bundle is one card in the backend's words, and nothing without the ring", async () => {
    const onRecord = vi.fn();
    await render(createElement(BundleQueue, { signedIn: true, onRecord }));
    expect(container.querySelector("[data-bundle-queue]")).toBeNull();

    routes["GET /api/v2/chats/bundles"] = () => json({ bundles: [WAITING, ANSWERED] });
    act(() => root.unmount());
    root = createRoot(container);
    await render(createElement(BundleQueue, { signedIn: true, onRecord }));
    const cards = container.querySelectorAll("[data-bundle]");
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.querySelector("[data-bundle-title]")?.textContent).toBe("2 people asked");
    expect(card.querySelector("[data-bundle-question]")?.textContent).toBe("How do I start a handstand?");
    expect(card.querySelectorAll("[data-bundle-faces] [data-chat-letter]")).toHaveLength(2);
    expect(card.querySelector("[data-bundle-see]")?.textContent).toBe("See who asked ›");
    expect(card.querySelector("[data-bundle-record]")?.textContent).toBe("Record one answer");
    // One question on the card: not every asker's.
    expect(card.textContent).not.toContain("How should I begin with handstands?");
    expect(card.textContent).not.toMatch(/\d+%|0\.\d/);
    expect(container.textContent).not.toContain("Which shoes?");

    await act(async () => card.querySelector<HTMLButtonElement>("[data-bundle-record]")!.click());
    expect(onRecord).toHaveBeenCalledWith({
      chatId: "bundle:b-1",
      name: "Ariel",
      question: "How do I start a handstand?",
      customer: false,
      bundle: "b-1",
    });
  });

  it("HOST-N602-2: See who asked opens the sheet, and Split them up moves the picked questions out", async () => {
    routes["GET /api/v2/chats/bundles"] = () => json({ bundles: [WAITING] });
    await render(createElement(BundleQueue, { signedIn: true, onRecord: vi.fn() }));
    const see = () => container.querySelector<HTMLButtonElement>("[data-bundle-see]")!;

    // A backend without the sheet's route: nothing opens.
    await act(async () => see().click());
    await flush();
    expect(container.querySelector("[data-bundle-who]")).toBeNull();

    routes["GET /api/v2/chats/bundles/b-1"] = () => json(WHO);
    await act(async () => see().click());
    await flush();
    const sheet = container.querySelector("[data-bundle-who]")!;
    expect(sheet.querySelector("[role=dialog]")?.getAttribute("aria-label")).toBe("Who asked");
    expect(sheet.textContent).toContain("Who asked");
    expect([...sheet.querySelectorAll("[data-bundle-asker]")].map((r) => r.textContent)).toEqual([
      "AArielHow do I start a handstand?",
      "PPiotrHow should I begin with handstands?",
    ]);
    expect([...sheet.querySelectorAll("[data-mark]")].map((m) => m.getAttribute("data-mark"))).toEqual(["green", "yellow"]);
    expect(sheet.textContent).not.toMatch(/\d+%|0\.\d/);

    routes["POST /api/v2/chats/bundles/b-1/split"] = () => json({ bundle: "b-3" });
    await act(async () => sheet.querySelector<HTMLButtonElement>("[data-bundle-split]")!.click());
    const send = () => container.querySelector<HTMLButtonElement>("[data-bundle-split-send]")!;
    expect(send().textContent).toBe("Split them up");
    expect(send().disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-bundle-asker="a-2"] button')!.click());
    const reads = calls("GET /api/v2/chats/bundles").length;
    await act(async () => send().click());
    await flush();
    const posts = calls("POST /api/v2/chats/bundles/b-1/split");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0]![1]!.body))).toEqual({ questions: ["a-2"] });
    expect(container.querySelector("[data-bundle-who]")).toBeNull();
    expect(calls("GET /api/v2/chats/bundles").length).toBeGreaterThan(reads);
  });

  it("HOST-N584-2: one recording goes to the bundle's route, at once", async () => {
    routes["GET /api/v2/chats/bundles"] = () => json({ bundles: [WAITING] });
    routes["POST /api/v2/projects"] = () => json({ project_id: "p-answer" });
    routes["POST /api/v2/chats/bundles/b-1/answer"] = () => json({ sent: 2 });
    let pending: ReturnType<typeof usePendingAnswer> = null;
    function Will({ onRecord }: { onRecord: (a: AnswerFor) => void }) {
      pending = usePendingAnswer("bundle:b-1");
      return createElement(BundleQueue, { signedIn: true, onRecord });
    }
    let handed: AnswerFor | null = null;
    await render(createElement(Will, { onRecord: (a: AnswerFor) => void (handed = a) }));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-bundle-record]")!.click());
    await act(async () => {
      await startAnswer(handed!, null, () => {});
    });
    const reads = calls("GET /api/v2/chats/bundles").length;
    await act(async () => answerRecorded(42_000));
    // No Undo: the bundle's route holds nothing.
    expect(pending).toMatchObject({ waited: true });
    await act(async () => answerTake("take-1"));
    await flush();
    const posts = calls("POST /api/v2/chats/bundles/b-1/answer");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0]![1]!.body))).toEqual({ take: "take-1", duration_ms: 42000 });
    expect(calls("GET /api/v2/chats/bundles").length).toBeGreaterThan(reads);
  });

  it("HOST-N584-3: the answer comes under the asker's own question, with its colour", async () => {
    const chat: Chat = { id: "c-ariel", kind: "team", title: "Tomek", subtitle: "", last: null };
    routes["GET /api/v2/chats/c-ariel/messages"] = () =>
      json({
        messages: [
          {
            id: "m-9",
            mine: false,
            author: "Tomek",
            kind: "voice",
            body: "",
            meta: { answer: true, duration_ms: 42000, bundle: "b-1", quote: { message_id: "m-1", words: "How do I start a handstand?" }, mark: "green" },
            created_at: "2026-11-09T11:00:00Z",
          },
        ],
      });
    await render(createElement(ChatThread, { chat, onBack: () => undefined }));
    const quote = container.querySelector("[data-answer-quote]")!;
    expect(quote.querySelector("[data-answer-quote-words]")?.textContent).toBe("How do I start a handstand?");
    expect(quote.querySelector("[data-mark]")?.getAttribute("data-mark")).toBe("green");
    expect(quote.querySelector("[data-chat-voice]")).toBeTruthy();
  });
});
