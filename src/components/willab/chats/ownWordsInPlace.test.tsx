// @vitest-environment jsdom
/*
STORY    As someone with the chat builder's ring, what I type in Principles
         (or Will's chat, or the speaking chat) is drawn as mine: orange, on
         the right, like anything I send (the founder's walk-through, 11
         November 2026: "What are my strengths" in Principles drawn grey on
         the left, like Will's).
OUTCOME
  O1  My own row in Principles is drawn as mine, also one written with an
      offer's mark (the mark #1391 gave it), which is never drawn as Will's
      offer; Will's own offer row is still his.
  O2  What I type in a chat carries only its chat (and, in the speaking
      chat, its Take), never an offer's mark.
PROVES   O1 -> "my own words in Principles are mine, on the right"
         O2 -> loungePlace.test.tsx "N636-2"
WHY      #1391 marked a row typed in Principles with offer "voice_notebook",
         and a row with an offer's mark was drawn as Will's offer whoever
         wrote it.
*/
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../useUserId", () => ({ useUserId: () => "u1" }));
vi.mock("../useSignedIn", () => ({ useSignedIn: () => true }));

import Lounge from "../Lounge";
import { LoungeThreadProvider } from "../LoungeThreadContext";
import { setOpenPlace } from "./loungePlace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = (minute: number) => `2026-11-11T06:${String(minute).padStart(2, "0")}:00.000Z`;
const ROWS = [
  { client_id: "b1", role: "bot", kind: "text", body: "Do you understand the rules and want this feature on?", metadata: { offer: "voice_notebook" }, place: "principles", client_created_at: at(1) },
  { client_id: "u1", role: "user", kind: "text", body: "What are my strengths", metadata: { place: "principles", offer: "voice_notebook" }, place: "principles", client_created_at: at(2) },
  { client_id: "u2", role: "user", kind: "text", body: "And my habits", metadata: { place: "principles" }, place: "principles", client_created_at: at(3) },
];

it("my own words in Principles are mine, on the right", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("lounge/messages")
        ? new Response(JSON.stringify({ messages: ROWS, has_more: false, oldest_cursor: null }), { status: 200, headers: { "content-type": "application/json" } })
        : new Response("{}", { status: 404, headers: { "content-type": "application/json" } }),
    ),
  );
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  setOpenPlace("principles");
  await act(async () =>
    root.render(
      <LoungeThreadProvider signedIn>
        <Lounge state={"lounge_idle" as never} onStart={() => {}} dispatch={() => {}} />
      </LoungeThreadProvider>,
    ),
  );
  await act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 5));
  });
  const mine = [...host.querySelectorAll("[data-row='me']")].map((el) => el.textContent);
  expect(mine).toEqual(["What are my strengths", "And my habits"]);
  const wills = [...host.querySelectorAll("[data-row='app']")].map((el) => el.textContent);
  expect(wills).toContain("Do you understand the rules and want this feature on?");
  expect(wills).not.toContain("What are my strengths");
  act(() => root.unmount());
  host.remove();
  setOpenPlace(null);
  vi.unstubAllGlobals();
});
