"use client";

import { useEffect, useState } from "react";
import { loadLifeState } from "./useLifeState";
import { isParticipating } from "./types";
import { pickerEntries } from "./hashtags";

/* -------------------------------------------------------------------------- */
/*  useLifeTags — the gate on the chat # layer (FE-5)                          */
/*                                                                            */
/*  THIS IS THE GUARD ON THE ONE LIVE-SURFACE CONTACT POINT. The chat is the   */
/*  panel's capture surface and the only place the trial features touch        */
/*  shipped code, so it gets the tightest gate in the build.                   */
/*                                                                            */
/*  `enabled` is false unless the user has BOTH consented and completed setup. */
/*  For everyone else this returns the same empty result it returned before    */
/*  the panel existed, the picker never mounts, and the composer behaves       */
/*  exactly as it does on main. That is what the isolation test asserts.       */
/*                                                                            */
/*  It reads the cached `/state` promise rather than fetching: the header has  */
/*  already asked, and the chat must not add a request to its own path.        */
/* -------------------------------------------------------------------------- */

export interface LifeTagsState {
  enabled: boolean;
  entries: Array<{ tag: string; label: string }>;
}

const OFF: LifeTagsState = { enabled: false, entries: [] };

/**
 * @param signedIn pass the thread's signed-in flag. When false this makes NO
 *   request at all, so an anonymous visitor's chat is untouched down to the
 *   network tab. The panel is signed-in only, so the read would only ever have
 *   returned 401 for them anyway.
 */
export function useLifeTags(signedIn: boolean): LifeTagsState {
  const [state, setState] = useState<LifeTagsState>(OFF);

  useEffect(() => {
    if (!signedIn) {
      setState(OFF);
      return;
    }
    let cancelled = false;
    void loadLifeState().then((life) => {
      if (cancelled || !isParticipating(life)) return;
      setState({ enabled: true, entries: pickerEntries(life?.tags ?? null) });
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return state;
}
