/**
 * Typed client for the willab-beta Lounge persistence store.
 *
 *   GET    /api/v2/user/lounge/messages   (BFF) → GET    /v2/user/lounge/messages
 *   POST   /api/v2/user/lounge/messages   (BFF) → POST   /v2/user/lounge/messages
 *   DELETE /api/v2/user/lounge/messages   (BFF) → DELETE /v2/user/lounge/messages
 *
 * The Lounge thread is the always-mounted science-chat home's history
 * (§3). The FE owns every bubble it renders — incl. bot turns (§7.6
 * FE-append) — and persists them here. Text-only; never audio, never the
 * coach packet, never profiled.
 */

import { getAuthToken } from "@/lib/api/auth-client";

export type LoungeRole = "user" | "bot" | "system";
export type LoungeKind =
  | "text"
  | "joke"
  | "status"
  | "recording_summary"
  | "insight";

/** Server-shared limits (keep in lockstep with the BE contract). */
export const LOUNGE_BODY_MAX = 16_000;
export const LOUNGE_BATCH_CEILING = 200;
export const LOUNGE_PAGE_SIZE = 50;

/** A message as the FE stamps it — `id` is filled by the server on persist. */
export interface LoungeMessage {
  /** Server id — present only after a round-trip. */
  id?: string;
  /** FE-generated UUID; the idempotency + dedup key (user_id, client_id). */
  client_id: string;
  role: LoungeRole;
  kind: LoungeKind;
  body: string;
  metadata?: Record<string, unknown> | null;
  /** FE-stamped ISO8601 — the ordering key that survives merge-on-signup. */
  client_created_at: string;
}

/** The fields a caller supplies; client_id + client_created_at are stamped. */
export type LoungeMessageDraft = Pick<LoungeMessage, "role" | "kind" | "body"> & {
  metadata?: Record<string, unknown> | null;
};

export interface LoungeHistoryPage {
  /** ASC by client_created_at. */
  messages: LoungeMessage[];
  /** True → older messages exist before this page. */
  has_more: boolean;
  /** Pass as `before` to fetch the next-older page; null when none. */
  oldest_cursor: string | null;
}

/**
 * Stamp a draft into a full message: a fresh `client_id` (UUID) + a
 * monotonic `client_created_at`. Body is hard-clamped to the BE ceiling so
 * a runaway paste can't trip a 422 mid-thread.
 */
export function stampLoungeMessage(draft: LoungeMessageDraft): LoungeMessage {
  return {
    client_id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    client_created_at: new Date().toISOString(),
    role: draft.role,
    kind: draft.kind,
    body: draft.body.slice(0, LOUNGE_BODY_MAX),
    metadata: draft.metadata ?? null,
  };
}

/** Split a list into batches no larger than the BE's 200/POST ceiling. */
export function chunkLoungeMessages(
  messages: LoungeMessage[],
  size: number = LOUNGE_BATCH_CEILING
): LoungeMessage[][] {
  const out: LoungeMessage[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    out.push(messages.slice(i, i + size));
  }
  return out;
}

const ENDPOINT = "/api/v2/user/lounge/messages";

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetch one page of history. `before` (an `oldest_cursor`) pages older.
 * Soft-fails to an empty page on any error — the Lounge mount must never
 * be blocked by a history fetch (mirrors the BE's own soft-fail).
 */
export async function fetchLoungeHistory(opts?: {
  limit?: number;
  before?: string;
}): Promise<LoungeHistoryPage> {
  const empty: LoungeHistoryPage = {
    messages: [],
    has_more: false,
    oldest_cursor: null,
  };
  const headers = await authHeaders();
  if (!headers) return empty;

  const qs = new URLSearchParams();
  qs.set("limit", String(opts?.limit ?? LOUNGE_PAGE_SIZE));
  if (opts?.before) qs.set("before", opts.before);

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${qs.toString()}`, {
      headers,
      cache: "no-store",
    });
  } catch {
    return empty;
  }
  if (!res.ok) return empty;
  const data = (await res.json().catch(() => null)) as LoungeHistoryPage | null;
  if (!data || !Array.isArray(data.messages)) return empty;
  return {
    messages: data.messages,
    has_more: data.has_more === true,
    oldest_cursor: data.oldest_cursor ?? null,
  };
}

/**
 * Batch-append messages (also the merge-on-signup path — same endpoint).
 * Caller is responsible for chunking to ≤200; `appendAllLoungeMessages`
 * does that automatically. Returns the persisted rows (with server ids).
 */
export async function appendLoungeMessages(
  messages: LoungeMessage[]
): Promise<LoungeMessage[]> {
  if (messages.length === 0) return [];
  const headers = await authHeaders();
  if (!headers) throw new Error("Not authenticated");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Lounge append failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { messages: LoungeMessage[] };
  return data.messages ?? [];
}

/** Append any number of messages, auto-chunked to the BE batch ceiling. */
export async function appendAllLoungeMessages(
  messages: LoungeMessage[]
): Promise<LoungeMessage[]> {
  const persisted: LoungeMessage[] = [];
  for (const batch of chunkLoungeMessages(messages)) {
    persisted.push(...(await appendLoungeMessages(batch)));
  }
  return persisted;
}

/** Clear the whole server thread (§3.14 user-deletable). */
export async function clearLoungeThread(): Promise<void> {
  const headers = await authHeaders();
  if (!headers) return;
  await fetch(ENDPOINT, { method: "DELETE", headers }).catch(() => {});
}
