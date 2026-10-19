// @vitest-environment jsdom
/*
STORY    As a speaker, I want a "failed" note under my Take cleared when the
         server says the Take actually finished, and never a failure claimed
         without asking the server, so that I am not told a done Take failed
         and can go on to my Ideal Text and the next Take.
OUTCOME
  O1  While a failed note is on screen the hook asks the server at once and
      reports "recovered" when the Take is done.
  O2  The server cannot be reached: "unknown", never a verdict.
  O3  The server says the Take failed: "still_failed", the note stays.
  O4  An answer with no known state and no content: "unknown", not recovered.
PROVES   O1 -> "asks the server as soon as a failed note is on screen, and reports what it said"
         O2 -> "is unknown, never a verdict, when the server cannot be reached"
         O3 -> "keeps a Take failed when the server says it failed"
         O4 -> "is unknown when the answer has no known state and no content"
WHY      Founder 2026-09-21 (a red note stayed 9 min over a done Take) and
         2026-09-24 (a failure card written without asking the server).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LabReadoutReread } from "@/services/api/labRecording";

const { fetchGuestLabReadout } = vi.hoisted(() => ({
  fetchGuestLabReadout: vi.fn(async (_sessionId: string) => null as LabReadoutReread | null),
}));
vi.mock("@/services/api/labRecording", () => ({ fetchGuestLabReadout }));

import {
  probeTakeVerdict,
  useFailedTakeRecheck,
  type FailedTakeVerdict,
} from "./useFailedTakeRecheck";

function answer(state: string | null, content = false): LabReadoutReread {
  return {
    state,
    readout: {
      snippets: content ? [{ id: "x" }] : [],
      instantChunks: [],
      fullTranscriptChunks: [],
    } as unknown as LabReadoutReread["readout"],
    processing: null,
    setup: null,
  };
}

describe("the hook", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function Probe(props: {
    sessionId: string | null;
    onVerdict: (sessionId: string, verdict: FailedTakeVerdict) => void;
  }) {
    useFailedTakeRecheck(props);
    return null;
  }

  it("asks the server as soon as a failed note is on screen, and reports what it said", async () => {
    fetchGuestLabReadout.mockResolvedValueOnce(answer("readout_ready"));
    const onVerdict = vi.fn();
    await act(async () => {
      root.render(createElement(Probe, { sessionId: "take-3", onVerdict }));
    });
    expect(fetchGuestLabReadout).toHaveBeenCalledWith("take-3");
    expect(onVerdict).toHaveBeenCalledWith("take-3", "recovered");
  });
});

describe("asking the server before claiming a take failed", () => {
  beforeEach(() => {
    fetchGuestLabReadout.mockReset();
  });

  it("is unknown, never a verdict, when the server cannot be reached", async () => {
    fetchGuestLabReadout.mockRejectedValue(new Error("offline"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("unknown");
  });

  it("keeps a Take failed when the server says it failed", async () => {
    fetchGuestLabReadout.mockResolvedValue(answer("failed"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("still_failed");
    fetchGuestLabReadout.mockResolvedValue(answer("failed_ideal_text_unconfirmed", true));
    await expect(probeTakeVerdict("s1")).resolves.toBe("still_failed");
  });

  it("is unknown when the answer has no known state and no content", async () => {
    fetchGuestLabReadout.mockResolvedValue(answer("queued"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("unknown");
    // The same state WITH content is the evidence that clears the note.
    fetchGuestLabReadout.mockResolvedValue(answer("queued", true));
    await expect(probeTakeVerdict("s1")).resolves.toBe("recovered");
  });
});
