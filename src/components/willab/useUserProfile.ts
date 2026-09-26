"use client";

import { useEffect, useState } from "react";
import {
  fetchUserProfileShared,
  forgetSharedUserProfile,
  type UserProfile,
} from "@/services/api/userProfile";
import { useSignedIn } from "./useSignedIn";

/* -------------------------------------------------------------------------- */
/*  useUserProfile — cached read of the signed-in user's willab profile        */
/*                                                                            */
/*  One fetch on mount, scoped to the auth state. Re-fetches when the user    */
/*  signs in (or back in after a token refresh). Soft-fails to null on any    */
/*  error — callers gate render on `profile?.<field>`, never on an exception.  */
/*                                                                            */
/*  Returns {profile, loading, isCoach} as a convenience tuple — `isCoach`    */
/*  is the most common consumer (the coach-only surface mount), so it's       */
/*  exposed directly to keep call sites tidy.                                  */
/* -------------------------------------------------------------------------- */

export interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  isCoach: boolean;
}

export function useUserProfile(): UseUserProfileResult {
  const signedIn = useSignedIn();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  /* LOADING UNTIL KNOWN (founder 2026-09-26). This started false, so the
     first render said "no profile, not loading" while auth was still
     resolving. The language gate read that as "not a coach", mounted the
     coach review (which fired its whole session GET), then swapped to its
     spinner a moment later, unmounting the review, and mounted it again for
     a second GET. Unknown now reads as loading. */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (signedIn === null) return; // auth still resolving: stay loading
    // Anonymous → no profile, no fetch.
    if (signedIn !== true) {
      forgetSharedUserProfile();
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchUserProfileShared().then((p) => {
      if (cancelled) return;
      setProfile(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return {
    profile,
    loading,
    isCoach: profile?.is_coach === true,
  };
}
