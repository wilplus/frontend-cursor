import { bffFetch } from "@/lib/api/bffFetch";

/** Rename one project. null means the server refused or could not be reached. */
export async function renameProject(
  projectId: string,
  displayName: string,
): Promise<string | null> {
  const result = await bffFetch(
    `/api/v2/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      credentials: "include",
      json: { display_name: displayName },
    },
  );
  if (result.kind !== "response" || !result.ok) return null;
  const body = result.body as Record<string, unknown> | null;
  return typeof body?.display_name === "string" && body.display_name.trim()
    ? body.display_name.trim()
    : null;
}
