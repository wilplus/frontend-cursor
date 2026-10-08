"use client";

import { useEffect, useRef } from "react";
import { claimPlayback, releasePlayback } from "@/lib/media/exclusivePlayback";
import { useRecoverableSrc } from "@/lib/media/mediaRefresh";

/** A <video> with the browser's own controls that survives an expired link
 *  (founder 2026-10-08, "make sure the playbacks work all across the app").
 *
 *  It is the plain element the screens already drew — same controls, same
 *  classes — with what every player now has: a failed link asks the host's
 *  MediaRefreshProvider once for a fresh one, it plays alone (the others
 *  pause), and a video that still cannot play is not drawn at all rather
 *  than left as a dead box. No text is added. */
export default function NativeVideo({
  src: rawSrc,
  className,
  testId,
  onError,
}: {
  src: string;
  className?: string;
  testId?: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const { src, errored, handleError, handleLoaded } = useRecoverableSrc(rawSrc, onError);
  useEffect(() => {
    const video = ref.current;
    return () => releasePlayback(video);
  }, []);
  if (!src || errored) return null;
  return (
    <video
      ref={ref}
      src={src}
      controls
      playsInline
      preload="metadata"
      className={className}
      data-testid={testId}
      onLoadedMetadata={handleLoaded}
      onError={handleError}
      onPlay={(event) => claimPlayback(event.currentTarget)}
      onPause={(event) => releasePlayback(event.currentTarget)}
    />
  );
}
