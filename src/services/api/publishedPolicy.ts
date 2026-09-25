import {
  publishedPolicyTextState,
  type PolicyTextState,
  type Which,
} from "@/lib/legal/policyText";

/** The browser's second try at the stored policy, when the server's read
 *  failed. Public: it needs no account and no guest token. */
export async function fetchPublishedPolicyText(which: Which): Promise<PolicyTextState> {
  try {
    const response = await fetch("/api/v2/processing-authorization/policy-text", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return { kind: "fallback" };
    return publishedPolicyTextState(await response.json().catch(() => null), which);
  } catch {
    return { kind: "fallback" };
  }
}
