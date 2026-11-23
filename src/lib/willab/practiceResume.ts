/** One recording choice. Fragment bounds are inclusive, 1-based deck pages. */
export type PracticeResumeSelection =
  | { scope: "whole" }
  | { scope: "fragment"; startSlide: number; endSlide: number };

/** Missing history means the full text; never invent a fragment from a checkpoint. */
export function practiceSelection(
  scope: "fragment" | "whole",
  span: { startSlide: number; endSlide: number } | null | undefined,
): PracticeResumeSelection {
  if (scope === "whole" || !span) return { scope: "whole" };
  return { scope, startSlide: span.startSlide, endSlide: span.endSlide };
}

/** Keep original deck indices for PDF pages, helper words and audio timestamps. */
export function practiceSlideRange(selection: PracticeResumeSelection | null, count: number) {
  const last = Math.max(0, count - 1);
  if (selection?.scope !== "fragment") return { first: 0, last };
  const first = Math.min(last, selection.startSlide - 1);
  return { first, last: Math.max(first, Math.min(last, selection.endSlide - 1)) };
}

/** Fragment chunks have a fixed cap. Explicit whole rehearsal is uncapped;
 * the presentation's target length is stored separately in project setup. */
export const PRACTICE_CHUNK_SECONDS = 5 * 60;

const KEY_PREFIX = "willab_practice_resume:v1";
const CHECKPOINT_PREFIX = "willab_practice_checkpoint:v1";

function key(prefix: string, ownerId: string | null, arcId: string): string {
  return `${prefix}:${ownerId ?? "guest"}:${arcId}`;
}

export function writePracticeResume(
  ownerId: string | null,
  arcId: string,
  selection: PracticeResumeSelection,
): void {
  try {
    localStorage.setItem(
      key(KEY_PREFIX, ownerId, arcId),
      JSON.stringify(selection),
    );
  } catch {}
}

/** Keep the slide that was actually on screen when the Take stopped. The
 *  one-shot resume selection is only where a Take begins; it must not move
 *  the durable checkpoint until the speaker has practised that far. */
export function writePracticeCheckpoint(
  ownerId: string | null,
  arcId: string,
  slideIndex: number,
): void {
  if (!Number.isInteger(slideIndex) || slideIndex < 0) return;
  try {
    localStorage.setItem(
      key(CHECKPOINT_PREFIX, ownerId, arcId),
      String(slideIndex),
    );
  } catch {}
}

export function readPracticeResume(
  ownerId: string | null,
  arcId: string | null | undefined,
): PracticeResumeSelection | null {
  if (!arcId) return null;
  try {
    const raw = localStorage.getItem(key(KEY_PREFIX, ownerId, arcId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.scope === "whole") return { scope: "whole" };
    return readFragment(value);
  } catch {
    return null;
  }
}

function positiveSlide(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function readFragment(value: Record<string, unknown>): PracticeResumeSelection | null {
  // Older resumes stored a zero-based start and sometimes no end. Preserve
  // their start as a single-slide fragment; discard invalid persisted input.
  const legacyStart = typeof value.slideIndex === "number" ? value.slideIndex + 1 : NaN;
  const start = value.startSlide ?? legacyStart;
  const end = value.endSlide ?? start;
  if (!positiveSlide(start) || !positiveSlide(end) || end < start) return null;
  return { scope: "fragment", startSlide: start, endSlide: end };
}

export function clearPracticeResume(
  ownerId: string | null,
  arcId: string | null | undefined,
): void {
  if (!arcId) return;
  try {
    localStorage.removeItem(key(KEY_PREFIX, ownerId, arcId));
  } catch {}
}

export function readPracticeCheckpoint(
  ownerId: string | null,
  arcId: string,
): number {
  try {
    const raw = localStorage.getItem(key(CHECKPOINT_PREFIX, ownerId, arcId));
    if (raw === null) return -1;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
  } catch {
    return -1;
  }
}
