export interface PracticeResumeSelection {
  durationSeconds: number;
  slideIndex: number;
}

/** Recording length is fixed product behaviour; presentation target length is
 * stored separately in the project setup. */
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
    if (
      typeof value.durationSeconds !== "number" ||
      !Number.isFinite(value.durationSeconds) ||
      value.durationSeconds <= 0 ||
      typeof value.slideIndex !== "number" ||
      !Number.isInteger(value.slideIndex) ||
      value.slideIndex < 0
    ) {
      return null;
    }
    return {
      durationSeconds: value.durationSeconds,
      slideIndex: value.slideIndex,
    };
  } catch {
    return null;
  }
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
