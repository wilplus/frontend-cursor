"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCorpusClipPlayback,
  type CorpusClipPlayback,
} from "@/services/api/trainingCorpus";
import type { JudgeClip } from "@/components/willab/coachwalk/CoachJudgeInstrument";

/* -------------------------------------------------------------------------- */
/*  The corpus row's clip (backend PR #920).                                   */
/*                                                                            */
/*  A queue row carries nothing playable. For the row on screen this asks the  */
/*  coach-only playback route for a signed URL to the import's parent         */
/*  recording and the window to play from it, and hands both to the one       */
/*  instrument's player (MediaPlayer's clamp plays exactly that window).      */
/*                                                                            */
/*  The URL lives fifteen minutes, so it is asked for again once it is ~13    */
/*  minutes old (on a timer while the row stays on screen, or when the coach  */
/*  comes back to the row), and once more if the audio fails to load. A row   */
/*  revisited inside that time plays the URL it already has.                  */
/*                                                                            */
/*  Nothing here is rendered: no id, URL, offset or number reaches the coach  */
/*  (AC-9, N1).                                                               */
/* -------------------------------------------------------------------------- */

/** Ask again once a URL is this old (the backend signs for 15 minutes). */
export const CLIP_REFRESH_MS = 13 * 60 * 1000;
/** Never re-ask more often than this, whatever lifetime the backend gives. */
const MIN_REFRESH_MS = 30 * 1000;
/** Headroom left before a URL's own expiry. */
const EXPIRY_HEADROOM_MS = 2 * 60 * 1000;

/** How long a fetched URL is used before it is asked for again. */
export function clipRefreshAfterMs(clip: CorpusClipPlayback): number {
  if (clip.expiresInS <= 0) return CLIP_REFRESH_MS;
  const byExpiry = clip.expiresInS * 1000 - EXPIRY_HEADROOM_MS;
  return Math.min(CLIP_REFRESH_MS, Math.max(MIN_REFRESH_MS, byExpiry));
}

interface Entry {
  clip: CorpusClipPlayback | null;
  fetchedAt: number;
  /** The backend's own sentence, for a rater-language refusal only. */
  error: string | null;
  /** This URL is the one fetched after a media error: no second retry. */
  retried: boolean;
}

function isFresh(entry: Entry | undefined, now: number): boolean {
  return Boolean(entry?.clip) && now - entry!.fetchedAt < clipRefreshAfterMs(entry!.clip!);
}

export function useCorpusClip(snippetId: string | null): {
  clip: JudgeClip | null;
  error: string | null;
  onMediaError: () => void;
} {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (id: string, retried: boolean) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const result = await fetchCorpusClipPlayback(id);
    inFlight.current.delete(id);
    if (!mounted.current) return;
    const entry: Entry = result.ok
      ? { clip: result.clip, fetchedAt: Date.now(), error: null, retried }
      : { clip: null, fetchedAt: Date.now(), error: result.error, retried };
    setEntries((prev) => ({ ...prev, [id]: entry }));
  }, []);

  // The row on screen: use what is fresh, ask for anything else.
  useEffect(() => {
    if (!snippetId) return;
    if (!isFresh(entriesRef.current[snippetId], Date.now())) void load(snippetId, false);
  }, [snippetId, load]);

  // While the row stays on screen, ask again before its URL runs out.
  const current = snippetId ? entries[snippetId] : undefined;
  useEffect(() => {
    if (!snippetId || !current?.clip) return;
    const wait = Math.max(0, current.fetchedAt + clipRefreshAfterMs(current.clip) - Date.now());
    const timer = window.setTimeout(() => void load(snippetId, false), wait);
    return () => window.clearTimeout(timer);
  }, [snippetId, current, load]);

  // The audio failed (most likely an expired URL): one fresh URL, once.
  const onMediaError = useCallback(() => {
    if (!snippetId) return;
    const entry = entriesRef.current[snippetId];
    if (!entry?.clip || entry.retried) return;
    void load(snippetId, true);
  }, [snippetId, load]);

  const clip = useMemo<JudgeClip | null>(
    () =>
      current?.clip
        ? { src: current.clip.url, startOffsetMs: current.clip.startOffsetMs, durationMs: current.clip.durationMs }
        : null,
    [current],
  );

  return { clip, error: current?.error ?? null, onMediaError };
}
