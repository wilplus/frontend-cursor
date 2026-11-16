"use client";

import { useCallback, useEffect, useState } from "react";
import { readCoachDraft, saveCoachDraft } from "@/services/api/chatBuilder";
import type { CoachDefinition } from "./types";
import { speakingCoachSeed } from "./seed";

const KEY = "wlp-coach-draft";

function stored(): CoachDefinition | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as CoachDefinition;
    return doc?.id === "speaking-coach" ? doc : null;
  } catch {
    return null;
  }
}

/** The founder's draft. The backend wins when it answers; otherwise the
    draft stays on this device so Live can still be tried. Saving never
    starts a Take. */
export function useCoachDraft() {
  const [doc, setDoc] = useState<CoachDefinition | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      setDoc(stored());
      setReady(true);
      return;
    }
    let live = true;
    void readCoachDraft().then((remote) => {
      if (!live) return;
      const next = remote ?? stored();
      setDoc(next);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const save = useCallback(async (next: CoachDefinition) => {
    setDoc(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* a private window may refuse the draft; the screen still holds it */
    }
    await saveCoachDraft(next);
  }, []);

  const start = useCallback(() => save(speakingCoachSeed()), [save]);
  return { doc, ready, save, start };
}
