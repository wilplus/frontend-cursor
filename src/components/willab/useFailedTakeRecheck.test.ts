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
  recheckVerdict,
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

describe("the verdict read off one readout answer", () => {
  it("calls a done take recovered, whatever the done state is named", () => {
    for (const state of ["ready", "readout_ready", "review_pending", "insights_ready"]) {
      expect(recheckVerdict(answer(state))).toBe("recovered");
    }
  });

  it("keeps the note when the server agrees the take failed", () => {
    expect(recheckVerdict(answer("failed"))).toBe("still_failed");
    expect(recheckVerdict(answer("failed_ideal_text_unconfirmed"))).toBe("still_failed");
  });

  it("sees a requeued job as running, not failed", () => {
    expect(recheckVerdict(answer("processing"))).toBe("running");
  });

  it("trusts content over an unfamiliar state, and nothing over nothing", () => {
    // The Lounge's own resume watch treats "some content, not processing" as
    // done; the recheck must read the same answer the same way.
    expect(recheckVerdict(answer("something_new", true))).toBe("recovered");
    expect(recheckVerdict(answer("something_new", false))).toBe("unknown");
    expect(recheckVerdict(answer(null))).toBe("unknown");
    expect(recheckVerdict(null)).toBe("unknown");
  });
});

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

  it("asks nothing while there is no failed note", async () => {
    const onVerdict = vi.fn();
    await act(async () => {
      root.render(createElement(Probe, { sessionId: null, onVerdict }));
    });
    expect(fetchGuestLabReadout).not.toHaveBeenCalled();
    expect(onVerdict).not.toHaveBeenCalled();
  });

  it("asks again when the tab comes back into view", async () => {
    fetchGuestLabReadout.mockResolvedValue(answer("failed"));
    const onVerdict = vi.fn();
    await act(async () => {
      root.render(createElement(Probe, { sessionId: "take-3", onVerdict }));
    });
    expect(fetchGuestLabReadout).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchGuestLabReadout).toHaveBeenCalledTimes(2);
    expect(onVerdict).toHaveBeenLastCalledWith("take-3", "still_failed");
  });
});
