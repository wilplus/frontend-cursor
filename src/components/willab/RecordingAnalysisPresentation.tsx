"use client";

import LoadingState from "./LoadingState";

/* -------------------------------------------------------------------------- */
/*  RecordingAnalysisPresentation — compatibility entry point for the         */
/*  post-recording wait. The visible state is the shared app loader.           */
/*                                                                            */
/*  The processing pipeline may still provide stage and percent to callers,   */
/*  but those details never create a second moving loader composition.         */
/* -------------------------------------------------------------------------- */

/** The retained line for callers that still expose the signed expectation. */
export const WAIT_EXPECTATION = "Usually about a minute.";

export interface RecordingAnalysisPresentationProps {
  readonly label: string;
  readonly percent: number | null;
}

export default function RecordingAnalysisPresentation({
  label,
}: RecordingAnalysisPresentationProps) {
  return <LoadingState placement="surface" kind="processing" label={label} />;
}
