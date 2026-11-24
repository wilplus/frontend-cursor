import { fetchSessionReadout } from "./sessionReadout";

/** The speaker's raw words for one exact Take. The session endpoint enforces
 * ownership; the caller never supplies an arc as a substitute for the Take
 * identity. */
export async function fetchTakeTranscript(takeSessionId: string, onReadout?: (readout: NonNullable<Awaited<ReturnType<typeof fetchSessionReadout>>>["readout"]) => void): Promise<string> {
  const session = await fetchSessionReadout(takeSessionId);
  if (!session) throw new Error("TRANSCRIPT_UNAVAILABLE");
  onReadout?.(session.readout);

  const slideText = session.readout.slideTranscripts
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((part) => part.transcript.trim())
    .filter(Boolean);
  if (slideText.length > 0) return slideText.join("\n\n");

  const fullText = session.readout.fullTranscriptChunks
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((part) => part.transcript.trim())
    .filter(Boolean);
  if (fullText.length > 0) return fullText.join("\n\n");

  return session.readout.snippets
    .slice()
    .sort((a, b) => a.startOffsetMs - b.startOffsetMs)
    .map((snippet) => snippet.transcript.trim())
    .filter(Boolean)
    .join("\n\n");
}
