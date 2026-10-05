// @vitest-environment jsdom
/* The slide stays as a thumbnail on Read (founder 2026-09-30, B5; build plan
 * P2-19 removed the slide-mapping control beside it). Pins, through the walk
 * itself: the session read's own slide and deck reach Read as a thumbnail of
 * that page; the Judge screen before it shows nothing of the slide (BLIND
 * COACH: the clip and the question only); a moment with no picture draws no
 * box at all. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/willab/pdfSlides", () => ({
  PdfPage: ({ url, pageIndex }: { url: string; pageIndex: number }) =>
    createElement("canvas", { "data-testid": "pdf-page", "data-url": url, "data-page": String(pageIndex) }),
  MockPresentationSlide: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "mock-slide" }, title),
}));

import CoachWalkOverlay from "./CoachWalkOverlay";
import type { QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";

const TAKE = "22222222-2222-2222-2222-222222222222";
const JUDGED = "33333333-3333-3333-3333-333333333331";
const OPEN = "33333333-3333-3333-3333-333333333332";
const NO_SLIDE = "33333333-3333-3333-3333-333333333333";

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function session(presentationRef: string | null) {
  return {
    session_id: TAKE,
    presentation_ref: presentationRef,
    context_unlocked: false,
    snippets: [
      { id: JUDGED, index: 0, audio_ref: null, start_offset_ms: 0, duration_ms: 9000,
        slide: { index: 1, title: "Development", body: "" } },
      { id: OPEN, index: 1, audio_ref: null, start_offset_ms: 9000, duration_ms: 7000,
        slide: { index: 2, title: "Conclusion", body: "" } },
      { id: NO_SLIDE, index: 2, audio_ref: null, start_offset_ms: 16000, duration_ms: 5000, slide: null },
    ],
  };
}

const READ = {
  passage: "Here is the number that matters.", speaker_answer: "yes", coach_answer: "yes",
  speaker_goal: null, request: null, practice: null,
};

describe("the slide on Read (B5)", () => {
  let host: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

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

  async function walk(presentationRef: string | null, start: string): Promise<void> {
    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);
      if (path.endsWith("/moment")) return reply(READ);
      if (path.includes("/speaking-errors")) return reply({ errors: [] });
      if (path.endsWith(`/coach/sessions/${TAKE}`)) return reply(session(presentationRef));
      return reply({});
    });
    const take: QueueTake = {
      sessionId: TAKE, takeIndex: 2, sentAt: "2026-10-05T10:00:00Z", waiting: 1, waitingForText: false,
      moments: [
        { snippetId: JUDGED, state: "judged", kind: "praise" },
        { snippetId: OPEN, state: "judge_it", kind: null },
        { snippetId: NO_SLIDE, state: "judged", kind: "praise" },
      ],
    };
    const speaker: QueueSpeaker = { pseudonym: "Quiet Heron", waiting: 1, takes: [take] };
    await act(async () => {
      root.render(createElement(CoachWalkOverlay, {
        speakers: [speaker], speaker, take, startSnippetId: start,
        onClose: () => {}, onOpenMoment: () => {}, onChanged: () => {},
      }));
    });
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  }

  it("Read shows the page of the take's own deck the moment began on", async () => {
    await walk("https://media/deck.pdf", JUDGED);
    expect(host.querySelector('[data-testid="coach-read-sheet"]')).not.toBeNull();
    const page = host.querySelector('[data-testid="coach-read-slide"] [data-testid="pdf-page"]');
    expect(page?.getAttribute("data-url")).toBe("https://media/deck.pdf");
    expect(page?.getAttribute("data-page")).toBe("1");
  });

  it("a deckless take shows the default deck's slide it was on", async () => {
    await walk(null, JUDGED);
    expect(host.querySelector('[data-testid="coach-read-slide"] [data-testid="mock-slide"]')?.textContent)
      .toBe("Development");
  });

  it("the Judge screen before Read shows nothing of the slide", async () => {
    await walk("https://media/deck.pdf", OPEN);
    expect(host.querySelector('[data-testid="coach-judge-sheet"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="coach-read-slide"]')).toBeNull();
    expect(host.querySelector('[data-testid="pdf-page"]')).toBeNull();
    expect(host.textContent).not.toContain("Conclusion");
  });

  it("a moment with no slide draws no box", async () => {
    await walk("https://media/deck.pdf", NO_SLIDE);
    expect(host.querySelector('[data-testid="coach-read-sheet"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="coach-read-slide"]')).toBeNull();
  });
});
