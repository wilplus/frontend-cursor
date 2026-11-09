// @vitest-environment jsdom
/*
STORY    As a customer on someone's website, I want to ask them with a few
         taps and hear their answer there, without an account (backend N567).
OUTCOME
  O1  The pill reads "Ask {name}"; opened, nothing is sent until I tap
      "Agree and start", and then my chat is kept in this browser.
  O2  I tap the owner's question, then one of the three questions; the
      chat then says the owner answers out loud and to come back, and the
      questions wait.
  O3  "Keep this chat" opens the join page in a new tab, carrying my chat.
  O4  The owner's voice answer with words has "Read it" under its player:
      closed by default, it opens the words and "Hide" closes them (N331,
      N576 item 1); a voice answer with no words shows none.
PROVES   O1 -> "the pill asks, and nothing is sent before Agree and start"
         O2 -> "I tap through the owner's question and ask one of three"
         O3 -> "Keep this chat opens the join page with my chat"
         O4 -> "the owner's voice answer opens its words behind Read it, and Hide closes them"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WidgetChat from "./WidgetChat";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
const ASKS = ["What do you do?", "How do you work with people?", "Can we talk?"];
const QUESTION = {
  id: "q1", mine: false, author: "Tomek", kind: "text", body: "Which languages can we use?",
  meta: { setup: { i: 0, kind: "tap", answers: ["Polish", "English"], multi: false } }, created_at: "2026-11-05T10:00:00Z",
};
const VOICE = {
  id: "v1", mine: false, author: "Tomek", kind: "voice", body: "", words: "We work in Polish and English.",
  meta: { duration_ms: 4000 }, created_at: "2026-11-05T11:00:00Z",
};
const SILENT = { ...VOICE, id: "v2", words: null };
let startMessages: unknown[] = [QUESTION];
const mine = (id: string, body: string, meta: Record<string, unknown> = {}) => ({
  id, mine: true, author: "Widget / Visitor 1", kind: "text", body, meta, created_at: "2026-11-05T10:01:00Z",
});

let container: HTMLDivElement;
let root: Root;
let calls: { method: string; url: string; body: unknown; guest: string | null }[];

beforeEach(() => {
  window.localStorage.clear();
  calls = [];
  startMessages = [QUESTION];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body, guest: headers["X-Willab-Widget-Guest"] ?? null });
    const reply = (json: unknown) => new Response(JSON.stringify(json), { status: 200 });
    if (url.endsWith("/start")) return reply({ guest: "g1.secret", name: "Tomek", asks: ASKS, kept: false, messages: startMessages });
    if (url.includes("/setup/")) return reply({ messages: [mine("a1", "English", { setup_answer: { to: "q1" } })] });
    if (url.endsWith("/ask")) return reply({ message: mine("k1", ASKS[2], { widget_ask: 2 }) });
    return reply({ name: "Tomek", asks: ASKS, kept: false, messages: [] });
  }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const tap = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
};
const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);

async function openWidget() {
  await act(async () => root.render(createElement(WidgetChat, { token: TOKEN, name: "Tomek", asks: ASKS, site: "invitaheadspa.com" })));
  await tap(container.querySelector("[data-widget-pill]"));
}

describe("the widget on someone's website", () => {
  it("the pill asks, and nothing is sent before Agree and start", async () => {
    await act(async () => root.render(createElement(WidgetChat, { token: TOKEN, name: "Tomek", asks: ASKS, site: "invitaheadspa.com" })));
    expect(container.querySelector("[data-widget-pill]")?.textContent).toContain("Ask Tomek");
    await tap(container.querySelector("[data-widget-pill]"));
    expect(container.textContent).toContain("Hi, I'm Tomek. Tap to answer, and I'll answer you out loud.");
    expect(container.textContent).toContain("Your taps go to Tomek through WillpowerLab.");
    expect(calls).toEqual([]);
    await tap(container.querySelector("[data-widget-agree]"));
    expect(calls[0]).toMatchObject({ method: "POST", body: { site: "invitaheadspa.com" } });
    expect(window.localStorage.getItem(`wpl-widget:${TOKEN}`)).toBe("g1.secret");
  });

  it("I tap through the owner's question and ask one of three", async () => {
    await openWidget();
    await tap(container.querySelector("[data-widget-agree]"));
    expect(container.textContent).toContain("Which languages can we use?");
    await tap(button("English"));
    expect(calls.at(-1)).toMatchObject({ url: expect.stringContaining("/setup/q1"), body: { picked: ["English"] }, guest: "g1.secret" });
    expect(container.textContent).toContain("What would you like to ask Tomek?");
    await tap(button("Can we talk?"));
    expect(calls.at(-1)).toMatchObject({ url: expect.stringContaining("/ask"), body: { i: 2 } });
    expect(container.textContent).toContain("Tomek answers out loud when there's a moment. Come back here to listen.");
    expect(button("What do you do?")).toBeUndefined();
  });

  it("Keep this chat opens the join page with my chat", async () => {
    const opened = vi.fn();
    vi.stubGlobal("open", opened);
    await openWidget();
    await tap(container.querySelector("[data-widget-agree]"));
    await tap(button("English"));
    await tap(button("Can we talk?"));
    await tap(container.querySelector("[data-widget-keep-open]"));
    expect(container.textContent).toContain("Join WillpowerLab to keep it, and hear Tomek's answers on your phone.");
    await tap(container.querySelector("[data-widget-google]"));
    expect(opened).toHaveBeenCalledWith(`${window.location.origin}/c/${TOKEN}?from=widget#g=g1.secret`, "_blank", "noopener");
  });

  it("the owner's voice answer opens its words behind Read it, and Hide closes them", async () => {
    startMessages = [VOICE, SILENT];
    await openWidget();
    await tap(container.querySelector("[data-widget-agree]"));
    const [spoken, silent] = [...container.querySelectorAll("[data-widget-voice]")];
    expect(spoken).toBeTruthy();
    expect(spoken.textContent).not.toContain("We work in Polish and English.");
    await tap(spoken.querySelector("[data-chat-read]"));
    expect(spoken.querySelector("[data-chat-words]")?.textContent).toBe("We work in Polish and English.");
    expect(spoken.querySelector("[data-chat-read]")?.textContent).toBe("Hide");
    await tap(spoken.querySelector("[data-chat-read]"));
    expect(spoken.querySelector("[data-chat-words]")).toBeNull();
    expect(spoken.querySelector("[data-chat-read]")?.textContent).toBe("Read it");
    expect(silent.querySelector("[data-chat-read]")).toBeNull();
  });
});
