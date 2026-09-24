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

  it("does not agree while the backend is still working", async () => {
    fetchGuestLabReadout.mockResolvedValue(answer("processing"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("running");
  });

  it("does not agree once the backend has finished", async () => {
    fetchGuestLabReadout.mockResolvedValue(answer("readout_ready"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("recovered");
  });

  it("agrees when the server says the same thing", async () => {
    fetchGuestLabReadout.mockResolvedValue(
      answer("failed_ideal_text_unconfirmed"),
    );
    await expect(probeTakeVerdict("s1")).resolves.toBe("still_failed");
  });

  it("is unknown, never a verdict, when the server cannot be reached", async () => {
    fetchGuestLabReadout.mockRejectedValue(new Error("offline"));
    await expect(probeTakeVerdict("s1")).resolves.toBe("unknown");
  });

  it("asks about the take it was given", async () => {
    fetchGuestLabReadout.mockResolvedValue(answer("processing"));
    await probeTakeVerdict("session-42");
    expect(fetchGuestLabReadout).toHaveBeenCalledWith("session-42");
  });
});
