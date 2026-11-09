import "server-only";
import { backendFetch } from "@/app/api/_lib/backend";
import { writesOf, type WidgetWrites } from "@/services/api/chatWidget";

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

/** The widget's read (backend N567, N591): whose chat it is and how a
 *  visitor may write, from the host's recipe, or null for a wrong, replaced or switched-off link. */
export async function loadWidget(token: string): Promise<{ name: string; writes: WidgetWrites } | null> {
  try {
    const res = await backendFetch(`/v2/chats/widget/${encodeURIComponent(token)}`, { token: null, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: unknown; writes?: unknown };
    if (typeof body.name !== "string" || !body.name) return null;
    return { name: body.name, writes: writesOf(body.writes) };
  } catch {
    return null;
  }
}
