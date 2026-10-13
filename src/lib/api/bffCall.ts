import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  The three result shapes the service clients answer with, each written     */
/*  once (frontend glue cut, 2026-10-12). Every client used to carry its own  */
/*  copy of one of these; the answers are unchanged.                          */
/* -------------------------------------------------------------------------- */

/** A request body as JSON (`Content-Type: application/json`). */
export const jsonInit = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* ── coded: { ok, value } | { ok: false, code, status } ─────────────────── */

export type CodedResult<T> = { ok: true; value: T } | { ok: false; code: string; status: number };

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = (await response.json()) as unknown;
    return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A cookie-session call; `code` is the backend's, or HTTP_<status>, or
 *  UNREACHABLE when nothing answered. */
export async function codedCall<T>(
  path: string,
  init: RequestInit,
  pick: (body: Record<string, unknown>) => T,
): Promise<CodedResult<T>> {
  try {
    const response = await fetch(path, init);
    const body = await readJsonObject(response);
    if (!response.ok) {
      return { ok: false, code: String(body.code ?? `HTTP_${response.status}`), status: response.status };
    }
    return { ok: true, value: pick(body) };
  } catch {
    return { ok: false, code: "UNREACHABLE", status: 0 };
  }
}

/* ── outcome: { ok, data } | { ok: false, status, code } (Bearer token) ──── */

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null };

/** A signed-in call, never cached. No session: 401 NO_SESSION; nothing
 *  answered: status 0. */
export async function outcomeCall<T>(
  path: string,
  init: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown },
  map: (data: Record<string, unknown>) => T,
): Promise<Outcome<T>> {
  try {
    const result = await bffFetch(path, {
      method: init.method,
      cache: "no-store",
      ...(init.body === undefined ? {} : { json: init.body }),
    });
    if (result.kind === "unauthenticated") return { ok: false, status: 401, code: "NO_SESSION" };
    if (result.kind === "network") return { ok: false, status: 0, code: null };
    const data = result.body as Record<string, unknown> | null;
    if (!result.ok) {
      return { ok: false, status: result.status, code: typeof data?.code === "string" ? data.code : null };
    }
    return { ok: true, data: map(data ?? {}) };
  } catch {
    return { ok: false, status: 0, code: null };
  }
}

/* ── message: { ok, data } | { ok: false, status, message, code? } ──────── */

export type MessageResult<T> =
  | { ok: true; data: T }
  /** `code` is the backend's machine-readable reason, when it sent one. */
  | { ok: false; status: number; message: string; code?: string };

/** A call whose failure carries a sentence for an author. `readError` words
 *  the failure; with `unreadable`, a pick of null is a failure in its words. */
export async function messageCall<T>(
  path: string,
  init: RequestInit,
  readError: (data: unknown, status: number) => string,
  pick: (data: unknown) => T,
  unreadable?: string,
): Promise<MessageResult<T>> {
  let res: Response;
  let data: unknown;
  try {
    res = await fetch(path, init);
    data = await res.json().catch(() => ({}));
  } catch {
    return { ok: false, status: 0, message: "Network error. Try again." };
  }
  if (!res.ok) {
    const code = (data as Record<string, unknown> | null)?.code;
    return {
      ok: false,
      status: res.status,
      message: readError(data, res.status),
      ...(typeof code === "string" && code ? { code } : {}),
    };
  }
  const picked = pick(data);
  if (picked === null && unreadable !== undefined) {
    return { ok: false, status: res.status, message: unreadable };
  }
  return { ok: true, data: picked };
}

/** The coach library's failure sentence (coach exercises, speaking errors). */
export function coachReadError(data: unknown, status: number): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (status === 401 || status === 403) return "Coach access required.";
  return `Request failed (HTTP ${status}).`;
}
