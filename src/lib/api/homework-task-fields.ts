/**
 * Shared helpers for resolving the opening homework task string from API payloads.
 * Kept separate from types-homework / homework-utils to avoid circular imports.
 */

function trimStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** `task` as plain string or `{ text: string }` (API may send either). */
export function taskFieldText(field: unknown): string | null {
  const s = trimStr(field);
  if (s) return s;
  if (field && typeof field === "object" && field !== null && "text" in field) {
    const t = (field as { text: unknown }).text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

/**
 * Combine a short label and a longer prompt when the backend sends both (e.g. `task` + `task_text`).
 * If one contains the other, returns the longer; if both differ, returns "short\n\nlong".
 */
export function mergeHomeworkTaskPair(short: string | null, long: string | null): string | null {
  const a = short?.trim() || null;
  const b = long?.trim() || null;
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  if (b.includes(a)) return b;
  if (a.includes(b)) return a;
  return `${a}\n\n${b}`;
}

/** First pool row → full prompt: supports string, { text }, { title + description }, etc. */
export function firstTaskTextFromPool(pool: unknown): string | null {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return taskTextFromPoolItem(pool[0]);
}

export function taskTextFromPoolItem(first: unknown): string | null {
  if (typeof first === "string" && first.trim()) return first.trim();
  if (!first || typeof first !== "object" || first === null) return null;
  const o = first as Record<string, unknown>;
  const title = trimStr(o.title);
  const text = trimStr(o.text ?? o.prompt);
  const description = trimStr(o.description ?? o.instructions ?? o.body ?? o.details);
  return [title, text, description].reduce<string | null>(
    (acc, cur) => (cur ? mergeHomeworkTaskPair(acc, cur) : acc),
    null
  );
}

/** Top-level or nested session record: `task` (string or `{ text }`) + `task_text` + pool. */
export function openingTaskTextFromRecord(rec: Record<string, unknown>): string {
  const taskStr = taskFieldText(rec.task);
  const taskText = trimStr(rec.task_text);
  const mergedFields = mergeHomeworkTaskPair(taskStr, taskText);
  if (mergedFields) return mergedFields;

  const pool = rec.tasks_pool ?? rec.task_pool;
  if (Array.isArray(pool) && pool.length > 0) {
    const fromPool = firstTaskTextFromPool(pool);
    if (fromPool) return fromPool;
  }

  return "";
}
