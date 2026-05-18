/**
 * Admin coaching directives queue — client.
 *
 * Replaces two legacy admin surfaces in one move:
 *   1. The single-question override (`queued_override_question` on the
 *      user_context blob, behind `OverrideCard`) — strategic shaping of
 *      ONE next AI question.
 *   2. The 5-row "next-questions arc" on the snippet-review form
 *      (e3250dc) — which conceptually drove the next 5 conversation
 *      turns but was wired against the wrong resource (snippets).
 *
 * The replacement is a per-user queue: one ordered arc of up to 5
 * `{position, intent_tag, question}` rows, persisted at the user
 * level. The backend pops the lowest-position unexhausted row before
 * every chat / interview turn and uses its `question` verbatim; once
 * all 5 are exhausted (or none queued) the LLM-generated fallback
 * kicks in.
 *
 * Backend BE-3 (`feat(directives-queue/BE):`) is the producer of
 * these endpoints. At the time this file ships, BE has NOT been
 * deployed — the four methods below will 4xx until it does. UI
 * shows an error state in that case; no other admin path breaks.
 */

export interface DirectiveRow {
  position: number;
  intent_tag: string;
  question: string;
  exhausted: boolean;
}

/**
 * Subset of `DirectiveRow` we submit on save/suggest. Position is
 * derived from array index on the save call; exhausted is server-
 * owned and never sent.
 */
export interface DirectiveRowInput {
  intent_tag: string;
  question: string;
}

export interface DirectivesQueueResponse {
  rows: DirectiveRow[];
}

export interface SuggestResponse {
  rows: DirectiveRowInput[];
}

function endpoint(userId: string, suffix = ""): string {
  return `/api/v2/admin/users/${encodeURIComponent(userId)}/directives-queue${suffix}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    const err =
      (data as { error?: string; code?: string }).error ??
      `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}

/**
 * Read the current arc. Empty array when no arc is queued — caller
 * should render five empty placeholder rows in that case so the admin
 * has something to fill in.
 */
export async function getDirectivesQueue(
  userId: string
): Promise<DirectivesQueueResponse> {
  const res = await fetch(endpoint(userId), {
    method: "GET",
    credentials: "include",
  });
  return readJson<DirectivesQueueResponse>(res);
}

/**
 * Replace the current arc. Empty `rows` is rejected client-side to
 * avoid an accidental wipe — use `clearDirectivesQueue` for that.
 * Position is index + 1; backend re-numbers defensively so a row
 * dropped from the middle still saves as a tight 1..N sequence.
 */
export async function saveDirectivesQueue(
  userId: string,
  rows: DirectiveRowInput[]
): Promise<DirectivesQueueResponse> {
  if (rows.length === 0) {
    throw new Error("Cannot save an empty arc. Use clear() instead.");
  }
  const res = await fetch(endpoint(userId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      rows: rows.map((r, i) => ({
        position: i + 1,
        intent_tag: r.intent_tag,
        question: r.question,
      })),
    }),
  });
  return readJson<DirectivesQueueResponse>(res);
}

/** Drop the entire current arc — subsequent turns fall back to LLM. */
export async function clearDirectivesQueue(userId: string): Promise<void> {
  const res = await fetch(endpoint(userId), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? `HTTP ${res.status}`
    );
  }
}

/**
 * Ask the backend to generate five contextual question suggestions
 * from the user's recent transcript + long-term profile. The result
 * is NOT persisted — caller is expected to pre-fill the form rows so
 * the admin can edit before clicking Save. `snippetIdContext` is
 * optional soft context (when the admin is suggesting from inside a
 * snippet-adjacent view); backend treats it as a hint, not a filter.
 */
export async function suggestDirectivesQueue(
  userId: string,
  snippetIdContext?: string
): Promise<SuggestResponse> {
  const res = await fetch(endpoint(userId, "/suggest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(
      snippetIdContext ? { snippet_id_context: snippetIdContext } : {}
    ),
  });
  return readJson<SuggestResponse>(res);
}
