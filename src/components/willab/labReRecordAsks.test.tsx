// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  N28 — "Record again" from the slow-processing screen asks too.            */
/*                                                                            */
/*  The founder's rule: "if you have it OFF it shows each time you are        */
/*  starting a take". "Record Take 2" from the text already put "Turn on the  */
/*  learning?" in front of the mic; "Record again" on the slow-processing     */
/*  screen also starts a new Take (the abandoned one still finishes server-   */
/*  side) and went straight to the mic. It now goes through the same          */
/*  askThenRun / NextTakeGate path, with TrainingAsk's signed copy and no new */
/*  words. The Yes/Skip tap is the gesture mic.start needs, and it never      */
/*  gates when there is nothing to ask: a guest, the switch already on, a     */
/*  failed read.                                                              */
/*                                                                            */
/*  Two halves, like the rest of LabOverlay's tests (the overlay needs a live */
/*  microphone to render): the real Processing screen inside the real gate,   */
/*  wired as the host wires it; and the host's wiring pinned in its source.   */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchTrainingConsent: vi.fn(),
  setTrainingConsent: vi.fn(),
}));

let authToken: string | null = "session-token";
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(authToken),
}));
vi.mock("@/services/api/trainingConsent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/trainingConsent")>();
  return { ...actual, ...api };
});

import { Processing } from "./LabOverlay";
import {
  NextTakeGate,
  TRAINING_ASK_COPY,
  askThenRun,
  prefetchTrainingAsk,
  resetTrainingAsk,
} from "./TrainingAsk";
import type { TrainingConsent } from "@/services/api/trainingConsent";

const HOST = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

function consent(over: Partial<TrainingConsent> = {}): TrainingConsent {
  return {
    available: true,
    active: false,
    policyVersion: "training-v1",
    copy: "Keep separate copies of short moments from my recordings to train WillpowerLab.",
    copySha256: "c".repeat(64),
    ...over,
  };
}

/** The host's wiring, in miniature: Processing's "Record again" runs
 *  askThenRun(reRecord, abandon + ask), and NextTakeGate's onDone runs
 *  reRecord. `reRecord` stands in for cancelMic + take_started + mic.start. */
function Host({ reRecord, abandon }: { reRecord: () => void; abandon: () => void }) {
  const [asking, setAsking] = useState(false);
  return createElement(
    NextTakeGate,
    {
      asking,
      onDone: () => {
        setAsking(false);
        reRecord();
      },
    },
    createElement(Processing, {
      error: null,
      slow: true,
      onRetry: () => undefined,
      onClose: () => undefined,
      onReRecord: () =>
        askThenRun(reRecord, () => {
          abandon();
          setAsking(true);
        }),
    }),
  );
}

let container: HTMLDivElement;
let root: Root;
let reRecord: ReturnType<typeof vi.fn<() => void>>;
let abandon: ReturnType<typeof vi.fn<() => void>>;

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
const button = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => (b.textContent ?? "").trim() === label,
  );
const question = () => container.querySelector("h2")?.textContent ?? null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  reRecord = vi.fn<() => void>();
  abandon = vi.fn<() => void>();
  authToken = "session-token";
  resetTrainingAsk();
  api.fetchTrainingConsent.mockReset();
  api.setTrainingConsent.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetTrainingAsk();
});

/** The Lab opened (the read starts on mount) and the analysis went slow. */
async function openSlowScreen(read: TrainingConsent | null) {
  api.fetchTrainingConsent.mockResolvedValue(read);
  prefetchTrainingAsk();
  await flush();
  act(() => root.render(createElement(Host, { reRecord, abandon })));
}

/** Tap "Record again"; report whether the mic started inside that tap. */
function tapRecordAgain(): boolean {
  act(() => {
    button("Record again")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return reRecord.mock.calls.length > 0;
}

describe("while the learning is off, Record again asks first", () => {
  it("shows the existing question instead of starting the mic", async () => {
    await openSlowScreen(consent());
    expect(tapRecordAgain()).toBe(false);
    expect(question()).toBe(TRAINING_ASK_COPY.question);
    expect(button(TRAINING_ASK_COPY.yes)).toBeTruthy();
    expect(button(TRAINING_ASK_COPY.skip)).toBeTruthy();
    // The slow take is abandoned on the tap, so a result that lands while
    // the speaker answers cannot carry them to the old take's text.
    expect(abandon).toHaveBeenCalledTimes(1);
  });

  it("Skip is the tap that starts the mic, and sends nothing", async () => {
    await openSlowScreen(consent());
    tapRecordAgain();
    act(() => button(TRAINING_ASK_COPY.skip)!.click());
    expect(reRecord).toHaveBeenCalledTimes(1);
    expect(api.setTrainingConsent).not.toHaveBeenCalled();
  });

  it("Yes sends the yes against what was shown, then starts the mic", async () => {
    await openSlowScreen(consent());
    api.setTrainingConsent.mockResolvedValue(consent({ active: true }));
    tapRecordAgain();
    await act(async () => button(TRAINING_ASK_COPY.yes)!.click());
    await flush();
    expect(api.setTrainingConsent).toHaveBeenCalledWith(true, consent());
    expect(reRecord).toHaveBeenCalledTimes(1);
  });
});

describe("never a gate when there is nothing to ask", () => {
  it("the switch already on: the mic starts inside the same tap", async () => {
    await openSlowScreen(consent({ active: true }));
    expect(tapRecordAgain()).toBe(true);
    expect(question()).toBeNull();
    expect(abandon).not.toHaveBeenCalled();
  });

  it("a guest: no read, and the mic starts inside the same tap", async () => {
    authToken = null;
    await openSlowScreen(consent());
    expect(api.fetchTrainingConsent).not.toHaveBeenCalled();
    expect(tapRecordAgain()).toBe(true);
    expect(question()).toBeNull();
  });

  it("a failed or closed read: the mic starts inside the same tap", async () => {
    await openSlowScreen(null);
    expect(tapRecordAgain()).toBe(true);
    expect(question()).toBeNull();
  });

  it("a slow read shows the loading state, then passes when it settles empty", async () => {
    let settle: (value: TrainingConsent | null) => void = () => undefined;
    api.fetchTrainingConsent.mockReturnValue(
      new Promise<TrainingConsent | null>((resolve) => {
        settle = resolve;
      }),
    );
    prefetchTrainingAsk();
    act(() => root.render(createElement(Host, { reRecord, abandon })));
    tapRecordAgain();
    expect(question()).toBeNull();
    expect(container.innerHTML).not.toBe("");
    settle(null);
    await flush();
    expect(question()).toBeNull();
    expect(reRecord).toHaveBeenCalledTimes(1);
  });
});

describe("the host wires Record again exactly like Record Take 2", () => {
  const processing = HOST.slice(HOST.indexOf('{state === "lab_processing" && ('));
  const block = processing.slice(0, processing.indexOf("</NextTakeGate>"));

  it("hands Processing the asking handler, not the mic", () => {
    expect(block).toMatch(/onReRecord=\{askThenReRecord\}/);
    expect(block).not.toMatch(/mic\.start\(\)/);
  });

  it("puts the question in front of the processing screen", () => {
    expect(block).toMatch(
      /<NextTakeGate\s+asking=\{askBeforeReRecord\}\s+onDone=\{\(\) => \{\s*setAskBeforeReRecord\(false\);\s*markTrainingAsked\(\);\s*reRecord\(\);\s*\}\}\s*>\s*<Processing/,
    );
  });

  it("asks through askThenRun, abandoning the slow take before the question", () => {
    const fn = HOST.slice(HOST.indexOf("function askThenReRecord()"));
    const body = fn.slice(0, fn.indexOf("\n  }\n"));
    expect(body).toMatch(
      /askThenRun\(reRecord, \(\) => \{\s*abandonSlowTake\(\);\s*setAskBeforeReRecord\(true\);\s*\}\)/,
    );
  });

  it("re-records the way it always did: abandon, reset the mic, new Take, start", () => {
    const fn = HOST.slice(HOST.indexOf("function reRecord()"));
    const body = fn.slice(0, fn.indexOf("\n  }\n"));
    expect(body).toMatch(
      // Take 1 holds the mic for the learning screen (founder lock
      // 2026-10-07); a later Take records at once.
      /abandonSlowTake\(\);[\s\S]*cancelMic\(\);\s*dispatch\("take_started"\);\s*void mic\.start\(\{ arm: arcTakeIndex <= 1 \}\);/,
    );
    const abandonFn = HOST.slice(HOST.indexOf("function abandonSlowTake()"));
    const abandonBody = abandonFn.slice(0, abandonFn.indexOf("\n  }\n"));
    for (const step of [
      "pendingCarryRef.current = null;",
      "setPollSessionId(null);",
      "setPollSlow(false);",
      "setProcessingReady(false);",
      "uploadStartedRef.current = false;",
      "setBlob(null);",
      "startPendingRef.current = true;",
    ]) {
      expect(abandonBody).toContain(step);
    }
    expect(abandonBody).not.toMatch(/mic\.start|dispatch\(/);
  });
});
