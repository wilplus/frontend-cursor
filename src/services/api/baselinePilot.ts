import { bffFetch, type BffRequest } from "@/lib/api/bffFetch";
import type { UiLocale } from "@/lib/uiLocale";
import { readBaselineStatus, readBaselineWrite, type BaselineReport } from "@/lib/willab/baselinePilotContract";

export type { BaselineReport, BaselineRun, BaselineStatus, BaselineStep, BaselineWrite,
  FeltEnergy, FeltValence } from "@/lib/willab/baselinePilotContract";
export { FELT_ENERGY, FELT_VALENCE } from "@/lib/willab/baselinePilotContract";

const LOCAL_ROOT = "/api/dev/baseline-pilot";
const PRIVATE_ROOT = "/api/v2/experiments/baseline-pilot";
export const BASELINE_PILOT_ENTRY = "/speaking-coach/pilot";

export class BaselineAccessError extends Error {
  constructor(readonly kind: "signed-out" | "denied") {
    super(kind);
  }
}

export function localBaselineRequest(path = "", options: BffRequest = {}) {
  return bffFetch(LOCAL_ROOT + path, { ...options, auth: "optional", cache: "no-store", timeoutMs: 65_000 });
}

function stepPath(run: string, step: string) {
  return `/runs/${encodeURIComponent(run)}/steps/${encodeURIComponent(step)}`;
}

function makeBaselineApi(preview: boolean) {
  const root = preview ? LOCAL_ROOT : PRIVATE_ROOT;
  async function request(path = "", options: BffRequest = {}) {
    const result = preview ? await localBaselineRequest(path, options)
      : await bffFetch(root + path, { ...options, cache: "no-store", timeoutMs: 65_000 });
    if (result.kind === "unauthenticated" || (result.kind === "response" && result.status === 401)) {
      throw new BaselineAccessError("signed-out");
    }
    if (result.kind === "response" && [403, 404].includes(result.status)) throw new BaselineAccessError("denied");
    if (result.kind !== "response" || !result.ok) throw Error("Baseline unavailable");
    return result.body;
  }
  return {
    async status(language: UiLocale) {
      return readBaselineStatus(await request("?language=" + language), preview);
    },
    async start(version: string, requestId: string, language: UiLocale) {
      return readBaselineWrite(await request("/runs", { method: "POST", json: {
        mode: "initial", request_id: requestId, language,
        consent: { participant: true, researcher: false, version },
      } }), preview);
    },
    async audio(run: string, step: string, audio: Blob) {
      const body = new FormData();
      const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      body.append("audio", audio, "baseline." + extension);
      return readBaselineWrite(await request(stepPath(run, step) + "/audio", { method: "PUT", body }), preview);
    },
    async report(run: string, step: string, report: BaselineReport) {
      return readBaselineWrite(await request(stepPath(run, step) + "/report", { method: "PUT", json: report }), preview);
    },
    audioPath: (run: string, step: string) => root + stepPath(run, step) + "/audio",
  };
}

export const baselinePilot = makeBaselineApi(true);
export const privateBaselinePilot = makeBaselineApi(false);
