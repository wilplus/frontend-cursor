"use client";

import { useEffect, useState } from "react";
import { fetchRecordingRoots } from "@/services/api/idealText";
import { slideHeadlines } from "@/lib/willab/answeredBookmark";

/** Each Slide's helper words as one headline (founder 2026-09-25, Q20 A).
 *
 *  Read from the same locked roots the recording screen shows, so the page
 *  and the next Take can never disagree about which words are the Slide's.
 *  Re-read whenever the document changes and whenever a sheet closes — the
 *  lock that sets them happens inside the sheet. A failed read draws no
 *  headline rather than a stale one. */
export function useSlideHeadlines(
  arcId: string | null,
  document: string,
  sheetOpen: boolean,
): Map<number, string> {
  const [headlines, setHeadlines] = useState<Map<number, string>>(
    () => new Map(),
  );
  useEffect(() => {
    if (!arcId || sheetOpen) return;
    let alive = true;
    void fetchRecordingRoots(arcId).then((result) => {
      if (!alive) return;
      setHeadlines(
        result.kind === "ready" ? slideHeadlines(result.roots) : new Map(),
      );
    });
    return () => {
      alive = false;
    };
  }, [arcId, document, sheetOpen]);
  return headlines;
}

/** The headline above a Slide's paragraphs, on its first screen only. */
export function headlineFor(
  headlines: Map<number, string>,
  slideIndex: number | null,
  screenOfSlide: number | undefined,
): string | null {
  if (slideIndex === null || (screenOfSlide ?? 0) > 0) return null;
  return headlines.get(slideIndex) ?? null;
}
