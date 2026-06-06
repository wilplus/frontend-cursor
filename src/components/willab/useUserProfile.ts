"use client";

import { useEffect, useState } from "react";
import {
  fetchUserProfile,
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Anonymous → no profile, no fetch.
    if (signedIn !== true) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchUserProfile().then((p) => {
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
