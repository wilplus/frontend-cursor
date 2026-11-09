// @vitest-environment jsdom
/*
STORY    As someone on a host's website, I want to write to them there, as
         their chat lets me, and sign up after asking to get their answer, so
         that the website chat is their own chat on the public side (backend
         N591, amending N567 and N569).
OUTCOME
  O1  The pill reads "Ask {name}"; opened, nothing is sent until I tap
      "Agree and start" under "Your taps go to {name} through WillpowerLab."
      and "Privacy"; then my chat is kept in this browser (WID-13).
  O2  No fixed greeting and no fixed questions: the host's own welcome and
      their own questions come first, tapped one at a time ("Yes" to "Are
      you in a hurry?" opens a date with Send); nothing says the host
      answers "out loud" (WID-14, WID-15, WID-16).
  O3  Then I write as the host's setup allows: the three emoji, and, when
      typing is on, "Write to {name}" with Send; with typing off there is
      no box to type in (N591 item 2).
  O4  After asking, the sign-up step: "Sign up to get {name}'s answer, by
      email or on your phone." with "Sign up" and "Not now"; Not now leaves
      "Sign up ›" by "with WillpowerLab" (WID-17, WID-18 as N591 replaces
      them; WID-29).
  O5  While the host's answer waits behind the sign-up, the step says
      "{name} has answered. Sign up to see it."; "Sign up" opens the join
      page in a new tab, carrying my chat (WID-29).
  O6  Signed up, the host's voice answer shows here with "Read it": closed
      by default, it opens the words and "Hide" closes them (WID-28, N576
      item 1); a voice answer with no words shows none.
  O7  Only my browser holds my chat: every read and write carries my secret
      in its header, and a chat the backend no longer knows (a replaced
      link) is forgotten here (WID-25).
PROVES   O1 -> "WID-13: the pill asks, and nothing is sent before Agree and start"
         O2 -> "WID-14, WID-15, WID-16: the host's welcome and own questions come first, tapped, with no fixed ones"
         O3 -> "N591 item 2: I write as the host's setup allows, emoji and typed words"
         O3 -> "N591 item 2: with typing off, only the emoji"
         O4 -> "WID-17, WID-18, WID-29: after asking, the sign-up step, and Not now leaves Sign up by the foot"
         O5 -> "WID-29: an answer waiting behind the sign-up, and Sign up opens the join page with my chat"
         O6 -> "WID-28: signed up, the host's voice answer opens its words behind Read it, and Hide closes them"
         O7 -> "WID-25: every call carries my secret, and a chat the backend forgot is forgotten here"
WHY      The founder, 9 November 2026 (N591): "There's really no difference
         between the widget and the normal chat. It's just that the chat is
         placed on the public side."
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

type Read = { writes?: unknown; messages?: unknown[]; signed_up?: boolean; sign_up?: boolean; answered?: boolean };
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

async function agreeAndAnswer() {
  await tap(container.querySelector("[data-widget-agree]"));
  await tap(button("English"));
}

describe("the website chat on someone's site", () => {
  it("WID-13: the pill asks, and nothing is sent before Agree and start", async () => {
    await act(async () => root.render(createElement(WidgetChat, { token: TOKEN, name: "Tomek", writes: TAP_AND_TYPE, site: "invitaheadspa.com" })));
    expect(container.querySelector("[data-widget-pill]")?.textContent).toContain("Ask Tomek");
    await tap(container.querySelector("[data-widget-pill]"));
    expect(container.querySelector("[data-widget-consent] p")?.textContent).toBe("Your taps go to Tomek through WillpowerLab. Privacy");
    expect(button("Agree and start")).toBeTruthy();
    expect(calls).toEqual([]);
    await tap(container.querySelector("[data-widget-agree]"));
    expect(calls[0]).toMatchObject({ method: "POST", url: `/api/v2/chats/widget/${TOKEN}/start`, body: { site: "invitaheadspa.com" }, guest: null });
    expect(window.localStorage.getItem(`wpl-widget:${TOKEN}`)).toBe("g1.secret");
  });

  it("WID-14, WID-15, WID-16: the host's welcome and own questions come first, tapped, with no fixed ones", async () => {
    startRead = { messages: [WELCOME, HURRY] };
    await openWidget();
    expect(container.textContent).not.toContain("Hi, I'm Tomek");
    await tap(container.querySelector("[data-widget-agree]"));
    const thread = container.querySelector("[data-widget-thread]")!.textContent;
    expect(thread).toContain("Welcome to my scalp clinic. Ask me anything about your scalp.");
    expect(thread).toContain("Are you in a hurry?");
    // Nothing to write until the host's question is answered.
    expect(container.querySelector("[data-widget-emoji]")).toBeNull();
    await tap(button("Yes"));
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
    expect(button("Send")).toBeTruthy();
    for (const gone of ["out loud", "What would you like to ask", "What do you do?", "How do you work with people?", "Can we talk?", "Record your answer"]) {
      expect(container.textContent).not.toContain(gone);
    }
  });

  it("N591 item 2: I write as the host's setup allows, emoji and typed words", async () => {
    await openWidget();
    await agreeAndAnswer();
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: `/api/v2/chats/widget/${TOKEN}/setup/q1`, body: { picked: ["English"] }, guest: "g1.secret" });
    const box = container.querySelector<HTMLInputElement>("[data-widget-type] input");
    expect(box?.placeholder).toBe("Write to Tomek");
    await typeIn("Do you work on Saturdays?");
    await tap(container.querySelector("[data-widget-send]"));
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: `/api/v2/chats/widget/${TOKEN}/messages`, body: { kind: "text", body: "Do you work on Saturdays?" }, guest: "g1.secret" });
    expect(container.querySelector("[data-widget-thread]")?.textContent).toContain("Do you work on Saturdays?");
    await tap(button("Not now"));
    await tap(button("👍"));
    expect(calls.at(-1)).toMatchObject({ method: "POST", body: { kind: "emoji", body: "👍" } });
  });

  it("N591 item 2: with typing off, only the emoji", async () => {
    startRead = { writes: TAP_ONLY, messages: [WELCOME, QUESTION] };
    await openWidget(TAP_ONLY);
    await agreeAndAnswer();
    expect(container.querySelector("[data-widget-type]")).toBeNull();
    expect(container.querySelector("[data-widget-emoji]")?.textContent).toBe("👍👀🙏");
  });

  it("WID-17, WID-18, WID-29: after asking, the sign-up step, and Not now leaves Sign up by the foot", async () => {
    await openWidget();
    await agreeAndAnswer();
    expect(container.querySelector("[data-widget-sign-up]")).toBeNull();
    await tap(button("🙏"));
    const step = container.querySelector("[data-widget-sign-up]");
    expect(step?.querySelector("p")?.textContent).toBe("Sign up to get Tomek's answer, by email or on your phone.");
    expect(button("Sign up")).toBeTruthy();
    expect(container.textContent).not.toContain("call you");
    await tap(button("Not now"));
    expect(container.querySelector("[data-widget-sign-up]")).toBeNull();
    expect(container.querySelector("[data-widget-foot]")?.textContent).toBe("Sign up ›with WillpowerLab");
    expect(container.querySelector("[data-widget-emoji]")).not.toBeNull();
  });

  it("WID-29: an answer waiting behind the sign-up, and Sign up opens the join page with my chat", async () => {
    const opened = vi.fn();
    vi.stubGlobal("open", opened);
    window.localStorage.setItem(`wpl-widget:${TOKEN}`, "g1.secret");
    read = { messages: [WELCOME, mine("k1", "text", "Do you work on Saturdays?")], sign_up: true, answered: true };
    await openWidget();
    expect(container.querySelector("[data-widget-sign-up] p")?.textContent).toBe("Tomek has answered. Sign up to see it.");
    await tap(button("Sign up"));
    expect(opened).toHaveBeenCalledWith(`${window.location.origin}/c/${TOKEN}?from=widget#g=g1.secret`, "_blank", "noopener");
  });

  it("WID-28: signed up, the host's voice answer opens its words behind Read it, and Hide closes them", async () => {
    window.localStorage.setItem(`wpl-widget:${TOKEN}`, "g1.secret");
    read = { messages: [VOICE, SILENT], signed_up: true };
    await openWidget();
    expect(container.querySelector("[data-widget-sign-up]")).toBeNull();
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
    expect(container.querySelector("[data-widget-consent]")).not.toBeNull();
  });
});
