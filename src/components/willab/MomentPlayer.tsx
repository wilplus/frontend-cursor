"use client";

import MediaPlayer from "@/components/results/MediaPlayer";
import type { DocumentSuggestion } from "@/services/api/idealText";

/** "Play this moment" — the speaker's own clip, on every screen that talks
 *  about what they said (founder 2026-09-26, locked screen L4): Feedback,
 *  Good job, Suggestion and Exercise, before and after answering.
 *
 *  The clip is the item's own when it carries one, else the moment's
 *  Confident Voice clip — the praise and the rewrite are anchored to that
 *  item (24f), so it is the same stretch of speech. Nothing when neither
 *  has audio: a player that cannot play is worse than none. */
export default function MomentPlayer({
  item,
  fallback = null,
  compact = false,
}: {
  item: DocumentSuggestion | null;
  fallback?: DocumentSuggestion | null;
  compact?: boolean;
}) {
  const source = item?.snippetAudioRef ? item : fallback?.snippetAudioRef ? fallback : null;
  if (!source?.snippetAudioRef) return null;
  return (
    <MediaPlayer
      src={source.snippetAudioRef}
      startOffsetMs={source.startOffsetMs ?? 0}
      durationMs={source.durationMs ?? 0}
      compact={compact}
    />
  );
}
