"use client";

import { useEffect, useState } from "react";
import { fetchRecordingRoots } from "@/services/api/idealText";
import { paragraphHeadlines } from "@/lib/willab/answeredBookmark";

/** Each paragraph's helper words as its headline (founder 2026-09-26: above
 *  the paragraph they came from, superseding one headline per Slide).
 *
 *  Read from the same locked roots the recording screen shows, so the page
 *  and the next Take can never disagree about which words are whose.
 *  Re-read whenever the document changes and whenever a sheet closes — the
 *  lock that sets them happens inside the sheet. A failed read draws no
 *  headline rather than a stale one. */
export function useParagraphHeadlines(
  arcId: string | null,
  document: string,
  sheetOpen: boolean,
): Map<string, string> {
  const [headlines, setHeadlines] = useState<Map<string, string>>(
    () => new Map(),
  );
  useEffect(() => {
    if (!arcId || sheetOpen) return;
    let alive = true;
    void fetchRecordingRoots(arcId).then((result) => {
      if (!alive) return;
      setHeadlines(
        result.kind === "ready" ? paragraphHeadlines(result.roots) : new Map(),
      );
    });
    return () => {
      alive = false;
    };
  }, [arcId, document, sheetOpen]);
  return headlines;
}

/** The headline above a paragraph — on its first slice only, when a long
 *  paragraph runs across screens. */
export function headlineFor(
  headlines: Map<string, string>,
  partId: string,
  sliceIndex: number | undefined,
): string | null {
  if ((sliceIndex ?? 0) > 0) return null;
  return headlines.get(partId) ?? null;
}
