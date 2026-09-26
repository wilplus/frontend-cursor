import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  userProfile — the willab one-time profile client (§2 / ① + §F.0)           */
/*                                                                            */
/*   GET  /api/v2/user/profile → { domain, goal, domain_vocabulary_default,    */
/*                                  is_coach, proficient_languages }            */
/*   POST /api/v2/user/profile   body { domain?, goal?,                        */
/*                                      proficient_languages? }                */
/*                                                                            */
/*  Write is POST (not PUT) per the BE contract. `domain` is typed `string`    */
/*  here (transport stays decoupled from the component enum) — the BE          */
/*  validates it against the five keys and 422s otherwise.                    */
/*                                                                            */
/*  POST is a PARTIAL update: it only touches the keys you send. Sending       */
/*  `{goal}` alone will not clear domain, and vice versa. An OMITTED key       */
/*  is left alone; an EXPLICIT `null` clears the field.                        */
/*                                                                            */
/*  `is_coach` (§F.0, BE B.0): RENDER-ONLY flag the FE uses to decide whether  */
/*  to mount the coach review surface. Authorization is server-enforced on     */
/*  every coach route via the `require_admin_or_coach` decorator — the FE flag */
/*  is NEVER the security boundary. Strict-bool default to `false` so a        */
/*  missing/null field never accidentally promotes a normal user.              */
/* -------------------------------------------------------------------------- */

const ISO_LANGUAGE = /^[a-z]{2}$/;

export interface UserProfile {
  domain: string | null;
  goal: string;
  domain_vocabulary_default: string[];
  is_coach: boolean;
  /** Explicit languages this person can use to judge vocal confidence.
   *  This is queue routing only; it is never a label or a model feature.
   *  null = supported but not configured; undefined = old backend contract. */
  proficient_languages: string[] | null | undefined;
}

export interface UserProfileDraft {
  domain?: string;
  goal?: string;
  /** Omit to leave untouched. At least one ISO-639-1 code is required when
   *  present; the backend independently validates the same contract. */
  proficient_languages?: string[];
}


/** Coaches must configure this once before receiving blind audio. */
export function shouldAskRaterLanguages(profile: UserProfile | null): boolean {
  return profile?.is_coach === true && profile.proficient_languages === null;
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
    proficient_languages: !("proficient_languages" in data)
      ? undefined
      : Array.isArray(data.proficient_languages)
        ? Array.from(new Set(
            data.proficient_languages
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim().toLowerCase())
              .filter((value) => ISO_LANGUAGE.test(value))
          )).sort()
        : null,
  };
}

/**
 * Save the profile (POST per the BE contract). Best-effort: returns `false`
 * rather than throwing, so Intake advances on the local cache even when
 * unsigned (401) or offline. The server copy is (re-)synced at sign-up.
 */
/* ONE PROFILE READ PER PAGE, SHARED (founder 2026-09-26: the coach review
   "is just very long"). The Lounge, the language gate around the review and
   the Feedbacks review each read the profile on mount, so opening a take
   waited through the same GET more than once. One in-flight promise now
   serves them all for a short window; a save or a sign-out drops it, so a
   changed profile or another account is never served from it. */
const SHARED_PROFILE_TTL_MS = 30_000;
let sharedProfile: { at: number; promise: Promise<UserProfile | null> } | null =
  null;

/** The profile, from the shared read when one is fresh. */
export function fetchUserProfileShared(): Promise<UserProfile | null> {
  const now = Date.now();
  if (sharedProfile && now - sharedProfile.at < SHARED_PROFILE_TTL_MS) {
    return sharedProfile.promise;
  }
  const promise = fetchUserProfile();
  sharedProfile = { at: now, promise };
  // A failed read (null) is not worth sharing: the next caller asks again.
  void promise.then((p) => {
    if (p === null && sharedProfile?.promise === promise) sharedProfile = null;
  });
  return promise;
}

/** Forget the shared read (after a save, or when the account changes). */
export function forgetSharedUserProfile(): void {
  sharedProfile = null;
}

export async function saveUserProfile(draft: UserProfileDraft): Promise<boolean> {
  forgetSharedUserProfile();
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
