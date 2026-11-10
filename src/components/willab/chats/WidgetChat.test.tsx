// @vitest-environment jsdom
/*
STORY    As someone on a host's website, I want to write to them there at
         once, as their chat lets me, and sign up after asking to get their
         answer, so that the website chat is their own chat on the public
         side (backend N591, N595, N600; amending N567 and N569).
OUTCOME
  O1  The pill reads "Ask {name}"; opened, there is no consent card and no
      "Agree and start": nothing is sent until I write, and my first
      message makes my chat, kept in this browser (WID-13 as N595 item 1
      has it).
  O2  No fixed greeting and no fixed questions: the host's own welcome and
      their own questions come, tapped one at a time above the bar ("Yes"
      to "Are you in a hurry?" opens a date with Send); nothing says the
      host answers "out loud" (WID-14, WID-15, WID-16).
  O3  The bar follows the host's recipe, the same whether or not a question
      waits (N600): "+" on the left, the typing box in the middle when it
      takes words, else the three emoji; a small mic on the right only once
      recording is open to me, after the sign-up.
  O4  After asking, the sign-up step in N595's signed words: "To get
      {name}'s answer, sign up." and "The first notice of the answer comes
      to your phone or email. After that, this chat is yours.", with "Sign
      up" and "Not now"; Not now leaves "Sign up" by "with WillpowerLab"
      (WID-17, WID-18 as N591 replaces them; WID-29).
  O5  "Sign up" opens the join page in a new tab, carrying my chat (WID-29).
  O6  Signed up: "Signed up. The first notice of the answer comes to your
      phone." (or "… email."), and the host's voice answer shows with "Read
      it": closed by default, it opens the words and "Hide" closes them
      (WID-28, N576 item 1); a voice answer with no words shows none.
  O7  Only my browser holds my chat: every read and write carries my secret
      in its header, and a chat the backend no longer knows (a replaced
      link) is forgotten here (WID-25).
PROVES   O1 -> "WID-13: no consent card, and my first message makes my chat"
         O2 -> "WID-14, WID-15, WID-16: the host's welcome and own questions come, tapped above the bar, with no fixed ones"
         O3 -> "N600: the bar is +, the box and no mic before the sign-up, the same while a question waits"
         O3 -> "N600: with typing off, the three emoji in the middle"
         O3 -> "N600: signed up with recording open, a small mic on the right"
         O4 -> "WID-17, WID-18, WID-29: after asking, the sign-up step in N595's words, and Not now leaves Sign up by the foot"
         O5 -> "WID-29: Sign up opens the join page with my chat"
         O6 -> "WID-28: signed up, the line says where the notice goes, and the host's voice answer opens its words behind Read it"
         O7 -> "WID-25: every call carries my secret, and a chat the backend forgot is forgotten here"
WHY      The founder, 9 November 2026 (N591): "There's really no difference
         between the widget and the normal chat. It's just that the chat is
         placed on the public side."; 10 November (N595): the consent card,
         "drop!".
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WidgetChat from "./WidgetChat";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
const TAP_AND_TYPE = { tap: true, type: true, record: false };
const TAP_ONLY = { tap: true, type: false, record: false };
const WELCOME = {
  id: "w1", mine: false, author: "Tomek", kind: "text", body: "Welcome to my scalp clinic. Ask me anything about your scalp.",
  meta: { welcome: true }, created_at: "2026-11-09T10:00:00Z",
};
const HURRY = {
  id: "q0", mine: false, author: "Tomek", kind: "text", body: "Are you in a hurry?",
  meta: { setup: { i: 0, kind: "hurry", answers: ["No", "Yes"], multi: false } }, created_at: "2026-11-09T10:00:01Z",
};
const QUESTION = {
  id: "q1", mine: false, author: "Tomek", kind: "text", body: "Which languages can we use?",
  meta: { setup: { i: 1, kind: "tap", answers: ["Polish", "English"], multi: false } }, created_at: "2026-11-09T10:00:02Z",
};
const VOICE = {
  id: "v1", mine: false, author: "Tomek", kind: "voice", body: "", words: "We work in Polish and English.",
  meta: { duration_ms: 4000 }, created_at: "2026-11-09T11:00:00Z",
};
const SILENT = { ...VOICE, id: "v2", words: null };
const mine = (id: string, kind: string, body: string, meta: Record<string, unknown> = {}) => ({
  id, mine: true, author: "Widget / Visitor 1", kind, body, meta, created_at: "2026-11-09T10:01:00Z",
});

type Read = { writes?: unknown; messages?: unknown[]; signed_up?: boolean; sign_up?: boolean; answered?: boolean; notice?: string };
let startRead: Read;
let read: Read | null;
let container: HTMLDivElement;
let root: Root;
let calls: { method: string; url: string; body: unknown; guest: string | null }[];

const chat = (r: Read) => ({ name: "Tomek", writes: TAP_AND_TYPE, messages: [], signed_up: false, sign_up: false, answered: false, ...r });

beforeEach(() => {
  window.localStorage.clear();
  calls = [];
  startRead = { messages: [WELCOME, QUESTION] };
  read = { messages: [] };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body, guest: headers["X-Willab-Widget-Guest"] ?? null });
    const reply = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status });
    if (url.endsWith("/start")) return reply({ guest: "g1.secret", ...chat(startRead) });
    if (url.includes("/setup/")) return reply({ messages: [mine("a1", "text", "English", { setup_answer: { to: "q1" } })] });
    if (url.endsWith("/audio")) return new Response(new Blob(["x"]), { status: 200 });
    if (method === "POST" && url.endsWith("/messages")) {
      return reply({ message: mine(`m${calls.length}`, body.kind, body.body), sign_up: true });
    }
    return read ? reply(chat(read)) : reply({ code: "NOT_FOUND" }, 404);
  }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:voice", revokeObjectURL: () => {} }));
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
const tap = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await flush();
};
const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const typeIn = async (words: string) => {
  const box = container.querySelector<HTMLInputElement>("[data-widget-type] input");
  expect(box).toBeTruthy();
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(box, words);
    box!.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

async function openWidget(writes: unknown = TAP_AND_TYPE) {
  await act(async () => root.render(createElement(WidgetChat, { token: TOKEN, name: "Tomek", writes: writes as typeof TAP_AND_TYPE, site: "invitaheadspa.com" })));
  await flush();
  await tap(container.querySelector("[data-widget-pill]"));
}

/** The first message (it makes the chat), then the host's question answered. */
async function writeAndAnswer(first = "👍") {
  await tap(button(first) ?? container.querySelector("[data-widget-emoji] button"));
  await tap(button("English"));
}

async function typeAndSend(words: string) {
  await typeIn(words);
  await tap(container.querySelector("[data-widget-send]"));
}

describe("the website chat on someone's site", () => {
  it("WID-13: no consent card, and my first message makes my chat", async () => {
    await act(async () => root.render(createElement(WidgetChat, { token: TOKEN, name: "Tomek", writes: TAP_AND_TYPE, site: "invitaheadspa.com" })));
    expect(container.querySelector("[data-widget-pill]")?.textContent).toContain("Ask Tomek");
    await tap(container.querySelector("[data-widget-pill]"));
    expect(container.querySelector("[data-widget-consent]")).toBeNull();
    expect(container.textContent).not.toContain("Agree and start");
    expect(container.textContent).not.toContain("through WillpowerLab");
    expect(calls).toEqual([]);
    await typeAndSend("Do you work on Saturdays?");
    expect(calls[0]).toMatchObject({ method: "POST", url: `/api/v2/chats/widget/${TOKEN}/start`, body: { site: "invitaheadspa.com" }, guest: null });
    expect(calls[1]).toMatchObject({ method: "POST", url: `/api/v2/chats/widget/${TOKEN}/messages`, body: { kind: "text", body: "Do you work on Saturdays?" }, guest: "g1.secret" });
    expect(window.localStorage.getItem(`wpl-widget:${TOKEN}`)).toBe("g1.secret");
    expect(container.querySelector("[data-widget-thread]")?.textContent).toContain("Do you work on Saturdays?");
  });

  it("WID-14, WID-15, WID-16: the host's welcome and own questions come, tapped above the bar, with no fixed ones", async () => {
    startRead = { messages: [WELCOME, HURRY] };
    await openWidget();
    expect(container.textContent).not.toContain("Hi, I'm Tomek");
    await typeAndSend("Hello");
    const thread = container.querySelector("[data-widget-thread]")!.textContent;
    expect(thread).toContain("Welcome to my scalp clinic. Ask me anything about your scalp.");
    expect(thread).toContain("Are you in a hurry?");
    await tap(button("Yes"));
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
    expect(button("Send")).toBeTruthy();
    for (const gone of ["out loud", "What would you like to ask", "What do you do?", "How do you work with people?", "Can we talk?", "Record your answer"]) {
      expect(container.textContent).not.toContain(gone);
    }
  });

  it("N600: the bar is +, the box and no mic before the sign-up, the same while a question waits", async () => {
    await openWidget();
    const bar = () => container.querySelector("[data-widget-bar]")!;
    // Before my chat exists: the box; "+" comes with the chat.
    expect(bar().querySelector("[data-widget-type] input")).not.toBeNull();
    expect(bar().querySelector("[data-widget-emoji]")).toBeNull();
    expect(bar().querySelector("[data-widget-mic]")).toBeNull();
    await typeAndSend("Hello");
    // The host's question waits: its taps sit above the same bar.
    expect(container.querySelector("[data-widget-answers]")).not.toBeNull();
    const asked = bar().innerHTML;
    expect(bar().querySelector("[data-widget-plus]")).not.toBeNull();
    expect(bar().querySelector("[data-widget-type] input")).not.toBeNull();
    expect(bar().querySelector("[data-widget-mic]")).toBeNull();
    await tap(button("English"));
    await tap(button("Not now"));
    expect(bar().innerHTML).toBe(asked);
  });

  it("N600: with typing off, the three emoji in the middle", async () => {
    startRead = { writes: TAP_ONLY, messages: [WELCOME, QUESTION] };
    await openWidget(TAP_ONLY);
    await writeAndAnswer();
    expect(container.querySelector("[data-widget-type]")).toBeNull();
    expect(container.querySelector("[data-widget-emoji]")?.textContent).toBe("👍👀🙏");
    expect(calls[1]).toMatchObject({ method: "POST", body: { kind: "emoji", body: "👍" } });
  });

  it("N600: signed up with recording open, a small mic on the right", async () => {
    const opened = vi.fn();
    vi.stubGlobal("open", opened);
    window.localStorage.setItem(`wpl-widget:${TOKEN}`, "g1.secret");
    read = { writes: { tap: true, type: true, record: true }, messages: [WELCOME], signed_up: true };
    await openWidget();
    const bar = container.querySelector("[data-widget-bar]")!;
    expect([...bar.children].map((c) => (c.hasAttribute("data-widget-plus") ? "+" : c.hasAttribute("data-widget-type") ? "box" : c.hasAttribute("data-widget-mic") ? "mic" : "?"))).toEqual(["+", "box", "mic"]);
    await tap(bar.querySelector("[data-widget-mic]"));
    expect(opened).toHaveBeenCalledWith(`${window.location.origin}/chat`, "_blank", "noopener");
  });

  it("WID-17, WID-18, WID-29: after asking, the sign-up step in N595's words, and Not now leaves Sign up by the foot", async () => {
    await openWidget();
    await typeAndSend("Do you work on Saturdays?");
    await tap(button("English"));
    const step = container.querySelector("[data-widget-sign-up]");
    expect(step?.querySelector("[data-widget-sign-up-line]")?.textContent).toBe("To get Tomek's answer, sign up.");
    expect(step?.textContent).toContain("The first notice of the answer comes to your phone or email. After that, this chat is yours.");
    expect(button("Sign up")).toBeTruthy();
    expect(container.textContent).not.toContain("call you");
    await tap(button("Not now"));
    expect(container.querySelector("[data-widget-sign-up]")).toBeNull();
    expect(container.querySelector("[data-widget-foot]")?.textContent).toBe("Sign upwith WillpowerLab");
  });

  it("WID-29: Sign up opens the join page with my chat", async () => {
    const opened = vi.fn();
    vi.stubGlobal("open", opened);
    window.localStorage.setItem(`wpl-widget:${TOKEN}`, "g1.secret");
    read = { messages: [WELCOME, mine("k1", "text", "Do you work on Saturdays?")], sign_up: true, answered: true };
    await openWidget();
    expect(container.querySelector("[data-widget-sign-up-line]")?.textContent).toBe("To get Tomek's answer, sign up.");
    await tap(button("Sign up"));
    expect(opened).toHaveBeenCalledWith(`${window.location.origin}/c/${TOKEN}?from=widget#g=g1.secret`, "_blank", "noopener");
  });

  it("WID-28: signed up, the line says where the notice goes, and the host's voice answer opens its words behind Read it", async () => {
    window.localStorage.setItem(`wpl-widget:${TOKEN}`, "g1.secret");
    read = { messages: [VOICE, SILENT], signed_up: true, notice: "phone" };
    await openWidget();
    expect(container.querySelector("[data-widget-sign-up]")).toBeNull();
    expect(container.querySelector("[data-widget-signed-up]")?.textContent).toBe("Signed up. The first notice of the answer comes to your phone.");
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
    read = { messages: [VOICE], signed_up: true, notice: "email" };
    await tap(container.querySelector("[data-widget-close]"));
    await tap(container.querySelector("[data-widget-pill]"));
    expect(container.querySelector("[data-widget-signed-up]")?.textContent).toBe("Signed up. The first notice of the answer comes to your email.");
  });

  it("WID-25: every call carries my secret, and a chat the backend forgot is forgotten here", async () => {
    window.localStorage.setItem(`wpl-widget:${TOKEN}`, "g1.secret");
    read = { messages: [VOICE], signed_up: true };
    await openWidget();
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.guest).toBe("g1.secret");
    expect(calls.some((c) => c.url === `/api/v2/chats/widget/${TOKEN}/messages/v1/audio`)).toBe(true);
    read = null;
    await tap(container.querySelector("[data-widget-close]"));
    await tap(container.querySelector("[data-widget-pill]"));
    expect(window.localStorage.getItem(`wpl-widget:${TOKEN}`)).toBeNull();
    expect(container.querySelector("[data-widget-voice]")).toBeNull();
  });
});
