import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  userProfile — the willab one-time profile client (§2 / ① + §F.0)           */
/*                                                                            */
/*   GET  /api/v2/user/profile → { domain, goal, domain_vocabulary_default,    */
/*                                  is_coach, sex }                             */
/*   POST /api/v2/user/profile   body { domain?, goal?, sex? }                 */
/*                                                                            */
/*  Write is POST (not PUT) per the BE contract. `domain` is typed `string`    */
/*  here (transport stays decoupled from the component enum) — the BE          */
/*  validates it against the five keys and 422s otherwise.                    */
/*                                                                            */
/*  POST is a PARTIAL update: it only touches the keys you send. Sending       */
/*  `{sex}` alone will not clear domain/goal, and vice versa. An OMITTED key   */
/*  is left alone; an EXPLICIT `null` clears the field.                        */
/*                                                                            */
/*  `is_coach` (§F.0, BE B.0): RENDER-ONLY flag the FE uses to decide whether  */
/*  to mount the coach review surface. Authorization is server-enforced on     */
/*  every coach route via the `require_admin_or_coach` decorator — the FE flag */
/*  is NEVER the security boundary. Strict-bool default to `false` so a        */
/*  missing/null field never accidentally promotes a normal user.              */
/*                                                                            */
/*  `sex` (BE PR #288): an ACOUSTIC ROUTING key, NOT a demographic and NOT a   */
/*  personalisation input. It selects the cue weights of the backend's         */
/*  voice-confidence composite — the DELIVERY term of the L2 ranking blend —   */
/*  because one of the seven cues (pitch variability) REVERSES DIRECTION by    */
/*  speaker sex: a wide range reads as confident in women and unconfident in   */
/*  men. Per-speaker normalisation does not absorb that; it removes a scale    */
/*  offset, and this is a sign flip.                                           */
/*                                                                            */
/*  NEVER SURFACE IT. It is not an insight, a badge, or a readout line, and it */
/*  never enters a number shown to a user (AC-9). It also must NEVER be        */
/*  inferred and posted on the user's behalf — the BE keeps its own acoustic   */
/*  fallback in memory for a single take, whereas anything the FE posts        */
/*  becomes a STORED claim about the user and would overwrite a real answer.   */
/* -------------------------------------------------------------------------- */

/** The three values the BE CHECK constraint admits. `null` is the fourth,
 *  distinct state (never asked) and is deliberately NOT part of this union. */
export type ProfileSex = "female" | "male" | "prefer_not_to_say";

const SEX_VALUES: readonly string[] = ["female", "male", "prefer_not_to_say"];

export interface UserProfile {
  domain: string | null;
  goal: string;
  domain_vocabulary_default: string[];
  is_coach: boolean;
  /** FIVE states here, and they are NOT interchangeable — see `shouldAskSex`.
   *
   *    "female" | "male"   answered, routes the sex-specific cue weights
   *    "prefer_not_to_say" asked and declined; a hard opt-out
   *    null                the key came back, empty = never asked
   *    undefined           the key did NOT come back = this backend predates
   *                        PR #288 and has no such column. NOT the same as
   *                        "never asked": asking now would post into a field
   *                        that cannot store it, so we stay quiet instead. */
  sex: ProfileSex | null | undefined;
}

export interface UserProfileDraft {
  domain?: string;
  goal?: string;
  /** Omit to leave untouched. Pass an explicit `null` to clear it back to
   *  never-asked. Anything outside the union is a 422 at the BE. */
  sex?: ProfileSex | null;
}

/**
 * The one guard every "should we ask?" call site must use.
 *
 * `prefer_not_to_say` means the user WAS asked and declined — it is a hard
 * opt-out, not a blank. Treating it as unanswered would re-ask someone who
 * already said no, so the check is `=== null`, never a falsy test (which
 * would catch the empty string) and never `!profile.sex`.
 *
 * The strict `=== null` also does the backend-capability check for free:
 * `undefined` (key absent, backend predates PR #288) returns `false`, so the
 * question stays hidden until the column exists rather than collecting an
 * answer nothing can store. This is the same payload-shape gating the rest of
 * the client uses for backend-flagged fields.
 *
 * Returns `false` while the profile is still `null` (unread / signed out) so
 * a loading state never flashes the question.
 */
export function shouldAskSex(profile: UserProfile | null): boolean {
  return profile !== null && profile.sex === null;
}

const ENDPOINT = "/api/v2/user/profile";

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetch the profile. Soft-fails to `null` (unsigned → 401 → caller uses the
 * local cache), so a profile read never blocks a surface mount.
 */
export async function fetchUserProfile(): Promise<UserProfile | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, { headers, cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as Partial<UserProfile> | null;
  if (!data) return null;
  return {
    domain: typeof data.domain === "string" ? data.domain : null,
    goal: typeof data.goal === "string" ? data.goal : "",
    domain_vocabulary_default: Array.isArray(data.domain_vocabulary_default)
      ? data.domain_vocabulary_default
      : [],
    // Strict-bool: only the literal `true` promotes; anything else (null,
    // undefined, "", 0, missing field) → false. Prevents a typo or a BE
    // response shape drift from silently surfacing the coach UI.
    is_coach: data.is_coach === true,
    // Key ABSENT → undefined (backend has no such column yet; stay quiet).
    // Key present → allow-list, so an unrecognised value degrades to "never
    // asked" rather than being handed back to the BE later as a real answer.
    // The DB CHECK makes that unreachable in practice; if it ever happens we
    // re-ask (recoverable) instead of silently suppressing the question (not).
    sex: !("sex" in data)
      ? undefined
      : SEX_VALUES.includes(data.sex as string)
        ? (data.sex as ProfileSex)
        : null,
  };
}

/**
 * Save the profile (POST per the BE contract). Best-effort: returns `false`
 * rather than throwing, so Intake advances on the local cache even when
 * unsigned (401) or offline. The server copy is (re-)synced at sign-up.
 */
export async function saveUserProfile(draft: UserProfileDraft): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    return res.ok;
  } catch {
    return false;
  }
}
