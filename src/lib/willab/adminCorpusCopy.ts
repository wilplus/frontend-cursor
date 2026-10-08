/* -------------------------------------------------------------------------- */
/*  /admin/corpus — every word the page puts on screen. SIGNED by the founder */
/*  on 8 October 2026 ("I sign off on it all!", backend decisions log N66.1). */
/*  adminCorpusCopy.test.ts holds the list and fails on any change, and the  */
/*  page carries no literal word of its own. The language names come from   */
/*  the import screen's own list (languageLabel), never retyped.              */
/*                                                                            */
/*  "{status}" is the HTTP status of a failed request, shown to the founder  */
/*  only; no number about a speaker ever reaches this page (AC-9).            */
/* -------------------------------------------------------------------------- */

export const ADMIN_CORPUS_COPY = {
  title: "Training corpus",
  intro:
    "Every import, hidden ones included. Hiding takes an import out of the coaches' list; its moments, labels and audio stay.",
  loadFailed: "Couldn't load the corpus just now. Reload to try again.",
  empty: "Nothing imported yet.",
  untitled: "Untitled",
  noSpeakerLabel: "No speaker label",
  autoDetected: "Auto-detected",
  setupNotFinished: "set-up not finished",
  hidden: "hidden",
  restore: "Restore",
  hide: "Hide",
  requestFailed: "Request failed (HTTP {status}).",
} as const;

export function requestFailedLine(status: number): string {
  return ADMIN_CORPUS_COPY.requestFailed.replace("{status}", String(status));
}
