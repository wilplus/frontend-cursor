// @vitest-environment jsdom
/*
STORY    As a user, I want to land on my list of chats, with Will first,
         on the web and in the iPhone app, so that I can open Will's chat or
         a colleague's or a customer's, answer with an emoji or by recording
         my answer, and start something new with a photo or a file (backend
         N456: the default for everyone, everywhere; was ring 6 only).
OUTCOME
  O1  As a visitor who is not signed in, nothing is drawn around the Lounge
      and no chat is read (Never 3).
  O19 As a user with no ring at all, signed in, I land on the list of
      chats, Will first, under the WillpowerLab bar; the rings never decide
      it, and a rings read that fails changes nothing (N456).
  O20 As a developer, I cannot switch the chats off with a ring: a `chats`
      row in the rings panel, on or off, lands everyone on the same list.
  O2  Signed in: the list stands in front of the Lounge, Will pinned first, then
      the chats, newest last message first, each with its title, subtitle
      and last message (an emoji with its meaning); an empty list is Will
      and "Add someone to chat with", on the web as in the iPhone app, and
      no demo chats are asked for (N401). Will's row uncovers the Lounge,
      never remounted, with a back to the list (customer-requests.md C1;
      N274, N298, N322).
  O3  In a chat, one bar: the "+" left, the three emoji in the box, no
      typing and no mic (N483 item 3; was the mic, N368); a tap on an emoji
      posts {"kind":"emoji","body":…} and shows the emoji at once, large,
      with its meaning and time under it (N306, N311, N322).
  O4  The WillpowerLab bar shows on the list only: in a person's chat and
      in Will's, the chat's own top bar takes its place (N321 item 1, N334).
  O5  A chat whose last message is newer than the last time it was opened
      on this device shows as new, and stops being new once opened (N322).
  O26 While the list is what I see, it reads the chats again every 20
      seconds, so a message that arrives while I look shows (N500 item 3);
      while Will's chat or a person's chat covers it, it is not read, and
      back on the list it is read at once.
  O7  A voice note from the other person is their grey bubble with a play
      control that plays it from the chat's audio route (N321 item 2); its
      words, once ready, are closed behind "Read it" under the player, and
      "Hide" closes them again (N331).
  O8  The + on the list opens my own link, with the add sheet's signed
      words and its three steps, and Copy my link puts the whole link on
      the clipboard and says "✓ Copied" (N308, N310, N367).
  O9  In a chat I joined through someone's link, one line above the
      messages says whose link it was (N496, replacing N335 item 2's), and
      its row in the list keeps that line until the first message (N488); a
      chat without it has no such line.
  O10 Just joined (/chat?with=<chat>), the list opens with Will's row
      first, as always, and right under it the chat with the one who invited
      me, marked new with the joined line; the address is clean again;
      opened, it is a chat like the rest (N357, N360; was N348 item 1, and
      N357's inviter above Will). Will's row has his newest line, bold with
      the dot, until his chat is open (N457 item 2).
  O11 On the web and in the iPhone app, Will's chat never shows for a moment
      before the list covers it: the loader stands in front until the list
      has answered, and it never waits on the rings (N354, N456).
  O12 The "+" in a chat asks them (N483 item 4, N498): "Ask {name}", with
      no line, the black "Record your question" and Cancel, and the three
      steps only before my first question; "Record your question" opens the
      recording screens on the default presentation (a project with no
      slides of its own, named "To {name}"), and the question goes to the
      question route with "Sending to {name}… {n}" and Undo, then "Sent to
      {name}". Until I first tap it the "+" is orange; then it is plain.
      Photos, Camera, Files and Someone else are off (N483 item 4).
  O14 The other person's file shows a tile with its extension and its own
      name, and downloads
      from the chat's file route; a photo opens full size with a close and
      no words; the list's line is "📷", or "📄" and the file's name (N351).
  O15 An answer sent to me is one message (N355): its voice, the slides it
      was said over in a strip that marks the one being heard as it plays,
      and its words closed behind "Read it"; no Take number.
  O16 A question Will marked as about a product or a treatment takes one
      black "Record your answer" in the bar's middle, the "+" on its left and
      no mic (N321 item 4, N361, N483 items 3 and 5), and "Not now", a grey
      word under the question, brings the emoji back, telling them nothing,
      until the chat is opened again; the answer hands the recording screens the
      chat, the person and the question. Back from them, the bar's middle
      reads "Sending to {name}… {n}" with Undo while the answer, already
      with the backend, waits out its 5 seconds there (N441 item 3); then
      "Sent" stands under it, a customer's too (N345, N441 item 4, N504 item 3).
  O17 Back (the iPhone's swipe from the left edge in the app, the browser's
      Back on the web) goes back by one, from a chat to the list, and never
      off the list; back on the list, it is where I left it, the row I came
      from lit. Forward (the swipe from the list's right edge in the app,
      the browser's Forward on the web) opens the chat I just left again;
      before I have left one, it does nothing (N378, N436).
  O18 An answer the backend refused stays in the bar's middle, "Not sent"
      with "Send again", which sends the same Take (N441 item 1).
  O23 A matched Take that reached me (N485, N486, N493) is its own row in
      the list under the pseudonym, "Asks you about {topic}", new; opened,
      it shows who asks and what about, never a name, with "Open Take" in
      the bar; Open Take shows the name and the Take with "Record your
      answer", which answers it over its slides as an inquiry; "Not now"
      removes it and tells nobody.
  O22 A Take someone sent me (N470, N479) is their message: "{name} sent
      you Take {n}" with the Take's tile, its first slide and no play mark
      (N493 item 6), already open: its recording, and its words slide by
      slide behind "Read it", nothing else of it (N504 item 1); the list's
      line says "{name} sent you Take {n}"; a Take I sent is my tile with
      "Sent" (N504 item 3). Newest, it asks for an answer: "Record your
      answer" in the bar with "Not now" under it, which tells them nothing
      and is kept for the system (N504 item 2), and the answer is recorded
      over the Take's own slides (N493 items 1 and 3).
  O21 At the foot of the other person's profile, "Block {name}" asks first
      and then blocks them: the backend is told, "{name} is blocked." shows,
      and back in the chat the bar is one pill, "You blocked {name}." with
      Unblock, the earlier messages still there; Unblock unblocks at once.
      "Report {name}" asks first too, and "Report and block" reports them
      with the block (N466).
  O23 Joining someone who set questions (N487): the line at the top says a
      few questions come first; their question waits with its answers on my
      side; "No" is sent at once and its deadline shows under it; a question
      that takes more than one answer fills each one I tap, and Send in the
      bar's middle sends them. The link's owner reads one card of my
      answers, under "{name} joined through your link.", and their list
      says "{name}'s answers".
  O24 The first time I add someone (N503), Will's chat opens on his setup,
      not my link; his question waits with its answers on my side,
      "Something else" first, and a tap goes to the backend; the summary
      shows what someone new will see, my name in its top line, with
      "Change it" and "That's right"; "You're set." ends with "Copy my
      link ›" and "Your questions for people who join ›". After the setup,
      the + opens my link as before (O8).
  O25 While the list (or a chat, or the loader) covers Will's chat, the
      slide previews on his cards wait, so pdf.js and the decks are not
      downloaded behind the list; they draw once his chat is open.
PROVES   O1 -> "as a visitor who is not signed in, /chat is the Lounge as it is and no chat is read"
         O19 -> "as a user with no ring at all, I land on the list of chats, Will first, under the WillpowerLab bar"
         O20 -> "as a developer, a chats row in the rings, on or off, changes nothing"
         O2 -> "with chats on and nobody yet, the list is Will and Add someone to chat with, no demo, and his row opens the Lounge with a way back"
         O3 -> "an emoji tapped in a chat is posted and shown at once with its meaning, and the bar has no mic"
         O4 -> "the WillpowerLab bar shows on the list only: it hides in a person's chat and in Will's"
         O5 -> "a chat with a message newer than its last opening shows as new until it is opened"
         O26 -> "the list reads the chats again while I look at it, rests behind Will's chat, and reads them once I am back"
         O7 -> "a voice note from the other person plays from the chat's audio route, its words behind Read it"
         O8 -> "the + opens my own link and copies it"
         O9 -> "a chat joined through a link says whose link it was"
         O10 -> "after joining, the list opens with Will first and the one who invited me under him, marked new"
         O11 -> "as a user, the loader, not Will's chat, waits for my list, on the web and in the app, and never for the rings"
         O12 -> "the + asks them: the default presentation, and the question goes with Sending, Undo and Sent"
         O14 -> "the other person's photo or file opens from the chat's file route"
         O15 -> "an answer sent to me plays with its slides following the voice, its words behind Read it"
         O16 -> "a marked question takes Record your answer, Not now leaves it, and my answer goes with Sending, Undo and Sent"
         O17 -> "the device's Back goes back by one, to the list, never off it, and Forward opens the chat I just left"
         O17 -> "in the app, a swipe from the left edge goes back to the list where I left it, and one from the right edge forward to the chat I just left"
         O18 -> "a refused answer stays as Not sent, and Send again sends the same Take"
         O22 -> "a Take sent to me opens with its recording and words, and the list says who sent it"
         O21 -> "from their profile I block them, the bar says so with Unblock, and Report and block reports with the block"
         O23 -> "the questions of the one who invited me are answered by tapping, and they read one card"
         O24 -> "the first time I add someone, Will's chat opens on his setup, answered by tapping"
         O25 -> "the slides on Will's cards wait while the list covers his chat, and draw once it is open"
*/
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
const native = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => native.on }));
// Will's chat, the Lounge's thread the list reads his row's line from.
const loungeThread = vi.hoisted(() => ({ messages: [] as Array<Record<string, unknown>>, reload: async () => {} }));
vi.mock("../LoungeThreadContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../LoungeThreadContext")>()),
  useLoungeThreadMaybe: () => loungeThread,
}));
/** Whether the person is signed in: `null` while the session is read. */
const session = vi.hoisted(() => ({ signedIn: true as boolean | null }));
vi.mock("../useSignedIn", () => ({ useSignedIn: () => session.signedIn }));

import { resetRingStateCache } from "@/services/api/rings";
import { __resetBootPrefetchForTests, prefetchChatsDoor } from "@/services/api/bootPrefetch";
import { useChatsDoor } from "./useChatsDoor";
import { getAuthToken } from "@/lib/api/auth-client";
import { UNDO_MS, answerRecorded, answerTake, forgetAnswers, startAnswer, type AnswerFor } from "@/lib/willab/chatAnswer";
import { JoinSetupBubble, joinSetupOf, useJoinSetup } from "./JoinSetup";
import { useWillChatInView } from "./willChatInView";
import type { LoungeMessage } from "@/services/api/loungeMessages";

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
  // What his cards' slide previews wait for (IdealTextCard).
  const inView = useWillChatInView();
  return createElement("div", { "data-testid": "lounge", "data-will-in-view": String(inView) }, "The Lounge");
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

// A chat's code loads when it is first opened (useChatsDoor): wait for it too.
const flush = () =>
  act(async () => {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

beforeEach(async () => {
  resetRingStateCache();
  __resetBootPrefetchForTests();
  native.on = false;
  session.signedIn = true;
  window.localStorage.clear();
  routes.clear();
  fetchMock.mockReset();
  loungeMounts = 0;
  loungeThread.messages = [];
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
  it("as a visitor who is not signed in, /chat is the Lounge as it is and no chat is read", async () => {
    session.signedIn = false;
    backend([]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    await render();
    expect(surface().children).toHaveLength(1);
    expect(surface().firstElementChild?.getAttribute("data-testid")).toBe("lounge");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/v2/chats"))).toBe(false);
    expect(loungeMounts).toBe(1);
  });

  it("as a user with no ring at all, I land on the list of chats, Will first, under the WillpowerLab bar", async () => {
    // No ring row, and a rings read that fails: the list opens all the same.
    fetchMock.mockImplementation((url: string) =>
      String(url) === "/api/v2/chats" ? reply({ chats: [SARAH] }) : reply({ error: "down" }, 500),
    );
    await render();
    expect(container.querySelector("[data-chats-front]")).not.toBeNull();
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah"]);
    expect(navbar().hidden).toBe(false);
  });

  it("as a developer, a chats row in the rings, on or off, changes nothing", async () => {
    const landing: string[][] = [];
    for (const featuresOn of [["chats"], []]) {
      resetRingStateCache();
      backend(featuresOn);
      routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
      await render();
      landing.push(rows().map((r) => r.getAttribute("data-chat-row") ?? ""));
      act(() => root.unmount());
      root = createRoot(container);
    }
    expect(landing).toEqual([["will", "c-sarah"], ["will", "c-sarah"]]);
  });

  it("the slides on Will's cards wait while the list covers his chat, and draw once it is open", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    const inView = () => container.querySelector("[data-testid=lounge]")?.getAttribute("data-will-in-view");
    await render();
    expect(inView()).toBe("false");
    await tap(row("will"));
    expect(inView()).toBe("true");
    await tap(container.querySelector("[data-chat-header] button"));
    expect(inView()).toBe("false");
  });

  it("with chats on and nobody yet, the list is Will and Add someone to chat with, no demo, and his row opens the Lounge with a way back", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [] }));
    await render();

    // On the web too, the list stands with Will alone and the way to add someone (N401).
    expect(container.querySelector("[data-chats-front]")).not.toBeNull();
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "add"]);
    expect(rows()[0].textContent).toBe("Will");
    expect(rows()[1].textContent).toBe("Add someone to chat with");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/v2/chats/demo"))).toBe(false);

    await tap(rows()[0]);
    expect(container.querySelector("[data-chats-front]")?.hasAttribute("data-chats-away")).toBe(true);
    expect(container.querySelector("[data-testid=lounge]")).not.toBeNull();
    expect(container.querySelector("[data-chat-header]")?.textContent).toBe("Will");

    // Someone joined meanwhile: back on the list, Will first, then the newest last message first.
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    await tap(container.querySelector("[data-chat-header] button"));
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-ariel", "c-sarah"]);
    expect(rows()[2].textContent).toContain("SarahInvita customer");
    expect(lastLineOf("c-sarah")).toBe("Is the scalp scrub good for dry hair?");
    expect(lastLineOf("c-ariel")).toBe("🙏 Thanks");
    // The Lounge was never mounted twice.
    expect(loungeMounts).toBe(1);
  });

  it("the device's Back goes back by one, to the list, never off it, and Forward opens the chat I just left", async () => {
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

    // The browser's Forward opens it again (N436 item 3), and Back goes back.
    await act(async () => {
      const popped = () => new Promise((done) => window.addEventListener("popstate", done, { once: true }));
      const forward = popped();
      window.history.go(1);
      await forward;
      await popped();
      for (let i = 0; i < 12; i += 1) await Promise.resolve();
    });
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

  it("in the app, a swipe from the left edge goes back to the list where I left it, and one from the right edge forward to the chat I just left", async () => {
    native.on = true;
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [] }));
    await render();
    const list = () => container.querySelector("[data-chat-list]") as HTMLElement;
    const header = () => container.querySelector("[data-chat-header]");
    list().scrollTop = 120;
    // A swipe across the screen, from one edge to the other; `to` short of
    // the far edge lets go early.
    const swipe = (from: number, to: number) =>
      act(async () => {
        const at = (x: number) => ({ touches: [{ clientX: x, clientY: 300 }] });
        window.dispatchEvent(Object.assign(new Event("touchstart"), at(from)));
        window.dispatchEvent(Object.assign(new Event("touchmove", { cancelable: true }), at(from + Math.sign(to - from) * 60)));
        window.dispatchEvent(Object.assign(new Event("touchmove", { cancelable: true }), at(to)));
        window.dispatchEvent(Object.assign(new Event("touchend"), { touches: [] }));
      });
    const right = window.innerWidth - 5;

    // Before any chat was left, the right edge does nothing.
    await swipe(right, 0);
    await flush();
    expect(header()).toBeNull();

    await tap(rows()[2]);
    expect(header()).not.toBeNull();
    await swipe(5, window.innerWidth);
    await flush();
    expect(header()).toBeNull();
    expect(list().scrollTop).toBe(120);
    expect(container.querySelector("[data-chat-came-from]")?.getAttribute("data-chat-row")).toBe("c-sarah");

    // From the right edge, let go early: still the list.
    await act(async () => {
      const at = (x: number) => ({ touches: [{ clientX: x, clientY: 300 }] });
      window.dispatchEvent(Object.assign(new Event("touchstart"), at(right)));
      window.dispatchEvent(Object.assign(new Event("touchmove", { cancelable: true }), at(right - 12)));
      window.dispatchEvent(Object.assign(new Event("touchmove", { cancelable: true }), at(right - 20)));
      await new Promise((done) => setTimeout(done, 80));
      window.dispatchEvent(Object.assign(new Event("touchend"), { touches: [] }));
    });
    await flush();
    expect(header()).toBeNull();
    // All the way: the chat I just left, again.
    await swipe(right, 0);
    await flush();
    expect(header()?.textContent).toContain("Sarah");
  });

  it("an emoji tapped in a chat is posted and shown at once with its meaning, and the bar has no mic", async () => {
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
    // One bar: the "+", the three emoji in the box; no mic, no typing (N483 item 3).
    const bar = screen.querySelector("[data-chat-bar]")!;
    expect([...bar.querySelectorAll("button")].map((b) => b.textContent || b.getAttribute("aria-label"))).toEqual([
      "Ask Sarah",
      "👍",
      "👀",
      "🙏",
    ]);
    expect(screen.querySelector("textarea, input:not([type=file])")).toBeNull();

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

  it("a chat with a message newer than its last opening shows as new until it is opened, an emoji included, never your own (N500)", async () => {
    backend(["chats"]);
    const DANA = { ...ARIEL, id: "c-dana", title: "Dana" };
    const MINE = { ...ARIEL, id: "c-mine", title: "Noa", last: { ...ARIEL.last, mine: true } };
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL, DANA, MINE] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [] }));
    // Ariel's chat was opened after her last message; the others before theirs.
    window.localStorage.setItem("willab.chats.opened.c-ariel", String(Date.parse(ARIEL.last.created_at) + 60_000));
    for (const id of ["c-sarah", "c-dana", "c-mine"])
      window.localStorage.setItem(`willab.chats.opened.${id}`, String(Date.parse(SARAH.last.created_at) - 60_000));
    await render();
    expect(row("c-sarah")?.hasAttribute("data-chat-new")).toBe(true);
    expect(row("c-ariel")?.hasAttribute("data-chat-new")).toBe(false);
    expect(row("c-dana")?.hasAttribute("data-chat-new")).toBe(true);
    expect(row("c-mine")?.hasAttribute("data-chat-new")).toBe(false);

    await tap(row("c-sarah"));
    await tap(container.querySelector("[data-chat-header] button"));
    expect(row("c-sarah")?.hasAttribute("data-chat-new")).toBe(false);
  });

  it("the list reads the chats again while I look at it, rests behind Will's chat, and reads them once I am back", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      backend(["chats"]);
      routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
      routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [] }));
      await render();
      const reads = () => calls("GET /api/v2/chats").length;
      expect(reads()).toBe(1);

      // A message arrives while I look at the list: it shows.
      routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
      act(() => void vi.advanceTimersByTime(20_000));
      await flush();
      expect(reads()).toBe(2);
      expect(row("c-ariel")).not.toBeNull();

      // In Will's chat, and in a person's, the list is not read.
      await tap(row("will"));
      act(() => void vi.advanceTimersByTime(60_000));
      await flush();
      expect(reads()).toBe(2);
      await tap(container.querySelector("[data-chat-header] button"));
      expect(reads()).toBe(3);
      await tap(row("c-sarah"));
      act(() => void vi.advanceTimersByTime(60_000));
      await flush();
      expect(reads()).toBe(3);

      // Back on the list, it is read at once, and again while I look.
      await tap(container.querySelector("[data-chat-header] button"));
      expect(reads()).toBe(4);
      act(() => void vi.advanceTimersByTime(20_000));
      await flush();
      expect(reads()).toBe(5);
    } finally {
      vi.useRealTimers();
    }
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
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, { ...ARIEL, last: null, joined_through: "Ariel" }] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [], joined_through: "Ariel" }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({ messages: [], joined_through: null }));
    await render();

    await tap(row("c-ariel"));
    expect(container.querySelector("[data-chat-joined]")?.textContent).toBe(
      "You joined thanks to Ariel. Your first question starts the knowledge base you build together.",
    );
    await tap(container.querySelector("[data-chat-screen] button"));
    // Opened, the row keeps the line until the first message (N488).
    expect(lastLineOf("c-ariel")).toBe("You joined thanks to Ariel. Your first question starts the knowledge base you build together.");
    await tap(row("c-sarah"));
    expect(container.querySelector("[data-chat-joined]")).toBeNull();
  });

  it("the questions of the one who invited me are answered by tapping, and they read one card", async () => {
    backend(["chats"]);
    const at = "2026-11-04T10:00:00Z";
    const hurry = { id: "q1", mine: false, author: "Ariel", kind: "text", body: "Are you in a hurry?", created_at: at,
      meta: { setup: { i: 1, kind: "hurry", answers: ["No", "Yes"], multi: false } } };
    const plan = { id: "q0", mine: false, author: "Ariel", kind: "text", body: "Let's build our knowledge base a month at a time.",
      created_at: at, meta: { setup: { i: 0, kind: "say", answers: [], multi: false } } };
    routes.set("GET /api/v2/chats", () => ({ chats: [{ ...ARIEL, last: { kind: "text", body: "Are you in a hurry?", created_at: at } }] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [plan, hurry], joined_through: "Ariel", joined_asks: true }));
    routes.set("POST /api/v2/chats/c-ariel/setup/q1", () => ({ messages: [
      { id: "a1", mine: true, author: "", kind: "text", body: "No", created_at: at, meta: { setup_answer: { to: "q1", i: 1, picked: ["No"], deadline: "2026-12-04" } } },
      { id: "q2", mine: false, author: "Ariel", kind: "text", body: "Which languages can we use?", created_at: at,
        meta: { setup: { i: 2, kind: "languages", answers: ["Polish", "English"], multi: true } } },
    ] }));
    routes.set("POST /api/v2/chats/c-ariel/setup/q2", () => ({ messages: [
      { id: "a2", mine: true, author: "", kind: "text", body: "Polish, English", created_at: at, meta: { setup_answer: { to: "q2", i: 2, picked: ["Polish", "English"] } } },
    ] }));
    await render();
    await tap(row("c-ariel"));
    expect(container.querySelector("[data-chat-joined]")?.textContent).toBe(
      "You joined thanks to Ariel. A few questions first, then you build a knowledge base together.",
    );
    const answers = container.querySelector("[data-chat-setup]");
    expect([...answers!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["No", "Yes"]);
    await tap([...answers!.querySelectorAll("button")].find((b) => b.textContent === "No"));
    expect(JSON.parse(String(calls("POST /api/v2/chats/c-ariel/setup/q1")[0]![1]!.body))).toEqual({ picked: ["No"] });
    expect(container.querySelector("[data-chat-deadline]")?.textContent).toBe("Your deadline: Fri 4 Dec");
    // Several answers: each tap fills one; Send stands in the bar's middle.
    expect(container.querySelector("[data-chat-send-picked]")).toBeNull();
    const picks = container.querySelector("[data-chat-setup-picks]")!;
    for (const label of ["English", "Polish"]) await tap([...picks.querySelectorAll("button")].find((b) => b.textContent === label));
    await tap(container.querySelector("[data-chat-send-picked]"));
    expect(JSON.parse(String(calls("POST /api/v2/chats/c-ariel/setup/q2")[0]![1]!.body))).toEqual({ picked: ["Polish", "English"] });
    expect(container.querySelector("[data-chat-setup-picks]")).toBeNull();
  });

  it("the one whose link it was reads one card of the answers", async () => {
    backend(["chats"]);
    const at = "2026-11-04T10:05:00Z";
    const card = { id: "card", mine: false, author: "Ariel", kind: "text", body: "", created_at: at,
      meta: { setup_card: { rows: [{ k: "Deadline", v: "4 December" }, { k: "Languages", v: "Polish, English" }] } } };
    routes.set("GET /api/v2/chats", () => ({ chats: [{ ...ARIEL, last: { kind: "text", body: "", created_at: at, meta: { setup_card: true } } }] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [card], joined_through: null, joined_by: "Ariel" }));
    await render();
    expect(lastLineOf("c-ariel")).toBe("Ariel's answers");
    await tap(row("c-ariel"));
    expect(container.querySelector("[data-chat-joined]")?.textContent).toBe("Ariel joined through your link.");
    expect(container.querySelector("[data-chat-setup-card]")?.textContent).toBe("Ariel's answersDeadline 4 DecemberLanguages Polish, English");
  });

  it("after joining, the list opens with Will first and the one who invited me under him, marked new", async () => {
    loungeThread.messages = [
      { client_id: "1", role: "bot", kind: "text", body: "Hi Anna!", client_created_at: "2026-11-03T10:00:00Z" },
      { client_id: "2", role: "bot", kind: "text", body: "Your first Take is five questions.", client_created_at: "2026-11-03T10:00:01Z" },
      { client_id: "3", role: "bot", kind: "text", body: "", metadata: { plan_card: true }, client_created_at: "2026-11-03T10:00:02Z" },
    ];
    window.history.replaceState(null, "", "/chat?with=c-ariel");
    backend(["chats"]);
    const joined = { ...ARIEL, last: null };
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, joined] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [], joined_through: "Ariel" }));
    await render();
    expect(container.querySelector("[data-chat-screen]")).toBeNull();
    const rows = [...container.querySelectorAll("[data-chat-row]")].map((r) => r.getAttribute("data-chat-row"));
    expect(rows.slice(0, 3)).toEqual(["will", "c-ariel", "c-sarah"]);
    // Will's newest line, new: he asks for the first Take (N457 item 2).
    expect(row("will")?.hasAttribute("data-chat-new")).toBe(true);
    expect(lastLineOf("will")).toBe("Your first Take is five questions.");
    await tap(row("will"));
    await tap(container.querySelector("[data-chat-header] button"));
    expect(row("will")?.hasAttribute("data-chat-new")).toBe(false);
    expect(lastLineOf("will")).toBe("Your first Take is five questions.");
    const top = container.querySelector('[data-chat-row="c-ariel"]')!;
    expect(top.hasAttribute("data-chat-new")).toBe(true);
    expect(top.querySelector("[data-chat-last]")?.textContent).toBe(
      "You joined thanks to Ariel. Your first question starts the knowledge base you build together.",
    );
    expect(window.location.search).toBe("");
    await act(async () => (top as HTMLElement).click());
    expect(container.querySelector("[data-chat-name]")?.textContent).toBe("Ariel");
  });

  it("the + asks them: the default presentation, and the question goes with Sending, Undo and Sent", async () => {
    forgetAnswers();
    recordedAnswers.length = 0;
    window.localStorage.clear();
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({ messages: [] }));
    routes.set("POST /api/v2/projects", () => ({ project_id: "p-question" }));
    routes.set("POST /api/v2/chats/c-ariel/question", () => ({
      message: { id: "q", mine: true, author: "", kind: "voice", body: "",
                 meta: { duration_ms: 30000, answer: true, asked: true, take: "take-q" }, created_at: "2026-11-04T16:00:00Z" },
    }));
    await render();
    await tap(row("c-ariel"));
    const plus = () => container.querySelector("[data-chat-bar] [data-chat-plus]")!;
    const sheet = () => container.querySelector("[data-ask-sheet]");

    // Orange until first tapped; it opens "Ask Ariel", no tiles.
    expect([plus().getAttribute("aria-label"), plus().hasAttribute("data-plus-new")]).toEqual(["Ask Ariel", true]);
    await tap(plus());
    expect(plus().hasAttribute("data-plus-new")).toBe(false);
    expect(container.querySelector("[data-chat-tile]")).toBeNull();
    expect(sheet()?.querySelector("[role=dialog] p")?.textContent).toBe("Ask Ariel");
    expect([...sheet()!.querySelectorAll("[data-ask-steps] b")].map((b) => b.textContent)).toEqual([
      "1. Ask one thing",
      "2. Ariel answers",
      "3. It stays here",
    ]);
    await tap(sheet()!.querySelector("[data-record-question]"));
    expect(sheet()).toBeNull();
    expect(recordedAnswers).toEqual([{ chatId: "c-ariel", name: "Ariel", question: "", customer: false, asks: true }]);

    // The default presentation: a project with no slides of its own.
    vi.useFakeTimers();
    try {
      await act(async () => {
        await startAnswer(recordedAnswers[0]!, null, () => {});
        answerRecorded(30_000);
        answerTake("take-q");
      });
      const made = JSON.parse(String(calls("POST /api/v2/projects")[0]![1]!.body));
      expect([made.display_name, made.setup.slides]).toEqual(["To Ariel", []]);
      expect(container.querySelector("[data-chat-bar] [data-chat-sending]")?.textContent).toBe("Sending to Ariel… 5Undo");
      const posted = calls("POST /api/v2/chats/c-ariel/question");
      expect(JSON.parse(String(posted[0]![1]!.body))).toEqual({ take: "take-q", duration_ms: 30000, hold_ms: 5000 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS);
      });
    } finally {
      vi.useRealTimers();
    }
    await flush();
    expect(container.querySelector("[data-chat-sent-line='sent']")?.textContent).toBe("Sent");

    // After the first question the sheet is short.
    await tap(plus());
    expect(sheet()?.querySelector("[data-ask-steps]")).toBeNull();
  });

  it("the other person's photo or file opens from the chat's file route", async () => {
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

  for (const where of ["on the web", "in the app"] as const) {
    it(`as a user, the loader, not Will's chat, waits for my list ${where}, and never for the rings`, async () => {
      native.on = where === "in the app";
      let answerChats: () => void = () => {};
      const list = new Promise<void>((resolve) => (answerChats = resolve));
      fetchMock.mockImplementation(async (url: string) => {
        // The rings never answer: the list must not wait on them.
        if (String(url) === "/api/v2/user/rings") return new Promise(() => {});
        if (String(url) === "/api/v2/chats") {
          await list;
          return reply({ chats: [SARAH] });
        }
        return reply({ error: "not found" }, 404);
      });
      prefetchChatsDoor();
      await render();
      expect(container.querySelector("[data-chats-waiting]")).not.toBeNull();
      expect(rows()).toHaveLength(0);

      await act(async () => answerChats());
      await flush();
      expect(container.querySelector("[data-chats-waiting]")).toBeNull();
      expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah"]);
      // The list is the one read at boot, not a second one.
      expect(calls("GET /api/v2/chats")).toHaveLength(1);
    });
  }

  it("as a user, my list from last time draws at once, then the fresh one; signed out, it is gone", async () => {
    const tokenOf = (sub: string) => `h.${btoa(JSON.stringify({ sub }))}.s`;
    vi.mocked(getAuthToken).mockImplementation(async () => tokenOf("u-me"));
    try {
      // The first open: the list is read and kept.
      backend([]);
      routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
      await render();
      expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah"]);
      act(() => root.unmount());
      root = createRoot(container);

      // The next open: the kept list stands while the read has not answered.
      let answerChats: () => void = () => {};
      const list = new Promise<void>((resolve) => (answerChats = resolve));
      fetchMock.mockImplementation(async (url: string) => {
        if (String(url) !== "/api/v2/chats") return reply({ error: "not found" }, 404);
        await list;
        return reply({ chats: [ARIEL, SARAH] });
      });
      await render();
      expect(container.querySelector("[data-chats-waiting]")).toBeNull();
      expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah"]);
      await act(async () => answerChats());
      await flush();
      expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-ariel", "c-sarah"]);
      act(() => root.unmount());
      root = createRoot(container);

      // Someone else on this browser never sees it.
      vi.mocked(getAuthToken).mockImplementation(async () => tokenOf("u-other"));
      fetchMock.mockImplementation(() => new Promise(() => {}));
      await render();
      expect(container.querySelector("[data-chats-waiting]")).not.toBeNull();
      act(() => root.unmount());
      root = createRoot(container);

      // Signed out, nothing stays behind.
      session.signedIn = false;
      await render();
      expect(window.localStorage.getItem("willab.chats.list")).toBeNull();
    } finally {
      vi.mocked(getAuthToken).mockImplementation(async () => "t");
    }
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

  it("a marked question takes Record your answer, Not now leaves it, and my answer goes with Sending, Undo and Sent", async () => {
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
    const button = () => container.querySelector("[data-chat-record-answer]");
    expect(button()?.textContent).toBe("Record your answer");
    // One bar: the "+" left, Record your answer in the middle, no mic (N483).
    expect(container.querySelector("[data-chat-emoji-box]")).toBeNull();
    expect(container.querySelector("[data-chat-bar] [data-chat-plus]")).not.toBeNull();
    expect(container.querySelector("[data-chat-bar] [data-chat-mic]")).toBeNull();
    // "Not now", a grey word under the question, gives the emoji back and
    // tells Sarah nothing; opened again, the question takes the bar again.
    const notNow = container.querySelector("[data-chat-not-now] button");
    expect(notNow?.textContent).toBe("Not now");
    const before = fetchMock.mock.calls.length;
    await tap(notNow);
    expect(button()).toBeNull();
    expect(container.querySelector("[data-chat-emoji-box]")).not.toBeNull();
    // The only thing sent is the decline the system keeps (N504 item 2).
    expect(
      fetchMock.mock.calls
        .slice(before)
        .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
        .map(([url]) => url),
    ).toEqual(["/api/v2/chats/c-sarah/messages/q/not-now"]);
    await tap(container.querySelector('[data-chat-header] button[aria-label="Back"]'));
    await tap(row("c-sarah"));
    await tap(button());
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
      // Already with the backend, held there for the 5 seconds (N441 item 3).
      const posted = calls("POST /api/v2/chats/c-sarah/answer");
      expect(posted).toHaveLength(1);
      expect(JSON.parse(String(posted[0]![1]!.body))).toEqual({ take: "take-1", duration_ms: 52000, hold_ms: 5000 });
      expect(container.querySelector("[data-chat-sent-line]")).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS);
      });
    } finally {
      vi.useRealTimers();
    }
    await flush();
    expect(calls("POST /api/v2/chats/c-sarah/answer")).toHaveLength(1);
    expect(container.querySelector("[data-chat-sending]")).toBeNull();
    expect(container.querySelector("[data-chat-sent-line='sent']")?.textContent).toBe("Sent");
  });

  it("from their profile I block them, the bar says so with Unblock, and Report and block reports with the block", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    routes.set("GET /api/v2/chats/c-ariel/messages", () => ({
      messages: [{ id: "m1", mine: false, author: "Ariel", kind: "emoji", body: "🙏", meta: null, created_at: ARIEL.last.created_at }],
      blocked: false,
    }));
    routes.set("GET /api/v2/chats/c-ariel/profile", () => ({ name: "Ariel Cohen", role: null, about: null, has_photo: false, photos: [], files: [] }));
    routes.set("POST /api/v2/chats/c-ariel/block", () => ({ blocked: true }));
    routes.set("DELETE /api/v2/chats/c-ariel/block", () => ({ blocked: false }));
    routes.set("POST /api/v2/chats/c-ariel/report", () => ({ reported: true, blocked: true }));
    await render();
    await tap(row("c-ariel"));
    const bar = () => container.querySelector("[data-chat-bar]")!;
    const toast = () => container.querySelector("[data-chat-toast]")?.textContent;
    const sheet = () => container.querySelector("[data-ask-sheet] [role=dialog]");
    const action = (label: string) => container.querySelector(`[data-ask-sheet] [data-ask-action="${label}"]`);

    // The foot of her profile: Block and Report, with her name as the chat shows it.
    await tap(container.querySelector("[data-chat-who]"));
    expect(container.querySelector("[data-profile-safety]")?.textContent).toBe("Block ArielReport Ariel");

    // Block asks first; Cancel changes nothing.
    await tap(container.querySelector("[data-profile-block]"));
    expect(sheet()?.textContent).toBe("Block Ariel?Ariel can't send you messages or answers. Ariel isn't told.BlockCancel");
    await tap([...sheet()!.querySelectorAll("button")].find((b) => b.textContent === "Cancel"));
    expect(calls("POST /api/v2/chats/c-ariel/block")).toHaveLength(0);
    await tap(container.querySelector("[data-profile-block]"));
    await tap(action("Block"));
    expect(calls("POST /api/v2/chats/c-ariel/block")).toHaveLength(1);
    expect(toast()).toBe("Ariel is blocked.");
    expect(container.querySelector("[data-profile-block]")?.textContent).toBe("Unblock Ariel");

    // Back in the chat: one pill in the bar's place, the messages still there.
    await tap(container.querySelector("[data-profile] button[aria-label=Back]"));
    expect(bar().textContent).toBe("You blocked Ariel.Unblock");
    expect(bar().querySelector("[data-chat-plus], [data-chat-emoji-box], [data-chat-mic]")).toBeNull();
    expect(container.querySelector("[data-chat-thread] [data-chat-emoji]")?.textContent).toContain("🙏");

    // Unblock needs no sheet.
    await tap(bar().querySelector("[data-chat-unblock]"));
    expect(calls("DELETE /api/v2/chats/c-ariel/block")).toHaveLength(1);
    expect(toast()).toBe("Ariel is unblocked.");
    expect(bar().querySelector("[data-chat-plus]")).not.toBeNull();

    // Report asks first; Report and block sends the block with it.
    await tap(container.querySelector("[data-chat-who]"));
    await tap(container.querySelector("[data-profile-report]"));
    expect(sheet()?.textContent).toBe(
      "Report Ariel?The last five messages in this chat go to WillpowerLab, where a person reads them within a day. Ariel isn't told.ReportReport and blockCancel",
    );
    await tap(action("Report and block"));
    expect(calls("POST /api/v2/chats/c-ariel/report").map(([, init]) => JSON.parse(String(init!.body)))).toEqual([{ block: true }]);
    expect(toast()).toBe("Reported and blocked.");
    await tap(container.querySelector("[data-profile] button[aria-label=Back]"));
    expect(bar().querySelector("[data-chat-blocked]")).not.toBeNull();
  });

  it("a refused answer stays as Not sent, and Send again sends the same Take", async () => {
    forgetAnswers();
    recordedAnswers.length = 0;
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({
      messages: [
        { id: "q", mine: false, author: "Sarah", kind: "text", body: "Would it help?",
          meta: { record_answer: true }, created_at: "2026-11-03T06:00:00Z" },
      ],
      joined_through: null,
    }));
    routes.set("POST /api/v2/projects", () => ({ project_id: "p-answer" }));
    await render();
    await tap(row("c-sarah"));
    await tap(container.querySelector("[data-chat-record-answer]"));
    // No answer route yet: the backend refuses it.
    vi.useFakeTimers();
    try {
      await act(async () => {
        await startAnswer(recordedAnswers[0]!, null, () => {});
        answerRecorded(30_000);
        answerTake("take-1");
        await vi.advanceTimersByTimeAsync(UNDO_MS);
      });
    } finally {
      vi.useRealTimers();
    }
    await flush();
    expect(container.querySelector("[data-chat-bar] [data-chat-sending]")?.textContent).toBe("Not sentSend again");
    expect(container.querySelector("[data-chat-sent-line]")).toBeNull();

    routes.set("POST /api/v2/chats/c-sarah/answer", () => ({
      message: { id: "a", mine: true, author: "", kind: "voice", body: "",
                 meta: { duration_ms: 30000, answer: true, take: "take-1" }, created_at: "2026-11-03T06:05:00Z" },
    }));
    await tap(container.querySelector("[data-chat-send-again]"));
    await flush();
    const posted = calls("POST /api/v2/chats/c-sarah/answer").map(([, init]) => JSON.parse(String(init!.body)));
    expect(posted).toEqual([{ take: "take-1", duration_ms: 30000, hold_ms: 5000 }, { take: "take-1", duration_ms: 30000, hold_ms: 0 }]);
    expect(container.querySelector("[data-chat-sending]")).toBeNull();
    expect(container.querySelector("[data-chat-sent-line='sent']")?.textContent).toBe("Sent");
  });

  it("a Take sent to me opens with its recording and words, and the list says who sent it", async () => {
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
    const AMIRA = {
      id: "c-amira",
      kind: "team",
      title: "Amira Haddad",
      subtitle: "Account executive",
      last: { kind: "take", body: "", mine: false, meta: { take_index: 3 }, created_at: "2026-11-04T11:02:00Z" },
    };
    const meta = { take_index: 3, project_title: "Q3 board pitch", duration_ms: 134_000 };
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [AMIRA] }));
    routes.set("GET /api/v2/chats/c-amira/messages", () => ({
      messages: [
        { id: "t1", mine: false, author: "Amira Haddad", kind: "take", body: "", meta, created_at: AMIRA.last.created_at },
        { id: "t2", mine: true, author: "Me", kind: "take", body: "", meta: { ...meta, take_index: 4 }, created_at: AMIRA.last.created_at },
      ],
    }));
    routes.set("GET /api/v2/chats/c-amira/messages/t1/take", () => ({
      audio_url: "https://store.example/take-3.webm?sig=1",
      duration_ms: 134_000,
      slides: [{ index: 0, title: "Hook", words: "We grew in Q3." }, { index: 1, title: null, words: "Next, the cities." }],
    }));
    await render();
    expect(lastLineOf("c-amira")).toBe("Amira sent you Take 3");
    await tap(row("c-amira"));

    const theirs = container.querySelector("[data-chat-take]")!;
    expect(theirs.textContent).toContain("Amira sent you Take 3");
    expect(theirs.querySelector("[data-take-tile]")?.textContent).toBe("Hook2:14Take 3Q3 board pitch");
    expect(theirs.querySelector("[data-chat-open-take]")).toBeNull();
    await tap(theirs.querySelector('button[aria-label="Play"]'));
    expect(played).toEqual(["https://store.example/take-3.webm?sig=1"]);
    await tap(theirs.querySelector("[data-chat-read]"));
    expect(theirs.querySelector("[data-chat-words]")?.textContent).toBe("We grew in Q3.\n\nNext, the cities.");

    const mine = container.querySelector('[data-row="me"] [data-take-tile]');
    expect(mine?.textContent).toContain("Take 4");
    expect(container.textContent).not.toContain("Sent to Amira Haddad");
  });

  it("a matched Take knocks as its own chat: Open Take shows who, Not now removes it", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [ARIEL] }));
    const outside = { id: "m1", state: "new", pseudonym: "Bright Finch", role: "Sales lead", about: "opening an investor pitch", sent_at: "2026-11-04T11:05:00Z" };
    let inside: Record<string, unknown> = outside;
    routes.set("GET /api/v2/take-matches/inquiries", () => ({ inquiries: [inside] }));
    routes.set("GET /api/v2/take-matches/m1", () => ({ match: inside }));
    routes.set("POST /api/v2/take-matches/m1/accept", () => {
      inside = { ...outside, state: "opened", name: "Amira", words: "Why now.\n\nThe first number.", slide_titles: ["Why now", "The first number"], duration_ms: 161_000 };
      return { match: inside };
    });
    const declined: string[] = [];
    routes.set("POST /api/v2/take-matches/m1/decline", () => {
      declined.push("m1");
      return { match: { id: "m1", status: "declined" } };
    });
    recordedAnswers.length = 0;
    await render();

    const knock = row("inquiry:m1");
    expect(knock?.textContent).toContain("Bright Finch");
    expect(lastLineOf("inquiry:m1")).toBe("Asks you about opening an investor pitch");
    expect(knock?.hasAttribute("data-chat-new")).toBe(true);
    await tap(knock);
    const screen = () => container.querySelector("[data-inquiry]")!;
    expect(screen().textContent).toContain("Bright Finch is asking for what you know. Your answer starts a knowledge base you build together.");
    expect(screen().textContent).toContain("It's about opening an investor pitch.");
    expect(screen().textContent).not.toContain("Amira");
    expect(screen().querySelector("[data-chat-record-answer]")).toBeNull();

    await tap(screen().querySelector("[data-inquiry-open-take]"));
    await flush();
    expect(screen().textContent).toContain("Amira");
    expect(screen().querySelector("[data-chat-take-open]")).not.toBeNull();
    await tap(screen().querySelector("[data-chat-record-answer]"));
    expect(recordedAnswers).toEqual([
      { chatId: "inquiry:m1", name: "Amira", question: "opening an investor pitch", customer: false, slides: ["Why now", "The first number"], inquiry: "m1" },
    ]);

    inside = { ...inside, state: "declined" };
    routes.set("GET /api/v2/take-matches/inquiries", () => ({ inquiries: [] }));
    await tap(screen().querySelector("[data-chat-not-now] button"));
    await flush();
    expect(declined).toEqual(["m1"]);
    expect(row("inquiry:m1")).toBeNull();
  });

  it("their newest Take asks for an answer over its own slides, and Not now leaves it", async () => {
    const AMIRA = {
      id: "c-amira",
      kind: "team",
      title: "Amira Haddad",
      subtitle: "Account executive",
      last: { kind: "take", body: "", mine: false, meta: { take_index: 3 }, created_at: "2026-11-04T11:02:00Z" },
    };
    const meta = { take_index: 3, project_title: "Q3 board pitch", duration_ms: 134_000 };
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [AMIRA] }));
    routes.set("GET /api/v2/chats/c-amira/messages", () => ({
      messages: [{ id: "t1", mine: false, author: "Amira Haddad", kind: "take", body: "", meta, created_at: AMIRA.last.created_at }],
    }));
    routes.set("GET /api/v2/chats/c-amira/messages/t1/take", () => ({
      audio_url: "https://store.example/take-3.webm?sig=1",
      duration_ms: 134_000,
      slides: [{ index: 0, title: "Hook", words: "We grew in Q3." }, { index: 1, title: null, words: "Next, the cities." }],
    }));
    recordedAnswers.length = 0;
    await render();
    await tap(row("c-amira"));
    await tap(container.querySelector("[data-chat-record-answer]"));
    expect(recordedAnswers).toEqual([
      { chatId: "c-amira", name: "Amira Haddad", question: "Q3 board pitch", customer: false, slides: ["Hook", "Q3 board pitch"] },
    ]);
    const declined: string[] = [];
    routes.set("POST /api/v2/chats/c-amira/messages/t1/not-now", () => {
      declined.push("t1");
      return { kept: true };
    });
    await tap(container.querySelector("[data-chat-not-now] button"));
    expect(container.querySelector("[data-chat-record-answer]")).toBeNull();
    expect(container.querySelector("[data-chat-emoji-box]")).not.toBeNull();
    // Nobody is told, and the system keeps it (N504 item 2).
    expect(declined).toEqual(["t1"]);
  });

  it("the first time I add someone, Will's chat opens on his setup, answered by tapping", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [] }));
    routes.set("POST /api/v2/chats/join-questions/setup", () => ({ started: true }));
    const reload = vi.spyOn(loungeThread, "reload");
    await render();
    await tap(container.querySelector("[data-add-someone]"));
    expect(calls("POST /api/v2/chats/join-questions/setup")).toHaveLength(1);
    expect(reload).toHaveBeenCalled();
    expect(container.querySelector("[data-add-sheet]")).toBeNull();
    expect(container.querySelector("[data-chat-header]")?.textContent).toBe("Will");

    // Will's rows, as the Lounge draws them.
    routes.set("GET /api/v2/profile", () => ({ name: "Artur Willonski" }));
    routes.set("POST /api/v2/chats/join-questions/setup/answer", () => ({ messages: [] }));
    const said = (client_id: string, body: string, setup: Record<string, unknown>) =>
      ({ client_id, role: "bot", kind: "text", body, metadata: { join_setup: setup }, client_created_at: "2026-11-04T10:00:00Z" }) as LoungeMessage;
    const words = vi.fn();
    function Row({ message }: { message: LoungeMessage }) {
      const setup = useJoinSetup(async () => {}, () => {});
      return createElement(JoinSetupBubble, {
        message, setup: joinSetupOf(message)!, open: true, onWords: words,
        onTap: (picked: string) => setup.tap(message.client_id, picked), onAgain: setup.again,
      });
    }
    const draw = async (message: LoungeMessage) => {
      await act(async () => root.render(createElement(Row, { message })));
      await flush();
    };
    const answers = () => [...container.querySelectorAll("[data-join-setup-answers] button")].map((b) => b.textContent);
    await draw(said("q-lang", "Should I ask which languages to use: Polish, English or both?", { step: "languages", chips: ["Yes", "No"] }));
    expect(answers()).toEqual(["Something else", "No", "Yes"]);
    await tap([...container.querySelectorAll("[data-join-setup-answers] button")].find((b) => b.textContent === "Something else"));
    expect(words).toHaveBeenCalled();

    const lines = [{ q: "Let's build our knowledge base a month at a time.", answers: [] }, { q: "Are you in a hurry?", answers: ["No", "Yes"] }];
    await draw(said("q-peek", "This is what someone new will see when they open your chat:", { step: "peek", chips: ["That's right", "Change it"], lines }));
    expect(container.querySelector("[data-join-summary]")?.textContent).toBe(
      "You joined thanks to Artur. A few questions first, then you build a knowledge base together." +
      "Let's build our knowledge base a month at a time.Are you in a hurry?NoYes",
    );
    expect(answers()).toEqual(["Change it", "That's right"]);
    await tap([...container.querySelectorAll("[data-join-setup-answers] button")].find((b) => b.textContent === "That's right"));
    expect(JSON.parse(String(calls("POST /api/v2/chats/join-questions/setup/answer")[0]![1]!.body))).toEqual({ to: "q-peek", picked: "That's right" });

    await draw(said("q-set", "You're set. Each question that comes to your chats, and each answer you give, builds a knowledge base you share.", { step: "set" }));
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Copy my link›", "Your questions for people who join›"]);
  });
});
