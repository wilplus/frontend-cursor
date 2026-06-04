import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  userProfile — the willab one-time profile client (§2 / ①)                 */
/*                                                                            */
/*   GET  /api/v2/user/profile → { domain, goal, domain_vocabulary_default }   */
/*   POST /api/v2/user/profile   body { domain?, goal? }                       */
/*                                                                            */
/*  Write is POST (not PUT) per the BE contract. `domain` is typed `string`    */
/*  here (transport stays decoupled from the component enum) — the BE          */
/*  validates it against the five keys and 422s otherwise.                    */
/* -------------------------------------------------------------------------- */

export interface UserProfile {
  domain: string | null;
  goal: string;
  domain_vocabulary_default: string[];
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
