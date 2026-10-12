// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A FAILED NOTE IS CLEARED BY EVIDENCE (founder 2026-09-21).                */
/*                                                                            */
/*  The Take's job was killed by a worker redeploy, the page's wait ran out   */
/*  and marked it failed (#421), then the sweep requeued the job and it       */
/*  completed — with nobody asking the server again. The red note stayed for  */
/*  nine minutes over a Take that was done. These pin the verdict the hook    */
/*  reads off one readout answer, and that it actually asks.                  */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*  EVIDENCE BEFORE THE CLAIM (founder 2026-09-24).                            */
/*                                                                            */
/*  "Ideal text generation fails!" — shown as the ready v1.0 card with "we     */
/*  couldn't create your Ideal Text" underneath it. The document phase's own   */
/*  120-second cap had expired in the tab and the browser wrote that card      */
/*  straight into the durable thread WITHOUT ASKING THE SERVER. A cap          */
/*  releasing the screen is a fact about this tab; the card is a claim about   */
/*  the take, and this is the check that now stands between the two.           */
/* -------------------------------------------------------------------------- */
describe("asking the server before claiming a take failed", () => {
  beforeEach(() => {
    fetchGuestLabReadout.mockReset();
  });

  it("is unknown, never a verdict, when the server cannot be reached", async () => {
    fetchGuestLabReadout.mockRejectedValue(new Error("offline"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("unknown");
  });
});
