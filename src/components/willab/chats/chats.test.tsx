// @vitest-environment jsdom
/*
STORY    As the founder testing the chats between users (ring 6), I want my
         chats in front of the Lounge, with Will first, so that I can open a
         colleague's or a customer's chat, answer with an emoji or a voice
         note, and start something new with a photo or a file; and as every
         other speaker, I want /chat to stay the Lounge as it is.
OUTCOME
  O1  Off (no `chats` in the ring's features_on): nothing is drawn around
      the Lounge and no chat is read (Never 3).
  O2  On: the list stands in front of the Lounge, Will pinned first, then
      the chats, newest last message first, each with its title, subtitle
      and last message (an emoji with its meaning); an empty list asks for
      the demo once. Will's row uncovers the Lounge, never remounted, with
      a back to the list (customer-requests.md C1; N274, N298, N322).
  O3  In a chat, one bar: the "+" left, the three emoji in the box, no
      typing, and the mic always on the right, orange while a question waits
      for my answer (N368; was N341: only then); a tap on
      an emoji posts {"kind":"emoji","body":…} and shows the emoji at once,
      large, with its meaning and time under it, and the mic is plain again
      (N306, N311, N322, N368).
  O4  The WillpowerLab bar shows on the list only: in a person's chat and
      in Will's, the chat's own top bar takes its place (N321 item 1, N334).
  O5  A chat whose last message is newer than the last time it was opened
      on this device shows as new, and stops being new once opened (N322).
  O6  The mic records with the one recording bar; Stop posts the recording
      (multipart audio and duration_ms) and the voice note joins the
      thread as my bubble; the bar comes back (N321 item 2, N314).
  O7  A voice note from the other person is their grey bubble with a play
      control that plays it from the chat's audio route (N321 item 2); its
      words, once ready, are closed behind "Read it" under the player, and
      "Hide" closes them again (N331).
  O8  The + on the list opens my own link, with the add sheet's signed
      words and its three steps, and Copy my link puts the whole link on
      the clipboard and says "✓ Copied" (N308, N310, N367).
  O9  In a chat I joined through someone's link, one line above the
      messages says whose link it was (N335 item 2); a chat without it has
      no such line.
  O10 Just joined (/chat?with=<chat>), the list opens with Will's row
      first, as always, and right under it the chat with the one who invited
      me, marked new with the joined line; the address is clean again;
      opened, it is a chat like the rest (N357, N360; was N348 item 1, and
      N357's inviter above Will).
  O11 In the iPhone app the Lounge never shows for a moment before the list
      covers it: the rings and the chats are asked together at boot, and
      the loader stands in front until both have answered (N354).
  O12 The "+" in a chat swaps the bar for four tiles with their names,
      Photos, Camera, Files and Someone else; Someone else opens the add
      sheet with my link; Cancel brings the bar back (N351).
  O13 A photo I pick is posted to the chat's photo route and joins the
      thread as my image; the mic then turns orange, so I can say what I
      need, and is plain once my voice note is sent (N337, N341 item 2,
      N351, N368).
  O14 The other person's photo or file waits for my voice: the mic is orange. A
      file shows a tile with its extension and its own name, and downloads
      from the chat's file route; a photo opens full size with a close and
      no words; the list's line is "📷", or "📄" and the file's name (N351).
  O15 An answer sent to me is one message (N355): its voice, the slides it
      was said over in a strip that marks the one being heard as it plays,
      and its words closed behind "Read it"; no Take number.
  O16 A question Will marked as about a product or a treatment takes one
      black "Record an answer" in the bar's middle, the "+" and the mic on its
      sides (N321 item 4, N361, N368); it hands the recording screens the
      chat, the person and the question. Back from them, the bar's middle
      reads "Sending to {name}… {n}" with Undo, then
      it goes and "Sent to {name} on WhatsApp" (a customer) stands under it
      (N345, N342).
PROVES   O1 -> "with chats off, the Lounge is all there is and no chat is read"
         O2 -> "with chats on, Will is pinned over the demo chats, and his row opens the Lounge with a way back"
         O3 -> "an emoji tapped in a chat is posted and shown at once with its meaning, and the mic goes with the question"
         O4 -> "the WillpowerLab bar shows on the list only: it hides in a person's chat and in Will's"
         O5 -> "a chat with a message newer than its last opening shows as new until it is opened"
         O6 -> "the mic records a voice note, Stop posts it and it joins the thread"
         O7 -> "a voice note from the other person plays from the chat's audio route, its words behind Read it"
         O8 -> "the + opens my own link and copies it"
         O9 -> "a chat joined through a link says whose link it was"
         O10 -> "after joining, the list opens with Will first and the one who invited me under him, marked new"
         O11 -> "in the app, the loader, not the Lounge, waits for the list; both reads start together"
         O12 -> "the + shows the four tiles, Someone else opens my link, and Cancel brings the bar back"
         O13 -> "a photo I send joins the thread and the mic shows until my voice note says what I need"
         O14 -> "the other person's photo or file waits for my voice, and each opens from the chat's file route"
         O15 -> "an answer sent to me plays with its slides following the voice, its words behind Read it"
         O16 -> "a marked question takes Record an answer, and my answer goes with Sending, Undo and Sent"
*/
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
const native = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => native.on }));

import { resetRingStateCache } from "@/services/api/rings";
import { __resetBootPrefetchForTests, prefetchChatsDoor } from "@/services/api/bootPrefetch";
import { useChatsDoor } from "./useChatsDoor";
import { UNDO_MS, answerRecorded, answerTake, forgetAnswers, startAnswer, type AnswerFor } from "@/lib/willab/chatAnswer";

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
const recordedAnswers: AnswerFor[] = [];
function Surface() {
  const chats = useChatsDoor(false, (answer) => recordedAnswers.push(answer));
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
  __resetBootPrefetchForTests();
  native.on = false;
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

/** The browser's own picker answering with these files. */
async function pick(input: Element | null, files: File[]) {
  if (!input) throw new Error(`no picker in: ${container.innerHTML}`);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => void input.dispatchEvent(new Event("change", { bubbles: true })));
  await flush();
}

/** The phone's microphone, granted, recording with the FakeRecorder. */
function micGranted() {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    configurable: true,
  });
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

  it("the iPhone's back swipe goes back by one, to the list, and never off the list", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [] }));
    await render();
    const swipe = (steps: number) =>
      act(async () => {
        const popped = new Promise((done) => window.addEventListener("popstate", done, { once: true }));
        window.history.go(-steps);
        await popped;
        for (let i = 0; i < 12; i += 1) await Promise.resolve();
      });
    const onList = () => rows().map((r) => r.getAttribute("data-chat-row"));

    // Will's chat: one swipe, the list.
    await tap(rows()[0]);
    expect(container.querySelector("[data-chat-header]")?.textContent).toBe("Will");
    await swipe(1);
    expect(onList()).toEqual(["will", "c-ariel", "c-sarah"]);

    // A person's chat, swiped abruptly (two steps at once): still the list.
    await tap(rows()[2]);
    expect(container.querySelector("[data-chat-header]")).not.toBeNull();
    await swipe(2);
    expect(onList()).toEqual(["will", "c-ariel", "c-sarah"]);

    // From the list, Back goes nowhere.
    await swipe(1);
    expect(onList()).toEqual(["will", "c-ariel", "c-sarah"]);
    expect((window.history.state as Record<string, unknown>).__willabBackStop).toBe(true);
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
    // Sarah's question waits: the "+", the three emoji in the box, the mic orange beside it, no typing.
    const bar = screen.querySelector("[data-chat-bar]")!;
    expect([...bar.querySelectorAll("button")].map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual([
      "Add to your chat with Sarah",
      "👍",
      "👀",
      "🙏",
      "Voice note",
    ]);
    expect(screen.querySelector("textarea, input:not([type=file])")).toBeNull();
    expect(bar.querySelector("[data-chat-mic-hot]")).not.toBeNull();

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

    // Answered: nothing waits, so the mic stays, no longer orange (N368).
    expect(bar.querySelector('button[aria-label="Voice note"]')).not.toBeNull();
    expect(bar.querySelector("[data-chat-mic-hot]")).toBeNull();

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
    micGranted();
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

    // The bar is back, the mic no longer orange: answered; the voice note is
    // mine, orange on the right, with its length.
    expect(screen.querySelector("[data-recording-bar]")).toBeNull();
    expect(screen.querySelector("[data-chat-emoji-box]")).not.toBeNull();
    expect(screen.querySelector("[data-chat-mic-hot]")).toBeNull();
    const voice = screen.querySelector('[data-chat-thread] [data-row="me"][data-chat-voice]');
    expect(voice?.textContent).toMatch(/^0:04\d\d:\d\d$/);
  });

  it("a voice note from the other person plays from the chat's audio route, its words behind Read it", async () => {
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
      messages: [
        { id: "m9", mine: false, author: "Ariel", kind: "voice", body: "", meta: { duration_ms: 65_000 }, created_at: ARIEL.last.created_at, words: "Name the treatment first." },
        { id: "m10", mine: true, author: "Me", kind: "voice", body: "", meta: { duration_ms: 3_000 }, created_at: ARIEL.last.created_at, words: null },
      ],
    }));
    await render();
    await tap(row("c-ariel"));

    const theirs = container.querySelector('[data-chat-thread] [data-row="app"] [data-bubble][data-chat-voice]');
    expect(theirs?.textContent).toMatch(/^1:05\d\d:\d\dRead it$/);
    // The words, closed by default; Read it opens them in the bubble, Hide closes them (N331).
    expect(theirs?.querySelector("[data-chat-words]")).toBeNull();
    await tap(theirs?.querySelector("[data-chat-read]"));
    expect(theirs?.querySelector("[data-chat-words]")?.textContent).toBe("Name the treatment first.");
    expect(theirs?.querySelector("[data-chat-read]")?.textContent).toBe("Hide");
    await tap(theirs?.querySelector("[data-chat-read]"));
    expect(theirs?.querySelector("[data-chat-words]")).toBeNull();
    // A voice note with no words shows none.
    expect(container.querySelector('[data-row="me"][data-chat-voice] [data-chat-read]')).toBeNull();

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
    expect(sheet.textContent).toContain("1. Paste it");
    expect(sheet.textContent).toContain("Cancel");
    await tap(sheet.querySelector("[data-copy-link]"));
    expect(copied).toEqual([link]);
    expect(sheet.querySelector("[data-copy-link]")?.textContent).toBe("✓ Copied");
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

  it("after joining, the list opens with Will first and the one who invited me under him, marked new", async () => {
    window.history.replaceState(null, "", "/chat?with=c-ariel");
    backend(["chats"]);
    const joined = { ...ARIEL, last: null };
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, joined] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [], joined_through: "Ariel" }));
    await render();
    expect(container.querySelector("[data-chat-screen]")).toBeNull();
    const rows = [...container.querySelectorAll("[data-chat-row]")].map((r) => r.getAttribute("data-chat-row"));
    expect(rows.slice(0, 3)).toEqual(["will", "c-ariel", "c-sarah"]);
    const top = container.querySelector('[data-chat-row="c-ariel"]')!;
    expect(top.hasAttribute("data-chat-new")).toBe(true);
    expect(top.querySelector("[data-chat-last]")?.textContent).toBe(
      "You joined through Ariel's link. Only the two of you are in this chat.",
    );
    expect(window.location.search).toBe("");
    await act(async () => (top as HTMLElement).click());
    expect(container.querySelector("[data-chat-name]")?.textContent).toBe("Ariel");
  });

  it("the + shows the four tiles, Someone else opens my link, and Cancel brings the bar back", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [] }));
    routes.set("GET /api/v2/chats/link", () => ({ token: "AbCdEfGhIjKlMnOpQrStUvWx", path: "/c/AbCdEfGhIjKlMnOpQrStUvWx" }));
    await render();
    await tap(row("c-ariel"));
    const bar = () => container.querySelector("[data-chat-bar]")!;

    await tap(bar().querySelector('button[aria-label="Add to your chat with Ariel"]'));
    expect(bar().querySelector("[data-chat-emoji-box]")).toBeNull();
    expect([...bar().querySelectorAll("[data-chat-tile]")].map((t) => t.textContent)).toEqual(["Photos", "Camera", "Files", "Someone else"]);
    await tap(bar().querySelector("[data-chat-tiles-cancel]"));
    expect(bar().querySelector("[data-chat-tile]")).toBeNull();
    expect(bar().querySelector("[data-chat-emoji-box]")).not.toBeNull();

    // Someone else: the bar is back, and the add sheet opens with my link.
    await tap(bar().querySelector("[data-chat-plus]"));
    await tap(bar().querySelector('[data-chat-tile="someone"]'));
    expect(bar().querySelector("[data-chat-emoji-box]")).not.toBeNull();
    expect(container.querySelector("[data-chat-screen] [data-add-sheet] [data-my-link]")?.textContent).toBe(
      `${window.location.origin}/c/AbCdEfGhIjKlMnOpQrStUvWx`,
    );
  });

  it("a photo I send joins the thread and the mic shows until my voice note says what I need", async () => {
    micGranted();
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    // Ariel's 👍: nothing waits, so the mic is plain.
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({
      messages: [{ id: "m1", mine: false, author: "Ariel", kind: "emoji", body: "👍", meta: { label: "good" }, created_at: ARIEL.last.created_at }],
    }));
    routes.set("POST /api/v2/chats/c-ariel/photo", () => ({
      message: { id: "p1", mine: true, author: "Me", kind: "photo", body: "", meta: { question: true }, created_at: "2026-11-02T08:00:00Z" },
    }));
    routes.set("POST /api/v2/chats/c-ariel/voice", () => ({
      message: { id: "v1", mine: true, author: "Me", kind: "voice", body: "", meta: { duration_ms: 4200, question: true }, created_at: "2026-11-02T08:01:00Z" },
    }));
    await render();
    await tap(row("c-ariel"));
    const screen = container.querySelector("[data-chat-screen]")!;
    expect(screen.querySelector("[data-chat-mic-hot]")).toBeNull();

    await tap(screen.querySelector("[data-chat-plus]"));
    await tap(screen.querySelector('[data-chat-tile="photos"]'));
    const picker = screen.querySelector<HTMLInputElement>('input[type=file][data-chat-pick="photos"]')!;
    expect([picker.accept, picker.multiple]).toEqual(["image/*", true]);
    await pick(picker, [new File(["png"], "Screenshot 1.png", { type: "image/png" })]);

    const posts = calls("POST /api/v2/chats/c-ariel/photo");
    expect(posts).toHaveLength(1);
    expect(((posts[0][1].body as FormData).get("file") as File).name).toBe("Screenshot 1.png");
    expect(screen.querySelector('[data-row="me"] [data-chat-photo] img')?.getAttribute("src")).toBe("/api/v2/chats/c-ariel/messages/p1/file");
    // My photo waits for what I need: the mic is orange.
    expect(screen.querySelector("[data-chat-mic-hot]")).not.toBeNull();

    await tap(screen.querySelector("[data-chat-mic]"));
    await tap(screen.querySelector('[data-recording-bar] button[aria-label="Stop"]'));
    await flush();
    expect(calls("POST /api/v2/chats/c-ariel/voice")).toHaveLength(1);
    expect(screen.querySelector("[data-chat-emoji-box]")).not.toBeNull();
    expect(screen.querySelector("[data-chat-mic-hot]")).toBeNull();
  });

  it("the other person's photo or file waits for my voice, and each opens from the chat's file route", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({
      chats: [
        { ...ARIEL, last: { kind: "photo", body: "", created_at: "2026-11-01T11:00:00Z" } },
        { ...SARAH, last: { kind: "file", body: "Newsroom AI guidelines.pdf", created_at: "2026-11-01T10:30:00Z" } },
      ],
    }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({
      messages: [
        { id: "f9", mine: false, author: "Ariel", kind: "file", body: "Newsroom AI guidelines.pdf", meta: { question: true }, created_at: "2026-11-01T10:59:00Z" },
        { id: "p9", mine: false, author: "Ariel", kind: "photo", body: "", meta: { question: true }, created_at: "2026-11-01T11:00:00Z" },
      ],
    }));
    await render();
    expect(lastLineOf("c-ariel")).toBe("📷");
    expect(lastLineOf("c-sarah")).toBe("📄 Newsroom AI guidelines.pdf");

    await tap(row("c-ariel"));
    const screen = container.querySelector("[data-chat-screen]")!;
    expect(screen.querySelector("[data-chat-mic-hot]")).not.toBeNull();
    const file = screen.querySelector<HTMLAnchorElement>('[data-row="app"] a[data-chat-file]')!;
    expect(file.textContent).toBe("PDFNewsroom AI guidelines.pdf");
    expect([file.getAttribute("href"), file.getAttribute("download")]).toEqual([
      "/api/v2/chats/c-ariel/messages/f9/file",
      "Newsroom AI guidelines.pdf",
    ]);

    await tap(screen.querySelector('[data-row="app"] [data-chat-photo]'));
    const full = screen.querySelector("[data-chat-photo-full]")!;
    expect(full.querySelector("img")?.getAttribute("src")).toBe("/api/v2/chats/c-ariel/messages/p9/file");
    expect(full.textContent).toBe("");
    await tap(full.querySelector('button[aria-label="Close"]'));
    expect(screen.querySelector("[data-chat-photo-full]")).toBeNull();
  });

  it("in the app, the loader, not the Lounge, waits for the list; both reads start together", async () => {
    native.on = true;
    let answerRings: () => void = () => {};
    const rings = new Promise<void>((resolve) => (answerRings = resolve));
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url) === "/api/v2/user/rings") {
        await rings;
        return reply({ ring: 6, features_on: ["chats"], pending_announcements: [] });
      }
      if (String(url) === "/api/v2/chats") return reply({ chats: [SARAH] });
      return reply({ error: "not found" }, 404);
    });
    prefetchChatsDoor();
    await render();
    // The rings have not answered, yet the chats were already asked.
    expect(calls("GET /api/v2/chats")).toHaveLength(1);
    expect(container.querySelector("[data-chats-waiting]")).not.toBeNull();
    expect(rows()).toHaveLength(0);

    await act(async () => answerRings());
    await flush();
    expect(container.querySelector("[data-chats-waiting]")).toBeNull();
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah"]);
    // The list is the one read at boot, not a second one.
    expect(calls("GET /api/v2/chats")).toHaveLength(1);
  });

  it("an answer sent to me plays with its slides following the voice, its words behind Read it", async () => {
    const players: { currentTime: number; ontimeupdate: (() => void) | null; onended: (() => void) | null }[] = [];
    vi.stubGlobal(
      "Audio",
      class {
        currentTime = 0;
        duration = 30;
        ontimeupdate: (() => void) | null = null;
        onended: (() => void) | null = null;
        constructor() {
          players.push(this);
        }
        play() {
          return Promise.resolve();
        }
        pause() {}
      },
    );
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({
      messages: [
        { id: "q", mine: true, author: "Me", kind: "text", body: "Can AI pick the quotes?", meta: null, created_at: SARAH.last.created_at },
        {
          id: "a1",
          mine: false,
          author: "Sarah",
          kind: "voice",
          body: "",
          meta: { duration_ms: 30_000, answer: true },
          created_at: SARAH.last.created_at,
          words: "Yes, it can pick them.\n\nAlways check the quote.",
          slides: [0, 21_000],
        },
      ],
    }));
    await render();
    await tap(row("c-sarah"));

    const answer = container.querySelector('[data-row="app"] [data-chat-voice]')!;
    const tiles = () => [...answer.querySelectorAll("[data-chat-slide]")].map((t) => t.getAttribute("data-chat-slide"));
    expect(tiles()).toEqual(["", ""]);
    expect(answer.textContent).not.toMatch(/Take/);
    await tap(answer.querySelector('button[aria-label="Play"]'));
    const audio = players[0];
    await act(async () => {
      audio.currentTime = 5;
      audio.ontimeupdate?.();
    });
    expect(tiles()).toEqual(["on", ""]);
    await act(async () => {
      audio.currentTime = 22;
      audio.ontimeupdate?.();
    });
    expect(tiles()).toEqual(["", "on"]);
    await act(async () => audio.onended?.());
    expect(tiles()).toEqual(["", ""]);

    await tap(answer.querySelector("[data-chat-read]"));
    expect(answer.querySelector("[data-chat-words]")?.textContent).toBe("Yes, it can pick them.\n\nAlways check the quote.");
  });

  it("a marked question takes Record an answer, and my answer goes with Sending, Undo and Sent", async () => {
    forgetAnswers();
    recordedAnswers.length = 0;
    backend(["chats"]);
    const question = "Would the Deep Scalp Treatment help? I wash every day.";
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({
      messages: [
        { id: "q", mine: false, author: "Sarah", kind: "text", body: question,
          meta: { record_answer: true }, created_at: "2026-11-03T06:00:00Z" },
      ],
      joined_through: null,
    }));
    routes.set("POST /api/v2/projects", () => ({ project_id: "p-answer" }));
    routes.set("POST /api/v2/chats/c-sarah/answer", () => ({
      message: { id: "a", mine: true, author: "", kind: "voice", body: "",
                 meta: { duration_ms: 52000, answer: true, take: "take-1" }, created_at: "2026-11-03T06:05:00Z" },
    }));
    await render();
    await tap(row("c-sarah"));
    const button = container.querySelector("[data-chat-record-answer]");
    expect(button?.textContent).toBe("Record an answer");
    // One bar: the "+" left, Record an answer in the middle, the mic right (N368).
    expect(container.querySelector("[data-chat-emoji-box]")).toBeNull();
    expect(container.querySelector("[data-chat-bar] [data-chat-plus]")).not.toBeNull();
    expect(container.querySelector("[data-chat-bar] [data-chat-mic]")).not.toBeNull();
    await tap(button);
    expect(recordedAnswers).toEqual([{ chatId: "c-sarah", name: "Sarah", question, customer: true }]);

    // The recording screens, as they hand it back: the Take is up, Finish take.
    vi.useFakeTimers();
    try {
      await act(async () => {
        await startAnswer(recordedAnswers[0]!, null, () => {});
        answerRecorded(52_000);
        answerTake("take-1");
      });
      // In the bar's middle, with the countdown and Undo (N368).
      const sending = container.querySelector("[data-chat-bar] [data-chat-sending]");
      expect(sending?.textContent).toBe("Sending to Sarah… 5Undo");
      expect(container.querySelector("[data-chat-record-answer]")).toBeNull();
      expect(calls("POST /api/v2/chats/c-sarah/answer")).toHaveLength(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS);
      });
    } finally {
      vi.useRealTimers();
    }
    await flush();
    const posted = calls("POST /api/v2/chats/c-sarah/answer");
    expect(posted).toHaveLength(1);
    expect(JSON.parse(String(posted[0]![1]!.body))).toEqual({ take: "take-1", duration_ms: 52000 });
    expect(container.querySelector("[data-chat-sending]")).toBeNull();
    expect(container.querySelector("[data-chat-sent-line='sent']")?.textContent).toBe("Sent to Sarah on WhatsApp");
  });
});
