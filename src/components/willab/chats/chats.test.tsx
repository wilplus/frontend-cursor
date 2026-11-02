// @vitest-environment jsdom
/*
STORY    As the founder testing the chats between users (ring 6), I want my
         chats in front of the Lounge, with Will first, so that I can open a
         colleague's or a customer's chat and answer with an emoji or a
         voice note; and as every other speaker, I want /chat to stay the
         Lounge as it is.
OUTCOME
  O1  Off (no `chats` in the ring's features_on): nothing is drawn around
      the Lounge and no chat is read (Never 3).
  O2  On: the list stands in front of the Lounge, Will pinned first, then
      the chats, newest last message first, each with its title, subtitle
      and last message (an emoji with its meaning); an empty list asks for
      the demo once. Will's row uncovers the Lounge, never remounted, with
      a back to the list (customer-requests.md C1; N274, N298, N322).
  O3  In a chat, the bar holds the three emoji in the box, no typing, and
      the mic beside it only while a question waits for my answer; a tap on
      an emoji posts {"kind":"emoji","body":…} and shows the emoji at once,
      large, with its meaning and time under it, and the mic goes (N306,
      N311, N322, N341).
  O4  The WillpowerLab bar shows on the list only: in a person's chat and
      in Will's, the chat's own top bar takes its place (N321 item 1, N334).
  O5  A chat whose last message is newer than the last time it was opened
      on this device shows as new, and stops being new once opened (N322).
  O6  The mic records with the one recording bar; Stop posts the recording
      (multipart audio and duration_ms) and the voice note joins the
      thread as my bubble; the bar comes back (N321 item 2, N314).
  O7  A voice note from the other person is their grey bubble with a play
      control that plays it from the chat's audio route (N321 item 2).
  O8  The + on the list opens my own link, with the add sheet's signed
      words, and Copy my link puts the whole link on the clipboard (N308,
      N310).
  O9  In a chat I joined through someone's link, one line above the
      messages says whose link it was (N335 item 2); a chat without it has
      no such line.
  O10 Just joined (/chat?with=<chat>), the list opens with the chat with
      the one who invited me as its first row, above Will's, marked new with
      the joined line, and the address is clean again; opened, it is a chat
      like the rest (N357; was N348 item 1).
PROVES   O1 -> "with chats off, the Lounge is all there is and no chat is read"
         O2 -> "with chats on, Will is pinned over the demo chats, and his row opens the Lounge with a way back"
         O3 -> "an emoji tapped in a chat is posted and shown at once with its meaning, and the mic goes with the question"
         O4 -> "the WillpowerLab bar shows on the list only: it hides in a person's chat and in Will's"
         O5 -> "a chat with a message newer than its last opening shows as new until it is opened"
         O6 -> "the mic records a voice note, Stop posts it and it joins the thread"
         O7 -> "a voice note from the other person plays from the chat's audio route"
         O8 -> "the + opens my own link and copies it"
         O9 -> "a chat joined through a link says whose link it was"
         O10 -> "after joining, the list opens with the one who invited me on top, marked new"
*/
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

import { resetRingStateCache } from "@/services/api/rings";
import { useChatsDoor } from "./useChatsDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SARAH = {
  id: "c-sarah",
  kind: "customer",
  title: "Sarah",
  subtitle: "Invita customer",
  last: { kind: "text", body: "Is the scalp scrub good for dry hair?", created_at: "2026-11-01T09:00:00Z" },
};
const ARIEL = {
  id: "c-ariel",
  kind: "team",
  title: "Ariel",
  subtitle: "Invita colleague",
  last: { kind: "emoji", body: "🙏", created_at: "2026-11-01T10:00:00Z" },
};

let container: HTMLDivElement;
let root: Root;
let loungeMounts = 0;
const fetchMock = vi.fn();
const routes = new Map<string, () => unknown>();

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

/** The backend: the ring read, then whatever each test answers per route. */
function backend(featuresOn: string[]) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(url)}`;
    if (String(url) === "/api/v2/user/rings") return reply({ ring: 6, features_on: featuresOn, pending_announcements: [] });
    const answer = routes.get(key);
    return answer ? reply(answer()) : reply({ error: "not found" }, 404);
  });
}

const calls = (key: string) => fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key);

/** The Lounge, standing in: counts its mounts. */
function Lounge() {
  const counted = useRef(false);
  if (!counted.current) {
    counted.current = true;
    loungeMounts += 1;
  }
  return createElement("div", { "data-testid": "lounge" }, "The Lounge");
}

/** As WillabSurface draws it: the WillpowerLab bar (hidden as the door
 *  says), then back, the Lounge, the front. */
function Surface() {
  const chats = useChatsDoor(false);
  return createElement(
    "div",
    null,
    createElement("header", { "data-navbar": "", hidden: !chats.navbar }, "WillpowerLab"),
    createElement("div", { "data-surface": "" }, chats.back, createElement(Lounge), chats.front),
  );
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

/** The phone's recorder, as the other tests of the voice note fake it. */
class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  start() {
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

beforeEach(async () => {
  resetRingStateCache();
  window.localStorage.clear();
  routes.clear();
  fetchMock.mockReset();
  loungeMounts = 0;
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  resetRingStateCache();
});

async function render() {
  await act(async () => root.render(createElement(Surface)));
  await flush();
}

const surface = () => container.querySelector("[data-surface]")!;
const navbar = () => container.querySelector<HTMLElement>("[data-navbar]")!;
const rows = () => [...container.querySelectorAll<HTMLButtonElement>("[data-chat-row]")];
const row = (id: string) => container.querySelector<HTMLButtonElement>(`[data-chat-row="${id}"]`);
const lastLineOf = (id: string) => row(id)?.querySelector("[data-chat-last]")?.textContent;
async function tap(el: Element | null | undefined) {
  if (!el) throw new Error(`nothing to tap in: ${container.innerHTML}`);
  await act(async () => (el as HTMLElement).click());
  await flush();
}

describe("the chats in front of the Lounge", () => {
  it("with chats off, the Lounge is all there is and no chat is read", async () => {
    backend(["tempo_step"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    await render();
    // The ring was read, and said no.
    expect(calls("GET /api/v2/user/rings")).toHaveLength(1);
    expect(surface().children).toHaveLength(1);
    expect(surface().firstElementChild?.getAttribute("data-testid")).toBe("lounge");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/v2/chats"))).toBe(false);
    expect(loungeMounts).toBe(1);
  });

  it("with chats on, Will is pinned over the demo chats, and his row opens the Lounge with a way back", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [] }));
    routes.set("POST /api/v2/chats/demo", () => ({ chats: [SARAH, ARIEL] }));
    await render();

    expect(container.querySelector("[data-chats-front]")).not.toBeNull();
    // Will first, then the newest last message first.
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-ariel", "c-sarah"]);
    expect(rows()[0].textContent).toBe("Will");
    expect(rows()[2].textContent).toContain("SarahInvita customer");
    expect(lastLineOf("c-sarah")).toBe("Is the scalp scrub good for dry hair?");
    expect(lastLineOf("c-ariel")).toBe("🙏 Thanks");
    expect(calls("POST /api/v2/chats/demo")).toHaveLength(1);

    await tap(rows()[0]);
    expect(container.querySelector("[data-chats-front]")).toBeNull();
    expect(container.querySelector("[data-testid=lounge]")).not.toBeNull();
    expect(container.querySelector("[data-chat-header]")?.textContent).toBe("Will");

    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    await tap(container.querySelector("[data-chat-header] button"));
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-ariel", "c-sarah"]);
    // The demo is asked for once; the Lounge was never mounted twice.
    expect(calls("POST /api/v2/chats/demo")).toHaveLength(1);
    expect(loungeMounts).toBe(1);
  });

  it("an emoji tapped in a chat is posted and shown at once with its meaning, and the mic goes with the question", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({
      messages: [{ id: "m1", mine: false, author: "Sarah", kind: "text", body: SARAH.last.body, meta: null, created_at: SARAH.last.created_at }],
    }));
    let release: () => void = () => {};
    const posted = new Promise<void>((resolve) => (release = resolve));
    await render();
    await tap(row("c-sarah"));

    const screen = container.querySelector("[data-chat-screen]")!;
    expect(screen.querySelector("[data-chat-header]")?.textContent).toContain("SarahInvita customer");
    expect(screen.querySelector("[data-chat-thread] [data-bubble]")?.textContent).toContain(SARAH.last.body);
    // Sarah's question waits: the three emoji in the box, the mic beside it, no typing.
    const bar = screen.querySelector("[data-chat-bar]")!;
    expect([...bar.querySelectorAll("button")].map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual([
      "👍",
      "👀",
      "🙏",
      "Voice note",
    ]);
    expect(screen.querySelector("textarea, input")).toBeNull();

    fetchMock.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      await posted;
      return new Response(
        JSON.stringify({ message: { id: "m2", mine: true, author: "Me", kind: "emoji", body: JSON.parse(String(init?.body)).body, meta: null, created_at: "2026-11-02T08:00:00Z" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    await tap([...bar.querySelectorAll("button")].find((b) => b.textContent === "👍"));
    const sent = () => [...screen.querySelectorAll("[data-chat-emoji]")].map((e) => e.textContent);
    expect(sent()).toEqual([expect.stringMatching(/^👍It's good · \d\d:\d\d$/)]);
    const post = fetchMock.mock.calls.at(-1)!;
    expect(post[0]).toBe("/api/v2/chats/c-sarah/messages");
    expect(post[1].method).toBe("POST");
    expect(JSON.parse(String(post[1].body))).toEqual({ kind: "emoji", body: "👍" });

    // Answered: nothing waits, so the mic goes (N341).
    expect(bar.querySelector('button[aria-label="Voice note"]')).toBeNull();

    release();
    await flush();
    expect(sent()).toEqual([expect.stringMatching(/^👍It's good · \d\d:\d\d$/)]);
  });

  it("the WillpowerLab bar shows on the list only: it hides in a person's chat and in Will's", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [] }));
    await render();
    expect(navbar().hidden).toBe(false);

    await tap(row("c-sarah"));
    expect(container.querySelector("[data-chat-screen]")).not.toBeNull();
    expect(navbar().hidden).toBe(true);

    await tap(container.querySelector("[data-chat-header] button"));
    expect(container.querySelector("[data-chat-list]")).not.toBeNull();
    expect(navbar().hidden).toBe(false);

    // Will's chat has its own top bar too (N334 item 1; was N322 item 4).
    await tap(row("will"));
    expect(navbar().hidden).toBe(true);
    expect(container.querySelector("[data-chat-header]")?.textContent).toBe("Will");
    await tap(container.querySelector("[data-chat-header] button"));
    expect(navbar().hidden).toBe(false);
  });

  it("a chat with a message newer than its last opening shows as new until it is opened", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [] }));
    // Ariel's chat was opened after her last message; Sarah's before hers.
    window.localStorage.setItem("willab.chats.opened.c-ariel", String(Date.parse(ARIEL.last.created_at) + 60_000));
    window.localStorage.setItem("willab.chats.opened.c-sarah", String(Date.parse(SARAH.last.created_at) - 60_000));
    await render();
    expect(row("c-sarah")?.hasAttribute("data-chat-new")).toBe(true);
    expect(row("c-ariel")?.hasAttribute("data-chat-new")).toBe(false);

    await tap(row("c-sarah"));
    await tap(container.querySelector("[data-chat-header] button"));
    expect(row("c-sarah")?.hasAttribute("data-chat-new")).toBe(false);
  });

  it("the mic records a voice note, Stop posts it and it joins the thread", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
      configurable: true,
    });
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    // Ariel's question waits for my answer, so the mic shows (N341).
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({
      messages: [{ id: "q1", mine: false, author: "Ariel", kind: "voice", body: "", meta: { question: true }, created_at: ARIEL.last.created_at }],
    }));
    routes.set("POST /api/v2/chats/c-ariel/voice", () => ({
      message: { id: "v1", mine: true, author: "Me", kind: "voice", body: "", meta: { duration_ms: 4200 }, created_at: "2026-11-02T08:00:00Z" },
    }));
    await render();
    await tap(row("c-ariel"));
    const screen = container.querySelector("[data-chat-screen]")!;

    await tap(screen.querySelector('[data-chat-bar] button[aria-label="Voice note"]'));
    // Recording: the one recording bar in the bar's place.
    expect(screen.querySelector("[data-chat-bar] [data-recording-bar] [data-walk-recording-strip]")).not.toBeNull();
    expect(screen.querySelector("[data-chat-emoji-box]")).toBeNull();

    await tap(screen.querySelector('[data-recording-bar] button[aria-label="Stop"]'));
    await flush();
    const posts = calls("POST /api/v2/chats/c-ariel/voice");
    expect(posts).toHaveLength(1);
    const form = posts[0][1].body as FormData;
    expect((form.get("audio") as Blob).type).toBe("audio/webm");
    expect(form.get("duration_ms")).toMatch(/^\d+$/);

    // The bar is back, without the mic: answered; the voice note is mine,
    // orange on the right, with its length.
    expect(screen.querySelector("[data-recording-bar]")).toBeNull();
    expect(screen.querySelector("[data-chat-emoji-box]")).not.toBeNull();
    expect(screen.querySelector("[data-chat-mic]")).toBeNull();
    const voice = screen.querySelector('[data-chat-thread] [data-row="me"][data-chat-voice]');
    expect(voice?.textContent).toMatch(/^0:04\d\d:\d\d$/);
  });

  it("a voice note from the other person plays from the chat's audio route", async () => {
    const played: string[] = [];
    vi.stubGlobal(
      "Audio",
      class {
        constructor(src: string) {
          played.push(src);
        }
        play() {
          return Promise.resolve();
        }
        pause() {}
      },
    );
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({
      messages: [{ id: "m9", mine: false, author: "Ariel", kind: "voice", body: "", meta: { duration_ms: 65_000 }, created_at: ARIEL.last.created_at }],
    }));
    await render();
    await tap(row("c-ariel"));

    const theirs = container.querySelector('[data-chat-thread] [data-row="app"] [data-bubble][data-chat-voice]');
    expect(theirs?.textContent).toMatch(/^1:05\d\d:\d\d$/);
    await tap(theirs?.querySelector('button[aria-label="Play"]'));
    expect(played).toEqual(["/api/v2/chats/c-ariel/messages/m9/audio"]);
    expect(theirs?.querySelector('button[aria-label="Pause"]')).not.toBeNull();
  });

  it("the + opens my own link and copies it", async () => {
    const copied: string[] = [];
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: async (t: string) => void copied.push(t) } });
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    routes.set("GET /api/v2/chats/link", () => ({ token: "AbCdEfGhIjKlMnOpQrStUvWx", path: "/c/AbCdEfGhIjKlMnOpQrStUvWx" }));
    await render();

    await tap(container.querySelector('[data-add-someone][aria-label="Add someone to chat with"]'));
    const sheet = container.querySelector("[data-add-sheet]")!;
    expect(sheet.textContent).toContain("Add someone to chat with");
    expect(sheet.textContent).toContain("Send them your link, in any email or message. Whoever opens it joins you here.");
    const link = `${window.location.origin}/c/AbCdEfGhIjKlMnOpQrStUvWx`;
    expect(sheet.querySelector("[data-my-link]")?.textContent).toBe(link);
    await tap(sheet.querySelector("[data-copy-link]"));
    expect(copied).toEqual([link]);
  });

  it("a chat joined through a link says whose link it was", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [], joined_through: "Ariel" }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [], joined_through: null }));
    await render();

    await tap(row("c-ariel"));
    expect(container.querySelector("[data-chat-joined]")?.textContent).toBe(
      "You joined through Ariel's link. Only the two of you are in this chat.",
    );
    await tap(container.querySelector("[data-chat-screen] button"));
    await tap(row("c-sarah"));
    expect(container.querySelector("[data-chat-joined]")).toBeNull();
  });

  it("after joining, the list opens with the one who invited me on top, marked new", async () => {
    window.history.replaceState(null, "", "/chat?with=c-ariel");
    backend(["chats"]);
    const joined = { ...ARIEL, last: null };
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, joined] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [], joined_through: "Ariel" }));
    await render();
    expect(container.querySelector("[data-chat-screen]")).toBeNull();
    const rows = [...container.querySelectorAll("[data-chat-row]")].map((r) => r.getAttribute("data-chat-row"));
    expect(rows.slice(0, 2)).toEqual(["c-ariel", "will"]);
    const top = container.querySelector('[data-chat-row="c-ariel"]')!;
    expect(top.hasAttribute("data-chat-new")).toBe(true);
    expect(top.querySelector("[data-chat-last]")?.textContent).toBe(
      "You joined through Ariel's link. Only the two of you are in this chat.",
    );
    expect(window.location.search).toBe("");
    await act(async () => (top as HTMLElement).click());
    expect(container.querySelector("[data-chat-name]")?.textContent).toBe("Ariel");
  });
});
