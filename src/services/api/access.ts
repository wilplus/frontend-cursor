import { bffFetch } from "@/lib/api/bffFetch";

/** By invitation (backend N471): whether the signed-in account may use the
 *  app, or is on the waitlist. Anything but a clear "not a member" lets the
 *  person through: an outage of this check never breaks the loop (CLAUDE.md,
 *  Never 3); the backend refuses a waiting account's work on its own. */
export type Access = "member" | "waiting";

export async function getAccess(): Promise<Access> {
  try {
    const result = await bffFetch("/api/v2/me/access", { method: "GET", cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return "member";
    const body = result.body as { member?: unknown } | null;
    return body && body.member === false ? "waiting" : "member";
  } catch {
    return "member";
  }
}
