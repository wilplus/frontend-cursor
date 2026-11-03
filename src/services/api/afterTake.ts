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
