// @vitest-environment jsdom
/*
STORY    As someone with the chat builder's ring, Principles tells me what it
         is for before I write anything, and each chat's field says what to
         do there (backend N640).
OUTCOME
  O1  Principles opens with "This is where your principles live. Write
      what's on your mind, and I'll keep it." above everything in it, and
      its field reads "Write here"; Will's chat has no such line and its
      field reads "Message Will".
  O2  In the list, the Principles row shows that line until something else
      is written there, then the newest row's words.
PROVES   O1 -> "Principles opens with its line and Write here; Will's field reads Message Will"
         O2 -> "the list's Principles row shows the opening line until something is written"
WHY      The founder's walk-through, 11 November 2026: Will's field and
         Principles' both read "Type your answer", the field's one words for
         every chat ("Message Will" was only its name for a screen reader).
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../useUserId", () => ({ useUserId: () => "u1" }));
vi.mock("../useSignedIn", () => ({ useSignedIn: () => true }));
vi.mock("./hostsetup/hostWork", async (load) => ({
  ...(await load<object>()),
  useHostWork: () => ({ ring: true, lines: [], checkModel: null, ownChat: false, skipped: [], priceChanges: [], models: [] }),
}));

import Lounge from "../Lounge";
import ChatList from "./ChatList";
import { LoungeThreadProvider } from "../LoungeThreadContext";
import { PRINCIPLES_OPENING, setOpenPlace, type LoungePlace } from "./loungePlace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let rows: unknown[] = [];
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  rows = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("lounge/messages")
        ? new Response(JSON.stringify({ messages: rows, has_more: false, oldest_cursor: null }), { status: 200, headers: { "content-type": "application/json" } })
        : new Response("{}", { status: 404, headers: { "content-type": "application/json" } }),
    ),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setOpenPlace(null);
  vi.unstubAllGlobals();
});
const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 5));
  });
async function lounge(place: LoungePlace) {
  setOpenPlace(place);
  await act(async () =>
    root.render(
      <LoungeThreadProvider signedIn>
        <Lounge state={"lounge_idle" as never} onStart={() => {}} dispatch={() => {}} />
      </LoungeThreadProvider>,
    ),
  );
  await settle();
}
const field = () => host.querySelector("textarea")?.getAttribute("placeholder") ?? null;

it("Principles opens with its line and Write here; Will's field reads Message Will", async () => {
  rows = [{ client_id: "s1", role: "bot", kind: "text", body: "Your feedback is ready.", metadata: null, place: "speaking", client_created_at: "2026-11-11T06:00:00.000Z" }];
  await lounge("principles");
  const opening = host.querySelector("[data-place-opening]");
  expect(opening?.textContent).toBe(PRINCIPLES_OPENING);
  expect(host.querySelector("[data-row]")).toBe(opening);
  expect(field()).toBe("Write here");

  act(() => setOpenPlace("will"));
  await settle();
  expect(host.querySelector("[data-place-opening]")).toBeNull();
  expect(field()).toBe("Message Will");
});

it("the list's Principles row shows the opening line until something is written", async () => {
  const list = () =>
    act(async () =>
      root.render(
        <LoungeThreadProvider signedIn>
          <ChatList chats={[]} onOpenWill={() => {}} onOpenPlace={() => {}} onOpen={() => {}} />
        </LoungeThreadProvider>,
      ),
    );
  await list();
  await settle();
  expect(host.querySelector('[data-chat-row="principles"]')?.textContent).toContain(PRINCIPLES_OPENING);

  act(() => root.unmount());
  root = createRoot(host);
  rows = [{ client_id: "p1", role: "user", kind: "text", body: "Say less, mean more", metadata: { place: "principles" }, place: "principles", client_created_at: "2026-11-11T06:01:00.000Z" }];
  await list();
  await settle();
  const row = host.querySelector('[data-chat-row="principles"]')?.textContent ?? "";
  expect(row).toContain("Say less, mean more");
  expect(row).not.toContain(PRINCIPLES_OPENING);
});
