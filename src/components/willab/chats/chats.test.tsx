// @vitest-environment jsdom
/*
STORY    As the founder testing the chats between users (ring 6), I want my
         chats in front of the Lounge, with Will first, so that I can open a
         colleague's or a customer's chat and answer with an emoji; and as
         every other speaker, I want /chat to stay the Lounge as it is.
OUTCOME
  O1  Off (no `chats` in the ring's features_on): nothing is drawn around
      the Lounge and no chat is read (Never 3).
  O2  On: the list stands in front of the Lounge, Will pinned first, then
      the chats with title, subtitle and last message; an empty list asks
      for the demo once. Will's row uncovers the Lounge, never remounted,
      with a back to the list (customer-requests.md C1; N274, N298).
  O3  In a chat, the bar holds only the three emoji; a tap posts
      {"kind":"emoji","body":…} and shows the emoji at once, large, with its
      meaning under it (N306, N311).
PROVES   O1 -> "with chats off, the Lounge is all there is and no chat is read"
         O2 -> "with chats on, Will is pinned over the demo chats, and his row opens the Lounge with a way back"
         O3 -> "an emoji tapped in a chat is posted and shown at once with its meaning"
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

/** As WillabSurface draws it: back, the Lounge, the front. */
function Surface() {
  const chats = useChatsDoor(false);
  return createElement("div", { "data-surface": "" }, chats.back, createElement(Lounge), chats.front);
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

beforeEach(async () => {
  resetRingStateCache();
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
const rows = () => [...container.querySelectorAll<HTMLButtonElement>("[data-chat-row]")];
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
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah", "c-ariel"]);
    expect(rows()[0].textContent).toBe("Will");
    expect(rows()[1].textContent).toBe("SarahInvita customerIs the scalp scrub good for dry hair?");
    expect(rows()[2].textContent).toBe("ArielInvita colleague🙏");
    expect(calls("POST /api/v2/chats/demo")).toHaveLength(1);

    await tap(rows()[0]);
    expect(container.querySelector("[data-chats-front]")).toBeNull();
    expect(container.querySelector("[data-testid=lounge]")).not.toBeNull();
    expect(container.querySelector("[data-chat-header]")?.textContent).toBe("Will");

    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH, ARIEL] }));
    await tap(container.querySelector("[data-chat-header] button"));
    expect(rows().map((r) => r.getAttribute("data-chat-row"))).toEqual(["will", "c-sarah", "c-ariel"]);
    // The demo is asked for once; the Lounge was never mounted twice.
    expect(calls("POST /api/v2/chats/demo")).toHaveLength(1);
    expect(loungeMounts).toBe(1);
  });

  it("an emoji tapped in a chat is posted and shown at once with its meaning", async () => {
    backend(["chats"]);
    routes.set("GET /api/v2/chats", () => ({ chats: [SARAH] }));
    routes.set("GET /api/v2/chats/c-sarah/messages", () => ({
      messages: [{ id: "m1", mine: false, author: "Sarah", kind: "text", body: SARAH.last.body, meta: null, created_at: SARAH.last.created_at }],
    }));
    let release: () => void = () => {};
    const posted = new Promise<void>((resolve) => (release = resolve));
    await render();
    await tap(rows()[1]);

    const screen = container.querySelector("[data-chat-screen]")!;
    expect(screen.querySelector("[data-chat-header]")?.textContent).toBe("SarahInvita customer");
    expect(screen.querySelector("[data-chat-thread]")?.textContent).toBe(SARAH.last.body);
    // The bar: the three emoji and nothing else (no typing, no mic).
    const bar = screen.querySelector("[data-chat-bar]")!;
    expect([...bar.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["👍", "👀", "🙏"]);
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
    expect(sent()).toEqual(["👍It's good"]);
    const post = fetchMock.mock.calls.at(-1)!;
    expect(post[0]).toBe("/api/v2/chats/c-sarah/messages");
    expect(post[1].method).toBe("POST");
    expect(JSON.parse(String(post[1].body))).toEqual({ kind: "emoji", body: "👍" });

    release();
    await flush();
    expect(sent()).toEqual(["👍It's good"]);
  });
});
