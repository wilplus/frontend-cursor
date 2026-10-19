// @vitest-environment jsdom
/*
STORY    As a speaker, I want AI-written text marked as AI on every Ideal Text
         surface and copy, with no score in the label, so that I know what is
         generated (EU AI Act Art. 50).
OUTCOME
  O1  The labels say the text is AI-generated and carry no digit, score,
      rating or verdict. Never-1: no score shown to a speaker.
  O2  Both Ideal Text mounts (the notebook and the post-Take readout) render
      the visible AI note with the Take it names, on a marked container, and
      their Copy puts the marked text on the clipboard.
PROVES   O1 -> "states provenance and never a score, rating, band or verdict"
         O2 -> "<mount> shows the AI note and copies marked text" (x2)
WHY      Regulation (EU) 2024/1689 Art. 50(2), in force since 2 August 2026.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/willab/TranscriptReviewDeck", () => ({ default: () => null }));
vi.mock("@/components/willab/LoungeThreadContext", () => ({
  useLoungeThreadCtx: () => ({ reload: vi.fn() }),
}));
vi.mock("@/components/willab/useArcDeckRef", () => ({ useArcDeckRef: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "tok") }));

import { AI_GENERATED_LABEL } from "./aiGeneratedMark";
import IdealTextOverlay from "@/components/willab/IdealTextOverlay";
import IdealTextReadout from "@/components/willab/IdealTextReadout";
import type { ReadoutPayload } from "@/components/willab/readout";

describe("AC-9 holds at the label", () => {
  it("states provenance and never a score, rating, band or verdict", () => {
    for (const label of Object.values(AI_GENERATED_LABEL)) {
      expect(label).toMatch(/AI-generated|Written by AI/);
      expect(label).not.toMatch(/\d/);
      expect(label.toLowerCase()).not.toMatch(
        /score|rating|grade|rank|percent|confidence level|out of/,
      );
    }
  });
});

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

let host: HTMLDivElement;
let root: Root;
let clipboard: { type: string; text: string }[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clipboard = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/ideal-text/enrichment")) {
        return json({ document_snapshot_id: "snap-1", sections: {} });
      }
      if (String(url).includes("/ideal-text")) return json(CORE);
      return new Response("{}", { status: 404 });
    }),
  );
  class FakeClipboardItem {
    constructor(public items: Record<string, Blob>) {}
  }
  vi.stubGlobal("ClipboardItem", FakeClipboardItem);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      write: async (items: FakeClipboardItem[]) => {
        for (const [type, blob] of Object.entries(items[0].items)) {
          clipboard.push({ type, text: await blob.text() });
        }
      },
      writeText: async (text: string) => {
        clipboard.push({ type: "text/plain", text });
      },
    },
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });

async function expectMarkedAndCopied() {
  await settle();
  // The visible note: what the speaker reads.
  const note = [...host.querySelectorAll("p")].find((p) =>
    p.textContent?.startsWith("AI-generated text"),
  );
  expect(note, "visible AI note").toBeTruthy();
  expect(note!.textContent).toBe("AI-generated text · Take 2");
  // The generated text sits inside a machine-readable marked container.
  const marked = note!.closest('[data-ai-generated="true"]');
  expect(marked).not.toBeNull();
  expect(host.querySelector('[data-ai-generated-kind="ideal-text"]')).not.toBeNull();

  // Copy from the ⋯ menu: the rich flavour carries the mark.
  const more = host.querySelector<HTMLButtonElement>('button[aria-label="More"]');
  expect(more, "the ⋯ menu").not.toBeNull();
  await act(async () => more!.click());
  const copy = host.querySelector<HTMLButtonElement>('button[aria-label="Copy the text"]');
  expect(copy, "Copy in the menu").not.toBeNull();
  await act(async () => copy!.click());
  await settle();
  const html = clipboard.find((c) => c.type === "text/html");
  const plain = clipboard.find((c) => c.type === "text/plain");
  expect(plain?.text).toBe("Core document.");
  expect(html?.text).toContain('data-ai-generated="true"');
  expect(html?.text).toContain("Core document.");
}

describe("Article 50(2): every Ideal Text mount is marked, on screen and on copy", () => {
  it("the notebook (IdealTextOverlay) shows the AI note and copies marked text", async () => {
    await act(async () => {
      root.render(createElement(IdealTextOverlay, { arcId: "arc-1", onClose: () => {} }));
    });
    await expectMarkedAndCopied();
  });

  it("the readout (IdealTextReadout) shows the AI note and copies marked text", async () => {
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
    await expectMarkedAndCopied();
  });
});
