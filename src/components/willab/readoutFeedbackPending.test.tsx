// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE POST-TAKE READOUT TELLS THE DECK WHEN FEEDBACK IS STILL ARRIVING      */
/*  (audit 2026-10-05, DL-overlays; the paragraph sheet's bounded wait,       */
/*  founder 2026-09-28).                                                      */
/*                                                                            */
/*  The core read paints the words and the moments come with the enrichment  */
/*  read after it. The Ideal Text page passed that to the deck; the readout  */
/*  did not, so a paragraph tapped there before the enrichment landed opened */
/*  its sheet without its moment. Wiring only: nothing new is drawn.         */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seen: (boolean | undefined)[] = [];
vi.mock("./TranscriptReviewDeck", () => ({
  default: (props: { feedbackPending?: boolean }) => {
    seen.push(props.feedbackPending);
    return null;
  },
}));
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadCtx: () => ({ reload: vi.fn() }),
}));
vi.mock("./useArcDeckRef", () => ({ useArcDeckRef: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "tok") }));

import IdealTextReadout from "./IdealTextReadout";
import type { ReadoutPayload } from "./readout";

const payload = {
  snippets: [],
  feedbackItems: [],
  overallMessage: null,
  presentationRef: null,
  slides: [],
  slideTranscripts: [],
  fullTranscriptChunks: [{ transcript: "Core document." }],
  instantChunks: [],
  voiceMetricsAvailable: true,
  parentAudioRef: null,
  audience: null,
  auditPaid: true,
} as unknown as ReadoutPayload;

const CORE = {
  status: "unverified",
  text: "Core document.",
  version: 2,
  document_snapshot_id: "snap-1",
  document_snapshot_sha256: "a".repeat(64),
  slide_titles: ["Opening"],
  pieces: [{ piece_key: 0, part_id: "part-1", text: "Core document.", slide_index: 0 }],
  parts: null,
  can_record_take: true,
};

/** Nothing retryable: the server is done with this revision. */
const ENRICHMENT = {
  document_snapshot_id: "snap-1",
  sections: {
    feedback: { status: "ready", data: { key_moments: [], explanations_available: false } },
  },
};

let finishEnrichment: (body: unknown, status?: number) => void = () => undefined;

function route() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (String(url).includes("/ideal-text/enrichment")) {
        return new Promise<Response>((resolve) => {
          finishEnrichment = (body, status = 200) => resolve(json(body, status));
        });
      }
      if (String(url).includes("/ideal-text")) return Promise.resolve(json(CORE));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }),
  );
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  seen.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  route();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });

async function render() {
  await act(async () => {
    root.render(
      createElement(IdealTextReadout, {
        payload,
        sessionId: "take-1",
        arcId: "arc-1",
        signedIn: true,
        onAutoSent: () => {},
        onSignUp: () => {},
      }),
    );
  });
  await settle();
}

describe("the readout's deck knows the feedback is still on its way", () => {
  it("holds taps while the enrichment read is out, and stops once the server is done", async () => {
    await render();
    // The words are painted; the moments are not here yet.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe(true);
    await act(async () => finishEnrichment(ENRICHMENT));
    await settle();
    expect(seen.at(-1)).toBe(false);
  });

  it("stops holding when the enrichment read answers without anything to add", async () => {
    await render();
    expect(seen.at(-1)).toBe(true);
    await act(async () => finishEnrichment({ code: "X" }, 500));
    await settle();
    expect(seen.at(-1)).toBe(false);
  });
});
