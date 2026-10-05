import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  Deleting one project (founder 2026-09-25, N8; P1; 2026-10-05, N48.4      */
/*  Q17 A).                                                                   */
/*                                                                            */
/*  A tap asks for the deletion; it does not delete. The project is locked   */
/*  until the deletion completes, and the person can cancel while the        */
/*  backend says a cancel can still land. Backend: POST/DELETE                */
/*  /v2/projects/<id>/deletion-request.                                       */
/*                                                                            */
/*  THE ONE PLACE THE PROJECT-DELETION SHAPE IS READ (the picker feed and the */
/*  request's answer both come through mapProjectDeletion). Since Q17 A a     */
/*  deletion completes by itself after a 7-day window: `completes_after` is   */
/*  that moment and `cancellable` the backend's word on the cancel. Before    */
/*  it, `due_at` was the operator's target and a pending request was the     */
/*  cancellable one; both answers read the same here.                         */
/* -------------------------------------------------------------------------- */

export type ProjectDeletionState = "pending" | "confirmed";

export interface ProjectDeletion {
  state: ProjectDeletionState;
  /** When the deletion completes (ISO-8601), or null when not said. */
  dueAt: string | null;
  /** A cancel can still land. */
  cancellable: boolean;
}

/** The open request on a project, or null (none, cancelled or finished). */
export function mapProjectDeletion(raw: unknown): ProjectDeletion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.state !== "pending" && r.state !== "confirmed") return null;
  const when = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : null;
  return {
    state: r.state,
    dueAt: when(r.completes_after) ?? when(r.due_at),
    cancellable:
      typeof r.cancellable === "boolean" ? r.cancellable : r.state === "pending",
  };
}

function idempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `project-delete-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

async function send(
  projectId: string,
  method: "POST" | "DELETE",
): Promise<{ ok: boolean; deletion: ProjectDeletion | null }> {
  const result = await bffFetch(
    `/api/v2/projects/${encodeURIComponent(projectId)}/deletion-request`,
    {
      method,
      credentials: "include",
      json: method === "POST" ? { idempotency_key: idempotencyKey() } : undefined,
    },
  );
  if (result.kind !== "response" || !result.ok) return { ok: false, deletion: null };
  const body = result.body as Record<string, unknown> | null;
  return { ok: true, deletion: mapProjectDeletion(body?.deletion) };
}

/** Ask for the project to be deleted. ok=false changes nothing. */
export function requestProjectDeletion(projectId: string) {
  return send(projectId, "POST");
}

/** Cancel a pending request. ok=false changes nothing. */
export function cancelProjectDeletion(projectId: string) {
  return send(projectId, "DELETE");
}
