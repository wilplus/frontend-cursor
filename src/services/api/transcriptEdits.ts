import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  transcriptEdits — the user's own edit of a readout transcript             */
/*                                                                            */
/*  A per-user layer over the transcript (a salient snippet's text, or a       */
/*  deckless full_transcript_chunk by index). The coach still reviews the       */
/*  original; this is the user's own copy. Persisted BE-side + folded back onto */
/*  the readout as user_edited_text. Safe ahead of the BE: soft-fails so the    */
/*  optimistic UI stands and a later re-read reconciles.                        */
/* -------------------------------------------------------------------------- */

/** The edit target — exactly one of a snippet or a deckless chunk. */
export type TranscriptEditTarget =
  | { snippetId: string }
  | { chunkIndex: number };

export async function saveTranscriptEdit(
  sessionId: string,
  target: TranscriptEditTarget,
  text: string
): Promise<{ ok: boolean; message?: string }> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const payload =
    "snippetId" in target
      ? { snippet_id: target.snippetId, text }
      : { chunk_index: target.chunkIndex, text };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/user/sessions/${encodeURIComponent(sessionId)}/transcript-edits`,
      {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );
  } catch {
    return { ok: false, message: "Network error. Try again." };
  }
  if (!res.ok) return { ok: false, message: `Couldn't save (${res.status}).` };
  return { ok: true };
}
