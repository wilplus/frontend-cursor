// @vitest-environment jsdom
/*
STORY    As someone who invites people, I want to set up my own chat in Will's
         chat and change it in a builder, and whoever joins through my link to
         meet my welcome first, as my assistant's, with who I am on top, so
         that people are met my way (backend N578, N579, N582, N586, N590;
         behind the ring row chat_builder, N579 item 2).
OUTCOME
  O1  HOST-N578-7: as a tester, the builder opens on "Tomek's assistant"
      with Artur's five to start from, and Save sends only what is mine to
      set (the welcome, the questions, how people answer, and the about,
      fit and model kept as they were); a refusal shows the backend's own
      sentence; without the ring (404) the builder draws nothing.
  O2  HOST-N590-8: someone who joined my chat reads, on top, who I am and
      what they can learn with me, in my words, and my welcome as my
      assistant's message, labelled "Tomek's assistant" with its mark; a
      chat whose host is null (no ring, no recipe, or no route) is as it
      was.
  O3  HOST-N582-10: in Will's chat, the setup is drawn in the backend's
      words: Will's question with its answers to tap while it is the newest
      bubble ("Set up my chat", "Record", "Type", "Tap answers", "Any of
      these"), a tap posts {to, picked}; typed words answer the question
      that waits for words ({to, said}); after "Your assistant is live."
      "Set up my chat ›" opens the builder.
  O5  HOST-N582-11: typed words under a setup question that takes taps
      only are an ordinary message to Will; words the setup refuses come
      back to the box; Will's offer, once newer bubbles came under it,
      carries "Set up my chat ›", which begins the setup again, until the
      assistant is live.
  O4  HOST-N586-5: Will's offer is asked of the backend once, only for a
      tester with no recipe; with a recipe, or without the ring, it is not.
PROVES   O1 -> "HOST-N578-7: the builder starts from Artur's five, saves what is mine, and is nothing without the ring"
         O2 -> "HOST-N590-8: the joiner meets the host's welcome first, as the assistant's"
         O3 -> "HOST-N582-10: Will's setup of my chat, one question at a time, in the backend's words"
         O5 -> "HOST-N582-11: typed words the setup refuses come back; the offer, once scrolled away, begins the setup again"
         O4 -> "HOST-N586-5: Will offers the setup once, only to a tester with no recipe"
WHY      Every inviter has a chat of their own, set up in Will's chat
         (founder, 9 November 2026, N578 to N582, N586, N590).
*/
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => false }));

import AssistantBuilder from "./AssistantBuilder";
import ChatThread from "./ChatThread";
import { ChatSetupBubble, chatSetupCanBegin, chatSetupOf, resetAssistantInWill, useAssistantInWill, useChatSetup, willSetupWaiting } from "./ChatSetup";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { Chat } from "@/services/api/chats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ARTURS_FIVE = [
  { title: "Your talk", q: "What is your talk about?", under: "", answers: [] },
  { title: "Your audience", q: "Who will listen?", under: "", answers: [] },
  { title: "When", q: "When is it?", under: "", answers: [] },
  { title: "How long", q: "How long will you speak?", under: "", answers: [] },
  { title: "One sentence", q: "If they remember one sentence from you, what should it be?", under: "", answers: [] },
];

type Route = (init: RequestInit | undefined) => Response;
let routes: Record<string, Route> = {};
const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
  const key = `${init?.method ?? "GET"} ${String(url)}`;
  const route = routes[key];
  return route ? route(init) : new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const calls = (key: string) => fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key);
const sent = (key: string) => JSON.parse(String(calls(key).at(-1)?.[1]?.body ?? "null"));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  routes = {};
  fetchMock.mockClear();
  resetAssistantInWill();
  try {
    window.localStorage.clear();
  } catch {
    // nothing kept
  }
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

const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;

describe("a host's own chat", () => {
  it("HOST-N578-7: the builder starts from Artur's five, saves what is mine, and is nothing without the ring", async () => {
    const onClose = vi.fn();
    await render(createElement(AssistantBuilder, { onClose }));
    expect(container.querySelector("[data-assistant-builder]")).toBeNull();
    expect(onClose).toHaveBeenCalled();

    routes["GET /api/v2/chats/recipe"] = () =>
      json({ assistant: "Tomek's assistant", recipe: null, starting_questions: ARTURS_FIVE, locked: ["consent"] });
    await render(createElement(AssistantBuilder, { onClose: () => undefined }));
    expect(container.querySelector("h2")?.textContent).toBe("Tomek's assistant");
    expect(container.querySelectorAll("[data-builder-question]")).toHaveLength(5);

    routes["PUT /api/v2/chats/recipe"] = () =>
      json({ code: "RECIPE_WORDS", error: "Welcome line 1: a verdict: bad." }, 400);
    await act(async () => button("Add a line")!.click());
    const line = container.querySelector<HTMLTextAreaElement>("[data-builder-welcome='0']")!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(line, "Hi, I'm Tomek. Let's get you moving.");
      line.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Save")!.click());
    await flush();
    expect(container.querySelector("[data-builder-refused]")?.textContent).toBe("Welcome line 1: a verdict: bad.");
    expect(sent("PUT /api/v2/chats/recipe")).toEqual({
      welcome: ["Hi, I'm Tomek. Let's get you moving."],
      questions: ARTURS_FIVE.map(({ title, q, answers }) => ({ title, q, answers })),
      answer_with: { tap: true, type: true, record: true },
      about: [],
    });

    // A kept recipe: its about, fit and model go back as they were, never its stamps.
    const kept = {
      welcome: ["Hi"],
      questions: [],
      answer_with: { tap: false, type: false, record: true },
      about: ["Tomek's specialization: Gymnastics."],
      fit: { coaches: "skill", needs: "moving", topics: [], skill: "gymnastics" },
      model: { automate: "no" },
      v: 1,
      updated_at: "2026-11-09T22:00:00Z",
    };
    routes["GET /api/v2/chats/recipe"] = () => json({ assistant: "Tomek's assistant", recipe: kept, starting_questions: ARTURS_FIVE });
    routes["PUT /api/v2/chats/recipe"] = () => json({ recipe: kept });
    act(() => root.unmount());
    root = createRoot(container);
    await render(createElement(AssistantBuilder, { onClose: () => undefined }));
    await act(async () => button("Save")!.click());
    await flush();
    expect(button("Saved")).toBeTruthy();
    const { v: _v, updated_at: _at, ...mine } = kept;
    expect(sent("PUT /api/v2/chats/recipe")).toEqual(mine);
  });

  it("HOST-N590-8: the joiner meets the host's welcome first, as the assistant's", async () => {
    const chat: Chat = { id: "c-1", kind: "team", title: "Tomek", subtitle: "", last: null };
    const welcome = {
      id: "m-1",
      mine: false,
      author: "Tomek",
      kind: "text",
      body: "Hi, I'm Tomek. Let's get you moving.",
      meta: { welcome: { i: 0 }, assistant: true },
      created_at: "2026-11-09T10:00:00Z",
    };
    routes["GET /api/v2/chats/c-1/messages"] = () => json({ messages: [welcome] });
    routes["GET /api/v2/chats/c-1/host"] = () =>
      json({
        host: {
          assistant: "Tomek's assistant",
          about: ["Tomek coaches gymnastics.", "In Tomek's chat you can practise your first handstand."],
          questions: [],
          answer_with: { tap: true, type: false, record: true },
        },
      });
    await render(createElement(ChatThread, { chat, onBack: () => undefined }));
    expect(container.querySelector("[data-host-about]")?.textContent).toBe(
      "Tomek coaches gymnastics.In Tomek's chat you can practise your first handstand.",
    );
    const says = container.querySelector("[data-assistant-says]")!;
    expect(says.textContent).toContain("Tomek's assistant");
    expect(says.textContent).toContain("Hi, I'm Tomek. Let's get you moving.");
    expect(says.querySelector("[data-assistant-mark]")).toBeTruthy();

    // No host (no ring, no recipe, or a backend without the route): as it was.
    for (const none of [() => json({ host: null }), undefined]) {
      if (none) routes["GET /api/v2/chats/c-1/host"] = none;
      else delete routes["GET /api/v2/chats/c-1/host"];
      act(() => root.unmount());
      root = createRoot(container);
      await render(createElement(ChatThread, { chat, onBack: () => undefined }));
      expect(container.querySelector("[data-host-about]")).toBeNull();
      expect(container.querySelector("[data-assistant-says]")).toBeNull();
      expect(container.textContent).toContain("Hi, I'm Tomek. Let's get you moving.");
    }
  });

  it("HOST-N582-10: Will's setup of my chat, one question at a time, in the backend's words", async () => {
    const row = (client_id: string, body: string, chat_setup: Record<string, unknown>, role = "bot") =>
      ({ client_id, role, kind: "text", body, metadata: { chat_setup }, client_created_at: "2026-11-09T10:00:00Z" }) as unknown as LoungeMessage;
    const offer = row("q-0", "What you know can earn tokens: by teaching the models in your field, and you can spend them on a chat of your own that shares what you know while you're away, if you want it.", { step: "offer", chips: ["Set up my chat"] });
    const welcomeQ = row("q-1", "What should people read first when they open your chat? Write it as you'd greet them.", { step: "welcome", chips: [] });
    const nav = row("q-2", "How should people answer you in your chat?", { step: "nav", chips: ["Record", "Type", "Tap answers", "Any of these"] });
    const live = row("q-3", "Your assistant is live. Everyone who joins through your link meets it.", { step: "live" });
    expect(chatSetupOf(row("a", "Record", { step: "answer", to: "q-2" }, "user"))).toBeNull();

    routes["POST /api/v2/chats/recipe/setup/answer"] = () => json({ messages: [{}] });
    routes["GET /api/v2/chats/recipe"] = () => json({ assistant: "Tomek's assistant", recipe: { welcome: [] }, starting_questions: [] });
    const reload = vi.fn(async () => undefined);
    let waiting: ReturnType<typeof willSetupWaiting> = null;
    function Will({ rows }: { rows: LoungeMessage[] }) {
      const [, setThinking] = useState(false);
      const chatSetup = useChatSetup(reload, setThinking);
      const join = { say: async () => undefined };
      waiting = willSetupWaiting(rows, join, chatSetup);
      const assistant = useAssistantInWill(true, reload);
      return createElement(
        "div",
        null,
        rows.map((m, i) =>
          createElement(ChatSetupBubble, {
            key: m.client_id,
            message: m,
            setup: chatSetupOf(m)!,
            open: i === rows.length - 1,
            onTap: (picked: string) => chatSetup.tap(m.client_id, picked),
            builder: assistant.builder,
          }),
        ),
        assistant.sheet,
      );
    }

    await render(createElement(Will, { rows: [offer] }));
    expect(container.textContent).toContain("What you know can earn tokens");
    await act(async () => button("Set up my chat")!.click());
    await flush();
    expect(sent("POST /api/v2/chats/recipe/setup/answer")).toEqual({ to: "q-0", picked: "Set up my chat" });
    expect(reload).toHaveBeenCalled();

    await render(createElement(Will, { rows: [offer, welcomeQ] }));
    expect(container.querySelector("[data-chat-setup-answers]")).toBeNull();
    expect(waiting).toMatchObject({ to: "q-1", words: true });
    await act(async () => waiting!.say("Hi, I'm Tomek. Let's get you moving."));
    expect(sent("POST /api/v2/chats/recipe/setup/answer")).toEqual({ to: "q-1", said: "Hi, I'm Tomek. Let's get you moving." });

    await render(createElement(Will, { rows: [offer, welcomeQ, nav] }));
    const taps = [...container.querySelectorAll("[data-chat-setup-answers] button")].map((b) => b.textContent);
    expect(taps.sort()).toEqual(["Any of these", "Record", "Tap answers", "Type"]);
    // A question of taps alone: typed words are an ordinary message to Will,
    // never sent to the setup (which refuses them) and lost.
    expect(waiting).toBeNull();
    await act(async () => button("Record")!.click());
    await flush();
    expect(sent("POST /api/v2/chats/recipe/setup/answer")).toEqual({ to: "q-2", picked: "Record" });

    await render(createElement(Will, { rows: [offer, welcomeQ, nav, live] }));
    expect(waiting).toBeNull();
    expect(container.textContent).toContain("Your assistant is live. Everyone who joins through your link meets it.");
    await act(async () => button("Set up my chat›")!.click());
    await flush();
    expect(container.querySelector("[data-assistant-builder]")).toBeTruthy();
  });

  it("HOST-N582-11: typed words the setup refuses come back; the offer, once scrolled away, begins the setup again", async () => {
    const row = (client_id: string, body: string, chat_setup: Record<string, unknown>) =>
      ({ client_id, role: "bot", kind: "text", body, metadata: { chat_setup }, client_created_at: "2026-11-09T10:00:00Z" }) as unknown as LoungeMessage;
    const offer = row("q-0", "What you know can earn tokens.", { step: "offer", chips: ["Set up my chat"] });
    const welcomeQ = row("q-1", "What should people read first when they open your chat?", { step: "welcome", chips: [] });
    const live = row("q-3", "Your assistant is live.", { step: "live" });
    const other = { client_id: "m-1", role: "bot", kind: "text", body: "Hello.", metadata: {}, client_created_at: "2026-11-09T10:01:00Z" } as unknown as LoungeMessage;
    routes["POST /api/v2/chats/recipe/setup/answer"] = () => json({ error: "Tap one of the answers." }, 400);
    routes["POST /api/v2/chats/recipe/setup"] = () => json({ started: true });
    const reload = vi.fn(async () => undefined);
    let waiting: ReturnType<typeof willSetupWaiting> = null;
    let begin: () => Promise<boolean> = async () => false;
    function Will({ rows }: { rows: LoungeMessage[] }) {
      const [, setThinking] = useState(false);
      const chatSetup = useChatSetup(reload, setThinking);
      begin = chatSetup.begin;
      waiting = willSetupWaiting(rows, { say: async () => undefined }, chatSetup);
      return createElement(
        "div",
        null,
        rows.map((m, i) => {
          const setup = chatSetupOf(m);
          return setup
            ? createElement(ChatSetupBubble, {
                key: m.client_id,
                message: m,
                setup,
                open: i === rows.length - 1,
                onTap: async () => undefined,
                onBegin: chatSetupCanBegin(rows) ? () => void begin() : undefined,
              })
            : createElement("p", { key: m.client_id }, m.body);
        }),
      );
    }

    await render(createElement(Will, { rows: [offer, welcomeQ] }));
    expect(await waiting!.say("Hi")).toBe(false); // refused: Will's chat puts the words back

    await render(createElement(Will, { rows: [offer] }));
    expect(button("Set up my chat›")).toBeUndefined(); // the newest bubble: its own tap

    await render(createElement(Will, { rows: [offer, other] }));
    await act(async () => button("Set up my chat›")!.click());
    await flush();
    expect(sent("POST /api/v2/chats/recipe/setup")).toEqual({});
    expect(reload).toHaveBeenCalled();

    await render(createElement(Will, { rows: [offer, other, live] }));
    expect(button("Set up my chat›")).toBeUndefined(); // live: the builder's way in instead
  });

  it("HOST-N586-5: Will offers the setup once, only to a tester with no recipe", async () => {
    const reload = vi.fn(async () => undefined);
    function Will() {
      const assistant = useAssistantInWill(true, reload);
      return createElement("div", null, assistant.builder);
    }
    // Without the ring: no offer, no way in.
    await render(createElement(Will));
    expect(calls("POST /api/v2/chats/recipe/setup/offer")).toHaveLength(0);

    // A tester with a recipe: no offer.
    resetAssistantInWill();
    routes["GET /api/v2/chats/recipe"] = () => json({ assistant: "Tomek's assistant", recipe: { welcome: ["Hi"] }, starting_questions: [] });
    act(() => root.unmount());
    root = createRoot(container);
    await render(createElement(Will));
    expect(calls("POST /api/v2/chats/recipe/setup/offer")).toHaveLength(0);

    // A tester with none: once, then never again on this device.
    resetAssistantInWill();
    routes["GET /api/v2/chats/recipe"] = () => json({ assistant: "Tomek's assistant", recipe: null, starting_questions: [] });
    routes["POST /api/v2/chats/recipe/setup/offer"] = () => json({ offered: true });
    act(() => root.unmount());
    root = createRoot(container);
    await render(createElement(Will));
    expect(calls("POST /api/v2/chats/recipe/setup/offer")).toHaveLength(1);
    expect(reload).toHaveBeenCalled();
    resetAssistantInWill();
    act(() => root.unmount());
    root = createRoot(container);
    await render(createElement(Will));
    expect(calls("POST /api/v2/chats/recipe/setup/offer")).toHaveLength(1);
  });
});
