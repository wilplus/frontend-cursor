import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  Deleting one project (founder 2026-09-25, N8; P1).                        */
/*                                                                            */
/*  A tap asks for the deletion; it does not delete. An operator confirms     */
/*  within 7 days and the project is locked until then. The person can       */
/*  cancel while it is pending. Backend: POST/DELETE                          */
/*  /v2/projects/<id>/deletion-request.                                       */
/* -------------------------------------------------------------------------- */

export type ProjectDeletionState = "pending" | "confirmed";

export interface ProjectDeletion {
  state: ProjectDeletionState;
  dueAt: string | null;
}

/** The open request on a project, or null (none, cancelled or finished). */
export function mapProjectDeletion(raw: unknown): ProjectDeletion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.state !== "pending" && r.state !== "confirmed") return null;
  return {
    state: r.state,
    dueAt: typeof r.due_at === "string" ? r.due_at : null,
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
  const token = await getAuthToken();
  if (!token) return { ok: false, deletion: null };
  try {
    const res = await fetch(
      `/api/v2/projects/${encodeURIComponent(projectId)}/deletion-request`,
      {
        method,
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: method === "POST"
          ? JSON.stringify({ idempotency_key: idempotencyKey() })
          : undefined,
      },
    );
    if (!res.ok) return { ok: false, deletion: null };
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: true, deletion: mapProjectDeletion(body?.deletion) };
  } catch {
    return { ok: false, deletion: null };
  }
}

/** Ask for the project to be deleted. ok=false changes nothing. */
export function requestProjectDeletion(projectId: string) {
  return send(projectId, "POST");
}

/** Cancel a pending request. ok=false changes nothing. */
export function cancelProjectDeletion(projectId: string) {
  return send(projectId, "DELETE");
}
