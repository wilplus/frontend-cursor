import "server-only";
import { backendFetch } from "@/app/api/_lib/backend";
import { writesOf, type WidgetWrites } from "@/services/api/chatWidget";
import { joinLinkInfo, type JoinLinkInfo } from "./joinLink";

/** The join page's read, before anyone signs in (backend N308): the first
 *  name of whose link it is, or null when the link is wrong, replaced or
 *  switched off. */
export async function loadJoinLink(token: string): Promise<JoinLinkInfo | null> {
  try {
    const res = await backendFetch(`/v2/chats/join/${encodeURIComponent(token)}`, { token: null, cache: "no-store" });
    if (!res.ok) return null;
    return joinLinkInfo(await res.json());
  } catch {
    return null;
  }
}

/** The widget's read (backend N567, N591, N595): whose chat it is, the
 *  host's welcome (shown before the visitor writes, with no card) and how a
 *  visitor may write, from the host's recipe; or null for a wrong, replaced
 *  or switched-off link. */
export async function loadWidget(token: string): Promise<{ name: string; welcome: string[]; writes: WidgetWrites } | null> {
  try {
    const res = await backendFetch(`/v2/chats/widget/${encodeURIComponent(token)}`, { token: null, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: unknown; welcome?: unknown; writes?: unknown };
    if (typeof body.name !== "string" || !body.name) return null;
    const welcome = Array.isArray(body.welcome) ? body.welcome.filter((w): w is string => typeof w === "string" && w.trim() !== "") : [];
    return { name: body.name, welcome, writes: writesOf(body.writes) };
  } catch {
    return null;
  }
}
