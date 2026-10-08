// @vitest-environment jsdom
/* The old walk's waits (founder 2026-10-08, coach-panel waiting time). Pins,
 * through the walk itself: C1, the tap moves to Read at once with the save
 * in flight, Read holds its loading line and reads nothing until the save
 * succeeds, and a failed save brings Judge back with its sentence; C2, Read
 * takes the read the saved rating returned and asks for nothing more, and
 * reads GET …/moment as before when the save did not bring one. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

import CoachWalkOverlay from "./CoachWalkOverlay";
import type { QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";

const TAKE = "22222222-2222-2222-2222-222222222222";
const OPEN = "33333333-3333-3333-3333-333333333332";

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const SESSION = {
  session_id: TAKE, presentation_ref: null, context_unlocked: false,
  snippets: [{ id: OPEN, index: 0, audio_ref: null, start_offset_ms: 0, duration_ms: 7000, slide: null }],
};
const SEEDED = {
  passage: "The passage the save brought.", speaker_answer: "yes", coach_answer: "yes",
  speaker_goal: null, request: null, practice: null,
};
const FETCHED = { ...SEEDED, passage: "The passage GET /moment read." };

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
const calls = (pred: (url: string, init?: RequestInit) => boolean) =>
  fetchMock.mock.calls.filter(([url, init]) => pred(String(url), init as RequestInit | undefined));
const momentGets = () => calls((url) => url.endsWith("/moment"));
const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

/** The walk on one open moment; `label` answers the label PUT. */
async function walk(label: () => Promise<Response>): Promise<void> {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/confidence-label") && init?.method === "PUT") return label();
    if (path.endsWith("/moment")) return reply(FETCHED);
    if (path.includes("/speaking-errors")) return reply({ errors: [] });
    if (path.endsWith(`/coach/sessions/${TAKE}`)) return reply(SESSION);
    return reply({});
  });
  const take: QueueTake = {
    sessionId: TAKE, takeIndex: 2, sentAt: "2026-10-05T10:00:00Z", waiting: 1, waitingForText: false,
    moments: [{ snippetId: OPEN, state: "judge_it", kind: null }],
  };
  const speaker: QueueSpeaker = { pseudonym: "Quiet Heron", waiting: 1, takes: [take] };
  await act(async () => {
    root.render(createElement(CoachWalkOverlay, {
      speakers: [speaker], speaker, take, startSnippetId: OPEN,
      onClose: () => {}, onOpenMoment: () => {}, onChanged: () => {},
    }));
  });
  await settle();
}

function tap(label: string): void {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!button) throw new Error(`no button ${label}`);
  act(() => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

describe("C2: Read arrives with the saved answer", () => {
  it("the read the save returned is Read's; GET …/moment is never asked", async () => {
    await walk(async () => reply({ ok: true, moment_read: SEEDED }));
    expect(momentGets()).toHaveLength(0);
    tap("Yes — Confident");
    await settle();
    expect(host.querySelector('[data-testid="coach-read-sheet"]')).not.toBeNull();
    expect(host.textContent).toContain(SEEDED.passage);
    expect(momentGets()).toHaveLength(0);
  });

  it("no read on the save (an older backend): GET …/moment, after the save", async () => {
    await walk(async () => reply({ ok: true }));
    tap("Yes — Confident");
    await settle();
    expect(host.textContent).toContain(FETCHED.passage);
    expect(momentGets()).toHaveLength(1);
    const order = fetchMock.mock.calls.map(([url]) => String(url));
    expect(order.findIndex((u) => u.endsWith("/confidence-label")))
      .toBeLessThan(order.findIndex((u) => u.endsWith("/moment")));
  });
});

describe("C1: Read does not wait on the save", () => {
  it("the tap moves to Read at once; its loading line holds until the save succeeds", async () => {
    let answer: (r: Response) => void = () => {};
    await walk(() => new Promise<Response>((r) => { answer = r; }));
    tap("Yes — Confident");
    await settle();
    expect(host.querySelector('[data-testid="coach-judge-sheet"]')).toBeNull();
    expect(host.querySelector('[data-testid="coach-read-sheet"]')).not.toBeNull();
    expect(host.textContent).toContain("Reading the moment");
    expect(momentGets()).toHaveLength(0); // BLIND: nothing read before the save
    expect(host.textContent).not.toContain(FETCHED.passage);
    answer(reply({ ok: true }));
    await settle();
    expect(momentGets()).toHaveLength(1);
    expect(host.textContent).toContain(FETCHED.passage);
  });

  it("a failed save brings Judge back with its sentence, and nothing of the moment is read", async () => {
    let answer: (r: Response) => void = () => {};
    await walk(() => new Promise<Response>((r) => { answer = r; }));
    tap("Yes — Confident");
    await settle();
    expect(host.querySelector('[data-testid="coach-read-sheet"]')).not.toBeNull();
    answer(reply({ error: "Rate in a language you know." }, 400));
    await settle();
    expect(host.querySelector('[data-testid="coach-read-sheet"]')).toBeNull();
    expect(host.querySelector('[data-testid="coach-judge-sheet"]')).not.toBeNull();
    expect(host.textContent).toContain("Rate in a language you know.");
    expect(momentGets()).toHaveLength(0);
  });
});
