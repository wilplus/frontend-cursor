import "server-only";
import { getBackendUrl } from "@/app/api/_lib/backend";
import {
  publishedPolicyTextState,
  type PolicyTextState,
  type Which,
} from "@/lib/legal/policyText";

/* -------------------------------------------------------------------------- */
/*  The stored policy, read on the SERVER (founder 2026-09-25, decisions 2/3). */
/*                                                                            */
/*  /privacy and /terms read the stored copy in the browser, through a status */
/*  call that needs an owner: a visitor who was neither signed in nor holding  */
/*  a guest token got a 401, so /privacy showed "couldn't be loaded" and       */
/*  /terms the retired v1.2 text. And with no JavaScript, or for a crawler,    */
/*  nobody saw the policy at all. The backend now answers the published copy  */
/*  to anyone; the page reads it here, so it is in the HTML that is sent.     */
/*                                                                            */
/*  Revalidated every five minutes: a new policy version reaches the page     */
/*  within that window. A failed read is not an error page — the browser      */
/*  fallback (PublishedPolicyText) tries again and says so if it cannot.      */
/* -------------------------------------------------------------------------- */

export const POLICY_REVALIDATE_SECONDS = 300;

export async function loadPublishedPolicyText(which: Which): Promise<PolicyTextState> {
  try {
    const response = await fetch(
      `${getBackendUrl()}/v2/processing-authorization/policy-text`,
      {
        next: { revalidate: POLICY_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return { kind: "fallback" };
    return publishedPolicyTextState(await response.json(), which);
  } catch {
    return { kind: "fallback" };
  }
}
