import { bffFetch } from "@/lib/api/bffFetch";

/** The Take's ask closed (its form: Save, Not now, See prices...): the
 *  backend lets the message after the Take go, under the newest row
 *  (founder 2026-10-20, one action at a time). The caller reloads the
 *  thread. False on any failure. */
export async function postAfterTake(): Promise<boolean> {
  try {
    const result = await bffFetch("/api/v2/user/lounge/after-take", {
      method: "POST",
      cache: "no-store",
      json: {},
    });
    return result.kind === "response" && result.ok;
  } catch {
    return false;
  }
}

/** The speaker opened the app (once a visit): the backend writes the
 *  settings ask that waited for it, if one does (founder 2026-10-31, N294
 *  item 8, N295). True when it wrote one, so the caller reloads the
 *  thread. False on any failure. */
export async function postLoungeVisit(canInstall: boolean): Promise<boolean> {
  try {
    const result = await bffFetch("/api/v2/user/lounge/visit", {
      method: "POST",
      cache: "no-store",
      json: { can_install: canInstall },
    });
    if (result.kind !== "response" || !result.ok) return false;
    const rows = (result.body as { rows?: unknown } | null)?.rows;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}
