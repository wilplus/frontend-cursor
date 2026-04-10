/**
 * Shared helpers for resolving the opening homework task string from API payloads.
 * Kept separate from types-homework / homework-utils to avoid circular imports.
 */

function trimStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
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

/** Top-level or nested session record: task + task_text + pool + warm-up (same order as status/start consumers). */
export function openingTaskTextFromRecord(rec: Record<string, unknown>): string {
  const task = trimStr(rec.task);
  const taskText = trimStr(rec.task_text);
  const mergedFields = mergeHomeworkTaskPair(task, taskText);
  if (mergedFields) return mergedFields;

  const pool = rec.tasks_pool ?? rec.task_pool;
  if (Array.isArray(pool) && pool.length > 0) {
    const fromPool = firstTaskTextFromPool(pool);
    if (fromPool) return fromPool;
  }

  const warmObj = rec.warm_up_task;
  if (warmObj && typeof warmObj === "object" && warmObj !== null && "text" in warmObj) {
    const t = (warmObj as { text: unknown }).text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  const wtext = trimStr(rec.warm_up_task_text);
  if (wtext) return wtext;
  return "";
}
