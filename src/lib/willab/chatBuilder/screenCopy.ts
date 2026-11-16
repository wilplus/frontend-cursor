/* A screen's words, from the coach document when it names them, otherwise
   the words the screen already uses. */

import { ONE_THING_COPY } from "@/components/willab/idealEditCopy";
import { PROCESSING_STAGES } from "@/components/willab/ProcessingWait";
import type { CoachDefinition } from "./types";

export const RECORD_BEFORE = "Start recording";
export const RECORD_AFTER = "Continue recording";
export const IDEAL_TEXT_NAME = "Your ideal text";

export type TryCopy = { landed: string; onceMore: string; takeItWithYou: string; skipped: string };

const TRIES: TryCopy = {
  landed: ONE_THING_COPY.landed,
  onceMore: ONE_THING_COPY.onceMore,
  takeItWithYou: ONE_THING_COPY.takeItWithYou,
  skipped: ONE_THING_COPY.skipped,
};

/** The sentences a document gives one state, or null when it doesn't name them. */
export function screenLines(def: CoachDefinition | null | undefined, screen: string, state: string): string[] | null {
  const found = def?.screens?.find((s) => s.id === screen)?.states.find((row) => row.id === state);
  return found && found.lines.length ? found.lines : null;
}

export function recordLabel(def: CoachDefinition | null | undefined, afterPractice: boolean): string {
  return screenLines(def, "recording", afterPractice ? "after" : "before")?.[0]
    ?? (afterPractice ? RECORD_AFTER : RECORD_BEFORE);
}

export function idealEmptyName(def: CoachDefinition | null | undefined): string {
  return screenLines(def, "ideal", "empty")?.[0] ?? IDEAL_TEXT_NAME;
}

export function processingLabels(def: CoachDefinition | null | undefined): readonly string[] {
  return screenLines(def, "processing", "wait") ?? PROCESSING_STAGES;
}

export function tryCopy(def: CoachDefinition | null | undefined): TryCopy {
  return {
    landed: screenLines(def, "tries", "landed")?.[0] ?? TRIES.landed,
    onceMore: screenLines(def, "tries", "once")?.[0] ?? TRIES.onceMore,
    takeItWithYou: screenLines(def, "tries", "done")?.[0] ?? TRIES.takeItWithYou,
    skipped: screenLines(def, "tries", "skip")?.[0] ?? TRIES.skipped,
  };
}
