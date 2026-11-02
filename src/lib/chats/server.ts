import "server-only";
import { backendFetch } from "@/app/api/_lib/backend";

/** The join page's read, before anyone signs in (backend N308): the first
 *  name of whose link it is, or null when the link is wrong, replaced or
 *  switched off. */
export async function loadJoinLink(token: string): Promise<{ name: string } | null> {
  try {
    const res = await backendFetch(`/v2/chats/join/${encodeURIComponent(token)}`, { token: null, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: unknown };
    return typeof body.name === "string" && body.name ? { name: body.name } : null;
  } catch {
    return null;
  }
}
