// @vitest-environment jsdom
/*
STORY    A speaker supplies two intentional recordings and private felt energy and valence.
OUTCOME
  O1  Disclosure precedes capture, completion waits for durable answers, and interruptions resume.
PROVES   O1 -> "the isolated baseline collection"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaselineAccessError, type BaselineRun, type BaselineStatus, type BaselineWrite, type BaselineReport } from "@/services/api/baselinePilot";
import type { BaselineApi } from "./useBaselinePilot";
import BaselinePilot from "./BaselinePilot";

const capture = vi.hoisted(() => ({ starts: 0, send: null as null | ((audio: Blob) => Promise<boolean>) }));
vi.mock("../../useComposerVoice", () => ({ useComposerVoice: (options: { enabled: boolean; onSend: (audio: Blob) => Promise<boolean> }) => {
  capture.send = options.onSend;
  return { mic: options.enabled ? { start: () => { capture.starts += 1; void options.onSend(new Blob(["recorded audio"], { type: "audio/webm" })); }, label: "Record answer" } : undefined,
    recording: undefined, sending: false, error: null, retry: undefined };
} }));
vi.mock("../../../walk/WalkPlayer", () => ({ default: ({ src }: { src: string }) => <div data-recorded-audio={src} /> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const disclosure = { version: "test-disclosure", recording: "Two short recordings.", purpose: "A personal speaking baseline.", use: "Private test collection." };
const id = "11111111-1111-4111-8111-111111111111";
const quiet = { id: "quiet", prompt: "Tell me about a quiet routine.", state: "record" as const };
const bright = { id: "bright", prompt: "Tell me about something energizing.", state: "record" as const };
const run = (step: BaselineRun["next_step"], complete = false): BaselineRun => ({
  id, mode: "initial", protocol_version: "test-protocol", created_at: "2026-11-25T12:00:00Z",
  completed_at: complete ? "2026-11-25T12:01:00Z" : null, next_step: step,
});
const status = (initial: BaselineRun | null = null): BaselineStatus => ({ entry_allowed: Boolean(initial?.completed_at), disclosure,
  runs: { initial, on_demand: null, refresh: null } });
const write = (initial: BaselineRun): BaselineWrite => ({ entry_allowed: Boolean(initial.completed_at), run: initial });

describe("the isolated baseline collection", () => {
  let host: HTMLDivElement;
  let root: Root;
  let api: BaselineApi;
  beforeEach(() => {
    localStorage.clear(); capture.starts = 0;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-baseline");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    api = { status: vi.fn(async () => status()), start: vi.fn(async () => write(run(quiet))),
      audio: vi.fn(async (_run: string, step: string) => write(run({ ...(step === quiet.id ? quiet : bright), state: "energy" }))),
      report: vi.fn(async (_run: string, step: string, value: BaselineReport) => {
        if ("felt_energy" in value) return write(run({ ...(step === quiet.id ? quiet : bright), state: "valence" }));
        return write(step === quiet.id ? run(bright) : run(null, true));
      }),
      audioPath: (runId, step) => `/api/v2/experiments/baseline-pilot/runs/${runId}/steps/${step}/audio`,
    };
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
  const mount = async () => act(async () => { root.render(<BaselinePilot api={api} preview={false} />); });
  const click = async (selector: string) => act(async () => {
    const button = host.querySelector<HTMLButtonElement>(selector);
    if (!button) throw Error(`Missing ${selector}`);
    button.click();
  });

  it("collects two answers deliberately and stops only after the second report commits", async () => {
    await mount();
    expect(host.textContent).toContain(disclosure.purpose);
    expect(host.querySelector("[data-baseline-composer]")).toBeNull();
    expect(capture.starts).toBe(0);
    await click("button");
    expect(api.start).toHaveBeenCalledWith(disclosure.version, expect.any(String), "en");
    expect(host.textContent).toContain(quiet.prompt);
    expect(capture.starts).toBe(0);
    await click("[data-chat-mic]");
    expect(api.audio).toHaveBeenCalledWith(id, quiet.id, expect.any(Blob));
    expect(host.querySelectorAll("[data-felt-energy]")).toHaveLength(6);
    let saveEnergy!: (value: BaselineWrite) => void;
    vi.mocked(api.report).mockImplementationOnce(() => new Promise(resolve => { saveEnergy = resolve; }));
    await click('[data-felt-energy="unsure"]');
    expect(api.report).toHaveBeenCalledWith(id, quiet.id, { felt_energy: "unsure" });
    expect(host.querySelector("[data-felt-valence]")).toBeNull();
    await act(async () => saveEnergy(write(run({ ...quiet, state: "valence" }))));
    expect(host.querySelectorAll("[data-felt-valence]")).toHaveLength(5);
    await click('[data-felt-valence="mixed"]');
    expect(api.report).toHaveBeenLastCalledWith(id, quiet.id, { felt_valence: "mixed" });
    expect(host.textContent).toContain(bright.prompt);
    await click("[data-chat-mic]");
    await click('[data-felt-energy="high"]');
    let finish!: (value: BaselineWrite) => void;
    vi.mocked(api.report).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await click('[data-felt-valence="pleasant"]');
    expect(host.querySelector("[data-entry-allowed]")?.getAttribute("data-entry-allowed")).toBe("false");
    await act(async () => finish(write(run(null, true))));
    expect(host.querySelector("[data-entry-allowed]")?.getAttribute("data-entry-allowed")).toBe("true");
    expect(host.textContent).toContain("Saved. That’s all for now.");
    expect(host.querySelector("[data-baseline-composer]")).toBeNull();
    expect(host.querySelector("[data-felt-energy]")).toBeNull();
  });

  it("resumes at valence with saved playback and safely retries the same answer", async () => {
    vi.mocked(api.status).mockResolvedValue(status(run({ ...quiet, state: "valence" })));
    await mount();
    expect(capture.starts).toBe(0);
    expect(api.start).not.toHaveBeenCalled();
    expect(host.querySelector("[data-baseline-composer]")).toBeNull();
    expect(host.querySelector("[data-recorded-audio]")?.getAttribute("data-recorded-audio")).toBe(`/api/v2/experiments/baseline-pilot/runs/${id}/steps/quiet/audio`);
    vi.mocked(api.report).mockRejectedValueOnce(Error("network"));
    expect(host.querySelector("[data-felt-energy]")).toBeNull();
    await click('[data-felt-valence="neutral"]');
    expect(host.querySelector("[role=alert]")).not.toBeNull();
    expect(host.querySelector("[data-entry-allowed]")?.getAttribute("data-entry-allowed")).toBe("false");
    await click('[role=alert] button');
    expect(api.report).toHaveBeenNthCalledWith(1, id, quiet.id, { felt_valence: "neutral" });
    expect(api.report).toHaveBeenNthCalledWith(2, id, quiet.id, { felt_valence: "neutral" });
    expect(host.textContent).toContain(bright.prompt);
    expect(host.querySelector("[data-recorded-audio]")?.getAttribute("data-recorded-audio")).toBe(`/api/v2/experiments/baseline-pilot/runs/${id}/steps/quiet/audio`);
  });

  it("recovers a lost upload acknowledgement from the durable server step", async () => {
    vi.mocked(api.status).mockResolvedValueOnce(status(run(quiet))).mockResolvedValue(status(run({ ...quiet, state: "energy" })));
    vi.mocked(api.audio).mockRejectedValueOnce(Error("lost acknowledgement"));
    await mount(); await click("[data-chat-mic]");
    expect(host.querySelector("[data-felt-energy]")).not.toBeNull();
    expect(host.querySelector("[data-recorded-audio]")?.getAttribute("data-recorded-audio")).toContain("/steps/quiet/audio");
    expect(host.querySelector("[role=alert]")).toBeNull();
    expect(api.start).not.toHaveBeenCalled();
  });

  it("recovers a lost energy acknowledgement without asking for energy again", async () => {
    vi.mocked(api.status).mockResolvedValueOnce(status(run({ ...quiet, state: "energy" })))
      .mockResolvedValue(status(run({ ...quiet, state: "valence" })));
    vi.mocked(api.report).mockRejectedValueOnce(Error("lost acknowledgement"));
    await mount();
    await click('[data-felt-energy="medium"]');
    expect(host.querySelector("[data-felt-energy]")).toBeNull();
    expect(host.querySelector("[data-felt-valence]")).not.toBeNull();
    expect(host.querySelector("[role=alert]")).toBeNull();
  });

  it("shows no disclosure or retry when the pilot grant is denied", async () => {
    vi.mocked(api.status).mockRejectedValueOnce(new BaselineAccessError("denied"));
    await mount();
    expect(host.textContent).not.toContain(disclosure.purpose);
    expect(host.querySelector("button")).toBeNull();
    expect(api.start).not.toHaveBeenCalled();
    expect(capture.starts).toBe(0);
  });

  it("opens an already completed baseline without another question or recording", async () => {
    vi.mocked(api.status).mockResolvedValue(status(run(null, true)));
    await mount();
    expect(host.textContent).toContain("Saved. That’s all for now.");
    expect(host.querySelector("button")).toBeNull();
    expect(api.start).not.toHaveBeenCalled();
    expect(capture.starts).toBe(0);
  });
});
