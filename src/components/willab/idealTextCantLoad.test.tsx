// @vitest-environment jsdom
/*
STORY    As a speaker whose Ideal Text could not load, I want the page to try
         again by itself and give me Try again, so that I never have to close
         and reopen it to see my words.
OUTCOME
  O1  The line shows with "Try again" under it; the page reads again by
      itself 3 s and 10 s after the failed load, the line staying on screen
      while it reads, and then stops.
  O2  "Try again" reads at once, and a tap that fails too starts the two
      tries afresh; a read that answers shows the page.
PROVES   O1 -> "reads again by itself at 3 s and 10 s, then stops"
         O2 -> "Try again reads at once, and an answer shows the page"
WHY      Founder 2026-11-09, "Both" (backend N552); Never 3.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The deck draws the words it is given; its own behaviour is not this test's.
vi.mock("@/components/willab/TranscriptReviewDeck", async () => {
  const react = await import("react");
  return {
    default: ({ document }: { document: string }) => react.createElement("p", null, document),
  };
});
vi.mock("@/components/willab/LoungeThreadContext", () => ({
  useLoungeThreadCtx: () => ({ reload: vi.fn() }),
}));
vi.mock("@/components/willab/useArcDeckRef", () => ({ useArcDeckRef: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "tok") }));

import IdealTextOverlay from "./IdealTextOverlay";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";

const LINE = "Couldn't load your ideal text. Try again in a moment.";

const CORE = {
  status: "unverified",
  text: "Core document.",
  version: 2,
  take_count: 2,
  document_snapshot_id: "snap-1",
  document_snapshot_sha256: "a".repeat(64),
  slide_titles: ["Opening"],
  pieces: [{ piece_key: 0, part_id: "part-1", text: "Core document.", slide_index: 0 }],
  parts: null,
  can_record_take: true,
};

let host: HTMLDivElement;
let root: Root;
/** Every read of the page, answered by the test when it chooses. */
let reads: Array<(answer: "fails" | "answers") => void>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  reads = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/ideal-text/core")) {
        return new Promise<Response>((resolve) => {
          reads.push((answer) => resolve(answer === "answers" ? json(CORE) : json({}, 500)));
        });
      }
      if (String(url).includes("/ideal-text/enrichment")) {
        return Promise.resolve(json({ document_snapshot_id: "snap-1", sections: {} }));
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    }),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });

async function open() {
  await act(async () => {
    root.render(createElement(IdealTextOverlay, { arcId: "arc-1", onClose: () => {} }));
  });
  await settle();
}

async function answerLast(answer: "fails" | "answers") {
  await act(async () => reads[reads.length - 1](answer));
  await settle();
}

async function after(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await settle();
}

const tryAgain = () =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === IDEAL_EDIT_COPY.feedbackRetry);
const showsLine = () => Boolean(host.textContent?.includes(LINE));

describe("the Ideal Text page that can't load (N552)", () => {
  it("reads again by itself at 3 s and 10 s, then stops", async () => {
    await open();
    expect(reads).toHaveLength(1);
    await answerLast("fails");
    expect(showsLine()).toBe(true);
    expect(tryAgain()).toBeTruthy();

    await after(2999);
    expect(reads).toHaveLength(1);
    await after(1);
    expect(reads).toHaveLength(2);
    // While it reads, the line and the button stay: no loader in their place.
    expect(showsLine()).toBe(true);
    expect(tryAgain()).toBeTruthy();
    await answerLast("fails");
    expect(showsLine()).toBe(true);

    await after(6999);
    expect(reads).toHaveLength(2);
    await after(1);
    expect(reads).toHaveLength(3);
    expect(showsLine()).toBe(true);
    await answerLast("fails");
    expect(showsLine()).toBe(true);
    expect(tryAgain()).toBeTruthy();

    await after(60_000);
    expect(reads).toHaveLength(3);
  });

  it("Try again reads at once, and an answer shows the page", async () => {
    await open();
    await answerLast("fails");
    await after(1000);

    await act(async () => tryAgain()!.click());
    await settle();
    expect(reads).toHaveLength(2);
    expect(showsLine()).toBe(true);
    await answerLast("fails");
    expect(showsLine()).toBe(true);
    expect(tryAgain()).toBeTruthy();

    // The tap's failure starts the two tries afresh: the open's try that
    // was due at 3 s is gone, the next comes 3 s after the tap's failure.
    await after(2999);
    expect(reads).toHaveLength(2);
    await after(1);
    expect(reads).toHaveLength(3);
    await answerLast("answers");
    expect(showsLine()).toBe(false);
    expect(tryAgain()).toBeUndefined();
    expect(host.textContent).toContain("Core document.");

    await after(60_000);
    expect(reads).toHaveLength(3);
  });
});
