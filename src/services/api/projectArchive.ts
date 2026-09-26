import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  Archive a project (founder 2026-09-26, N14).                              */
/*                                                                            */
/*  Archive hides a project from the project list; nothing is deleted.        */
/*  Unarchive brings it back. Backend: POST/DELETE /v2/projects/<id>/archive. */
/* -------------------------------------------------------------------------- */

async function send(projectId: string, method: "POST" | "DELETE"): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(
      `/api/v2/projects/${encodeURIComponent(projectId)}/archive`,
      {
        method,
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Hide the project from the list. false changes nothing. */
export function archiveProject(projectId: string): Promise<boolean> {
  return send(projectId, "POST");
}

/** Bring an archived project back to the list. false changes nothing. */
export function unarchiveProject(projectId: string): Promise<boolean> {
  return send(projectId, "DELETE");
}
