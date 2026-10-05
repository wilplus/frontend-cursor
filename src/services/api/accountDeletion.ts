/* -------------------------------------------------------------------------- */
/*  Deleting an account, and cancelling that (founder 2026-10-05: Q3a, then  */
/*  N48.4 Q14 A and Q19 A).                                                   */
/*                                                                            */
/*  THE ONE PLACE THE ACCOUNT-DELETION CONTRACT IS READ. Every shape the      */
/*  backend answers with is mapped here and nowhere else, so a change to the  */
/*  contract (the Wave 3 interface's "AS BUILT") is a change to this file    */
/*  and its tests only:                                                       */
/*    - POST /v2/processing-authorization/terminate  -> 202 {purge_id, state, */
/*      completes_after, cancellable}  (before Q14: {purge_request_id, state})*/
/*    - POST /v2/processing-authorization/deletion/<purge_id>/cancel          */
/*      -> 200 {purge_id, state: "cancelled"} | 409 {code}                    */
/*    - the status read's `pending_deletion` {purge_id, kind, project_id?,    */
/*      completes_after, cancellable} or null                                 */
/*  Nothing here decides anything: the backend says whether a cancel can      */
/*  still land, and a missing word is read as "no".                          */
/* -------------------------------------------------------------------------- */

export type DeletionKind = "account" | "project";

export interface PendingDeletion {
  /** The id a cancel names. */
  purgeId: string;
  kind: DeletionKind;
  projectId: string | null;
  /** When it completes by itself (ISO-8601), or null when not said. */
  completesAfter: string | null;
  /** The backend's word that a cancel can still land. Missing reads as no. */
  cancellable: boolean;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** A request in one of these states is no longer open: nothing to show and
 *  nothing to cancel. (`done` is data_purge_requests' finished state.) */
const CLOSED_STATES = new Set(["cancelled", "done", "completed"]);

/** An open deletion as the backend states it, or null. `kind` defaults to
 *  `defaultKind` for an answer that names none (the terminate receipt). */
export function mapPendingDeletion(
  raw: unknown,
  defaultKind: DeletionKind | null = null,
): PendingDeletion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  // The contract's name first; the pre-Q14 receipt's name second.
  const purgeId = text(r.purge_id) ?? text(r.purge_request_id);
  const kind = r.kind === "account" || r.kind === "project" ? r.kind : defaultKind;
  if (!purgeId || !kind) return null;
  if (typeof r.state === "string" && CLOSED_STATES.has(r.state)) return null;
  return {
    purgeId,
    kind,
    projectId: text(r.project_id),
    completesAfter: text(r.completes_after),
    cancellable: r.cancellable === true,
  };
}

export interface AccountDeletionRequest {
  /** The backend recorded the request. */
  ok: boolean;
  /** What it answered about the request, when it said enough to show. */
  pending: PendingDeletion | null;
}

/* "Delete my account" (founder 2026-10-05, Q3a): POST
 * /api/v2/processing-authorization/terminate with the account_deletion kind.
 * The idempotency key makes a double tap one request. ok when the backend
 * recorded it (202). */
export async function requestAccountDeletion(): Promise<AccountDeletionRequest> {
  try {
    const res = await fetch("/api/v2/processing-authorization/terminate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_kind: "account_deletion",
        idempotency_key: `account-deletion:${crypto.randomUUID()}`,
      }),
    });
    if (!(res.status === 202 || res.ok)) return { ok: false, pending: null };
    const body: unknown = await res.json().catch(() => null);
    return { ok: true, pending: mapPendingDeletion(body, "account") };
  } catch {
    return { ok: false, pending: null };
  }
}

export type CancelDeletionResult =
  | { kind: "cancelled" }
  /** The backend said no (409): the window passed, the deletion started,
   *  or it is not this person's to cancel. Retrying will not change it. */
  | { kind: "refused"; code: string }
  /** No answer, or one that was not a decision. Worth trying again. */
  | { kind: "failed" };

/** Cancel an account deletion inside its window (Q14 A). */
export async function cancelAccountDeletion(purgeId: string): Promise<CancelDeletionResult> {
  try {
    const res = await fetch(
      `/api/v2/processing-authorization/deletion/${encodeURIComponent(purgeId)}/cancel`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    if (res.ok) return { kind: "cancelled" };
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      return { kind: "refused", code: text(body?.code) ?? "DELETION_NOT_CANCELLABLE" };
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}
