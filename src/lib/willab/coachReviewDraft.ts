import type { CoachSnippetState } from "@/services/api/coachReview";

/**
 * R4-8 — the coach review's silent crash-safety cache.
 *
 * Note/label edits no longer autosave to the server per keystroke; they live in
 * the overlay's local state until Publish. This localStorage mirror is pure
 * crash insurance (closed tab, browser kill): hydrated on overlay mount, wins
 * over the server coachState for keys it holds, cleared on successful publish.
 * It never talks to the server.
 *
 * Best-effort (Safari private mode fails soft).
 */

export interface CoachReviewDraft {
  v: 1;
  sessionId: string;
  updatedAt: string;
  overallMessage: string;
  snippets: Record<string, CoachSnippetState>;
}

const keyFor = (sessionId: string) => `willab:coach-review:${sessionId}`;

export function readCoachReviewDraft(sessionId: string): CoachReviewDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(sessionId));
    if (!raw) return null;
    const d = JSON.parse(raw) as CoachReviewDraft;
    if (!d || d.v !== 1 || d.sessionId !== sessionId) return null;
    if (!d.snippets || typeof d.snippets !== "object") return null;
    return d;
  } catch {
    return null;
  }
}

export function writeCoachReviewDraft(
  sessionId: string,
  overallMessage: string,
  snippets: Record<string, CoachSnippetState>
): void {
  if (typeof window === "undefined") return;
  try {
    const d: CoachReviewDraft = {
      v: 1,
      sessionId,
      updatedAt: new Date().toISOString(),
      overallMessage,
      snippets,
    };
    window.localStorage.setItem(keyFor(sessionId), JSON.stringify(d));
  } catch {
    /* swallow — quota / private mode */
  }
}

export function clearCoachReviewDraft(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(sessionId));
  } catch {
    /* swallow */
  }
}
