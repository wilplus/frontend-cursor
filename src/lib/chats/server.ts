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

/** The widget's read (backend N567): whose chat it is and the questions a
 *  visitor may ask, or null for a wrong, replaced or switched-off link. */
export async function loadWidget(token: string): Promise<{ name: string; asks: string[] } | null> {
  try {
    const res = await backendFetch(`/v2/chats/widget/${encodeURIComponent(token)}`, { token: null, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: unknown; asks?: unknown };
    if (typeof body.name !== "string" || !body.name) return null;
    const asks = Array.isArray(body.asks) ? body.asks.filter((a): a is string => typeof a === "string") : [];
    return { name: body.name, asks };
  } catch {
    return null;
  }
}
