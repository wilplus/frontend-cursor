/* -------------------------------------------------------------------------- */
/*  Several files in one Import (founder 2026-10-21): each file becomes its   */
/*  own import under the same set-up, imported ONE AT A TIME, the backend's   */
/*  contract (one file per request; the analysis is CPU-heavy and parallel    */
/*  uploads mostly time out). Batches stay inside the backend's upload        */
/*  limit: at most MAX_BATCH_FILES are picked at once, a per-minute refusal   */
/*  is waited out, and a longer refusal stops the batch.                      */
/* -------------------------------------------------------------------------- */

import { importTrainingAudio, type ImportOutcome, type OptionalStage } from "@/services/api/trainingCorpus";

/** The most files one Import takes: the backend's hourly upload limit per
 *  coach (backend `services/rate_limits.py`, DEFAULT_WHISPER_LIMIT "20 per
 *  minute;200 per hour"). A bigger batch could only end in refusals. */
export const MAX_BATCH_FILES = 200;

/** A rate-limit refusal that ends within this many seconds (the per-minute
 *  limit) is waited out; a longer one (the hourly limit) stops the batch. */
const WAIT_OUT_SEC = 60;
/** Waits on one file before its refusal is final. */
const MAX_WAITS = 5;

const RATE_LIMITED = "RATE_LIMITED";

/** The picked files in name order, so g002 imports before g010. Pure. */
export function inNameOrder(files: readonly File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** The topic a file is filed under: the set-up's own for a single file; with
 *  several, followed by the file's name without its extension, so the imports
 *  can be told apart in the list. Pure. */
export function batchTopic(topic: string, file: Pick<File, "name">, many: boolean): string {
  if (!many) return topic;
  const stem = file.name.replace(/\.[^.]+$/, "") || file.name;
  return `${topic} · ${stem}`;
}

export interface BatchSetUp {
  topic: string;
  speakerLabel: string | null;
  note: string | null;
  language: string;
  optionalStages: OptionalStage[];
}

export interface BatchResult {
  /** Files that imported (a duplicate counts: it is in the corpus already). */
  imported: number;
  /** Moments waiting across every file that imported. */
  moments: number;
  /** Files that did not import, each with the backend's own sentence. */
  failed: { name: string; error: string | null }[];
}

const pause = (sec: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(1, sec) * 1000));

/** One file, waiting out a per-minute refusal: nothing was imported on a 429,
 *  so sending it again is a first attempt, not a duplicate. */
async function importOne(file: File, topic: string, setUp: BatchSetUp, onAccepted: () => void): Promise<ImportOutcome> {
  let outcome: ImportOutcome = await importTrainingAudio({ ...setUp, file, topic, onAccepted });
  for (let waits = 0; waits < MAX_WAITS; waits++) {
    if (outcome.ok || outcome.code !== RATE_LIMITED) return outcome;
    if (outcome.retryAfterSec === null || outcome.retryAfterSec > WAIT_OUT_SEC) return outcome;
    await pause(outcome.retryAfterSec);
    outcome = await importTrainingAudio({ ...setUp, file, topic, onAccepted });
  }
  return outcome;
}

/** Import every file in turn. `onFile` says which one is on its way;
 *  `onAccepted` fires each time the backend takes one. A refusal that outlasts
 *  WAIT_OUT_SEC would refuse every later file too, so it stops the batch and
 *  each file left is reported with the backend's sentence. */
export async function importBatch(files: readonly File[], setUp: BatchSetUp,
  hooks: { onFile: (index: number) => void; onAccepted: () => void }): Promise<BatchResult> {
  const result: BatchResult = { imported: 0, moments: 0, failed: [] };
  const many = files.length > 1;
  for (let i = 0; i < files.length; i++) {
    hooks.onFile(i);
    const outcome = await importOne(files[i], batchTopic(setUp.topic, files[i], many), setUp, hooks.onAccepted);
    if (outcome.ok) {
      result.imported += 1;
      result.moments += outcome.queueCount;
      continue;
    }
    result.failed.push({ name: files[i].name, error: outcome.error });
    if (outcome.code === RATE_LIMITED) {
      result.failed.push(...files.slice(i + 1).map((f) => ({ name: f.name, error: outcome.error })));
      break;
    }
  }
  return result;
}

/** What did not import, in the backend's words: one file's sentence as it is
 *  (a single Import reads as before); with several, the files that share a
 *  sentence named before it. Null when everything imported. Pure. */
export function batchFailLine(result: BatchResult, many: boolean, fallback: string): string | null {
  if (result.failed.length === 0) return null;
  if (!many) return result.failed[0].error ?? fallback;
  const byError = new Map<string, string[]>();
  for (const f of result.failed) {
    const error = f.error ?? fallback;
    byError.set(error, [...(byError.get(error) ?? []), f.name]);
  }
  return [...byError].map(([error, names]) => `${names.join(", ")}: ${error}`).join(" · ");
}
