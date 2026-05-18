import type {
  DirectiveRow,
  DirectiveRowInput,
} from "@/services/api/directivesQueue";

/**
 * Pure helpers for the DirectivesQueuePanel. Extracted so the
 * rules around row padding, dirty-state, and save eligibility can
 * be unit-tested without mounting React + mocking the API client.
 * Anything that touches `fetch` or component state belongs in
 * `DirectivesQueuePanel.tsx`; everything here is deterministic.
 *
 * Row model: panel always renders FIVE rows (the spec is a fixed
 * 5-step arc; backend pops in position order). Empty rows are
 * dropped at save time so the admin can ship 1–5 questions.
 */

export const MAX_ARC_ROWS = 5;

export interface PanelRow {
  intent_tag: string;
  question: string;
  exhausted: boolean;
}

/** A blank row — used to pad up to MAX_ARC_ROWS and on `clear`. */
export function emptyRow(): PanelRow {
  return { intent_tag: "", question: "", exhausted: false };
}

/** Five blank rows — used for empty state and on Clear. */
export function emptyRows(): PanelRow[] {
  return Array.from({ length: MAX_ARC_ROWS }, emptyRow);
}

/**
 * Hydrate the panel's form state from a backend `DirectiveRow[]`.
 * The server is the source of truth for `exhausted`; the local form
 * preserves the per-row `intent_tag` + `question` verbatim so the
 * admin sees exactly what was queued. Backend rows arrive in
 * `position` order; we sort defensively and pad to five.
 */
export function rowsFromBackend(backend: DirectiveRow[] | null | undefined): PanelRow[] {
  const sorted = (backend ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_ARC_ROWS)
    .map<PanelRow>((r) => ({
      intent_tag: r.intent_tag ?? "",
      question: r.question ?? "",
      exhausted: !!r.exhausted,
    }));
  while (sorted.length < MAX_ARC_ROWS) sorted.push(emptyRow());
  return sorted;
}

/**
 * Hydrate the local form rows from a `/suggest` response. Suggestions
 * are never exhausted (they haven't been used yet) and arrive without
 * positions — caller assumes index 0 is row 1. Caps at MAX_ARC_ROWS.
 */
export function rowsFromSuggestions(
  suggestions: DirectiveRowInput[]
): PanelRow[] {
  const seeded = suggestions.slice(0, MAX_ARC_ROWS).map<PanelRow>((r) => ({
    intent_tag: r.intent_tag ?? "",
    question: r.question ?? "",
    exhausted: false,
  }));
  while (seeded.length < MAX_ARC_ROWS) seeded.push(emptyRow());
  return seeded;
}

/**
 * Patch one row at `idx` immutably. Out-of-range writes are no-ops
 * (rather than panic) — callers that hit this are buggy but we
 * shouldn't crash the admin UI over it.
 */
export function patchRow(
  rows: PanelRow[],
  idx: number,
  patch: Partial<PanelRow>
): PanelRow[] {
  if (idx < 0 || idx >= rows.length) return rows;
  const next = rows.slice();
  next[idx] = { ...next[idx], ...patch };
  return next;
}

/**
 * Trim and drop rows with empty `question` for the save payload.
 * `intent_tag` is preserved even if blank for the kept rows — the
 * spec allows a tag-less row in case the admin wants to queue
 * questions without classification (rare; backend has a fallback).
 */
export function rowsForSave(rows: PanelRow[]): DirectiveRowInput[] {
  return rows
    .map((r) => ({
      intent_tag: r.intent_tag.trim(),
      question: r.question.trim(),
    }))
    .filter((r) => r.question.length > 0);
}

/**
 * Queue button is enabled iff at least row 1 has BOTH intent_tag
 * and question filled. We require the tag on the first row even
 * when `rowsForSave` would tolerate empty tags, because the first
 * row is the one the next AI turn will use — surfacing a sloppy
 * un-tagged first row to the admin via a disabled button is
 * cheaper than a silent backend default.
 */
export function canSave(rows: PanelRow[]): boolean {
  const head = rows[0];
  if (!head) return false;
  return head.intent_tag.trim().length > 0 && head.question.trim().length > 0;
}

/**
 * "Dirty" means: the current local rows don't match the backend's
 * authoritative snapshot. We compare trimmed values so trailing
 * whitespace doesn't count as a real edit. Used to gate the
 * "unsaved changes" hint + the `Clear`-without-API-call shortcut.
 */
export function isDirty(local: PanelRow[], baseline: PanelRow[]): boolean {
  if (local.length !== baseline.length) return true;
  for (let i = 0; i < local.length; i++) {
    const a = local[i];
    const b = baseline[i];
    if (a.intent_tag.trim() !== b.intent_tag.trim()) return true;
    if (a.question.trim() !== b.question.trim()) return true;
  }
  return false;
}

/**
 * True iff the backend snapshot has at least one non-empty row.
 * Used to decide whether `Clear` needs an API round-trip (yes —
 * there's something to delete) or just a local reset (no — the
 * admin was drafting against an empty baseline anyway).
 */
export function hasBackendArc(baseline: PanelRow[]): boolean {
  return baseline.some((r) => r.question.trim().length > 0);
}
