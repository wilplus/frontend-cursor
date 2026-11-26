export const FELT_ENERGY = ["low", "low_to_medium", "medium", "medium_to_high", "high", "unsure"] as const;
export const FELT_VALENCE = ["pleasant", "unpleasant", "neutral", "mixed", "unsure"] as const;
export type FeltEnergy = typeof FELT_ENERGY[number];
export type FeltValence = typeof FELT_VALENCE[number];
export type BaselineReport = { felt_energy: FeltEnergy } | { felt_valence: FeltValence };
export type BaselineDisclosure = { version: string; recording: string; purpose: string; use: string };
export type BaselineStep = { id: string; prompt: string; state: "record" | "energy" | "valence" | "report" };
const MODES = ["initial", "on_demand", "refresh"] as const;
type BaselineMode = typeof MODES[number];
export type BaselineRun = {
  id: string; mode: BaselineMode; protocol_version: string;
  created_at: string; completed_at: string | null; next_step: BaselineStep | null;
};
export type BaselineStatus = {
  entry_allowed: boolean; disclosure: BaselineDisclosure | null;
  runs: Record<BaselineMode, BaselineRun | null>;
};
export type BaselineWrite = { entry_allowed: boolean; run: BaselineRun };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function disclosureOf(value: unknown): BaselineDisclosure | null {
  if (value === null) return null;
  const { version, recording, purpose, use } = record(value);
  if (typeof version !== "string" || typeof recording !== "string" || typeof purpose !== "string" || typeof use !== "string") {
    throw Error("Invalid baseline disclosure");
  }
  return { version, recording, purpose, use };
}

function stepOf(value: unknown, legacy: boolean): BaselineStep | null {
  if (value === null) return null;
  const { id, prompt, state } = record(value);
  if (typeof id !== "string" || typeof prompt !== "string" ||
      !(state === "record" || state === "energy" || state === "valence" || (legacy && state === "report"))) {
    throw Error("Invalid baseline step");
  }
  return { id, prompt, state };
}

function runOf(value: unknown, expected: BaselineMode, legacy: boolean): BaselineRun | null {
  if (value === null) return null;
  const { id, mode, protocol_version, created_at, completed_at, next_step } = record(value);
  const step = stepOf(next_step, legacy);
  if (typeof id !== "string" || mode !== expected || typeof protocol_version !== "string" ||
      typeof created_at !== "string" || (step ? completed_at !== null : typeof completed_at !== "string" || !completed_at)) {
    throw Error("Invalid baseline run");
  }
  return { id, mode: expected, protocol_version, created_at, completed_at: completed_at as string | null, next_step: step };
}

function checkedEntry(value: unknown, run: BaselineRun | null): boolean {
  if (typeof value !== "boolean" || value !== Boolean(run?.completed_at)) throw Error("Invalid baseline completion");
  return value;
}

/** Project the participant-facing fields explicitly on both sides of the BFF. */
export function readBaselineStatus(value: unknown, legacy = false): BaselineStatus {
  const { entry_allowed, disclosure, runs } = record(value);
  const stored = record(runs);
  const initial = runOf(stored.initial, "initial", legacy);
  return { entry_allowed: checkedEntry(entry_allowed, initial), disclosure: disclosureOf(disclosure), runs: {
    initial, on_demand: runOf(stored.on_demand, "on_demand", legacy), refresh: runOf(stored.refresh, "refresh", legacy),
  } };
}

export function readBaselineWrite(value: unknown, legacy = false): BaselineWrite {
  const { entry_allowed, run } = record(value);
  const checked = runOf(run, "initial", legacy);
  if (!checked) throw Error("Missing baseline run");
  return { entry_allowed: checkedEntry(entry_allowed, checked), run: checked };
}
