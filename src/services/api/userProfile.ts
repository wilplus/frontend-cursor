import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  userProfile — the willab one-time profile client (§2 / ① + §F.0)           */
/*                                                                            */
/*   GET  /api/v2/user/profile → { domain, goal, domain_vocabulary_default,    */
/*                                  is_coach }                                  */
/*   POST /api/v2/user/profile   body { domain?, goal? }                       */
/*                                                                            */
/*  Write is POST (not PUT) per the BE contract. `domain` is typed `string`    */
/*  here (transport stays decoupled from the component enum) — the BE          */
/*  validates it against the five keys and 422s otherwise.                    */
/*                                                                            */
/*  `is_coach` (§F.0, BE B.0): RENDER-ONLY flag the FE uses to decide whether  */
/*  to mount the coach review surface. Authorization is server-enforced on     */
/*  every coach route via the `require_admin_or_coach` decorator — the FE flag */
/*  is NEVER the security boundary. Strict-bool default to `false` so a        */
/*  missing/null field never accidentally promotes a normal user.              */
/* -------------------------------------------------------------------------- */

export interface UserProfile {
  domain: string | null;
  goal: string;
  domain_vocabulary_default: string[];
  is_coach: boolean;
}

export interface UserProfileDraft {
  domain?: string;
  goal?: string;
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
