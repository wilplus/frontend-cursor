import { callBackend } from "@/app/api/_lib/backend";

/** The training sentence in force, for a visitor who is not signed in
 *  (founder 2026-10-15). Public words only, like the policy texts. */
export async function GET() {
  return callBackend("/v2/training-consent/wording", { method: "GET", requireAuth: false });
}
