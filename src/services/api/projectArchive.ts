import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  Archive a project (founder 2026-09-26, N14).                              */
/*                                                                            */
/*  Archive hides a project from the project list; nothing is deleted.        */
/*  Unarchive brings it back. Backend: POST/DELETE /v2/projects/<id>/archive. */
/* -------------------------------------------------------------------------- */

async function send(projectId: string, method: "POST" | "DELETE"): Promise<boolean> {
  const res = await bffFetch(`/api/v2/projects/${encodeURIComponent(projectId)}/archive`, {
    method,
    credentials: "include",
  });
  return res.kind === "response" && res.ok;
}

/** Hide the project from the list. false changes nothing. */
export function archiveProject(projectId: string): Promise<boolean> {
  return send(projectId, "POST");
}

/** Bring an archived project back to the list. false changes nothing. */
export function unarchiveProject(projectId: string): Promise<boolean> {
  return send(projectId, "DELETE");
}
