import { getAuthToken } from "@/lib/api/auth-client";
import { mapReadoutPayload, type ReadoutPayload } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  labRecording — the Lab upload client (seam ③, §3.3)                        */
/*                                                                            */
/*  POST /api/v2/lab/recordings — multipart, SYNCHRONOUS (~3–5s): 201 + the    */
/*  finished Readout, or 422 (min-content gate → re-record). Public/guest:     */
/*  the token is forwarded when signed (for scoping) but never required.       */
/* -------------------------------------------------------------------------- */

export interface LabUploadInput {
  audioBlob: Blob;
  durationSec: number;
  topic: string;
  audience?: string;
  targetLengthSeconds?: number | null;
  domainVocabulary?: string[];
}

export type LabUploadResult =
  | { kind: "ok"; sessionId: string | null; state: string | null; readout: ReadoutPayload }
  | { kind: "rejected"; message: string } // 422 — min-content gate
  | { kind: "error"; status: number; message: string };

export async function submitLabRecording(
  input: LabUploadInput
): Promise<LabUploadResult> {
  const form = new FormData();
  // BE Q4 (field names): audio part + domain_vocabulary encoding are the FE's
  // best read of the multipart contract — isolated here, trivial to adjust.
  form.append("audio_file", input.audioBlob, "lab.webm");
  form.append("topic", input.topic);
  if (input.audience) form.append("audience", input.audience);
  if (input.targetLengthSeconds != null) {
    form.append("target_length_seconds", String(input.targetLengthSeconds));
  }
  if (input.domainVocabulary && input.domainVocabulary.length > 0) {
    // A4: one field, JSON-array string (or CSV) — not repeated fields.
    form.append("domain_vocabulary", JSON.stringify(input.domainVocabulary));
  }
  // Duration is measured server-side (A4 lists no audio_duration_sec field).

  const token = await getAuthToken(); // optional — public/guest endpoint
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch("/api/v2/lab/recordings", {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });
  } catch {
    return {
      kind: "error",
      status: 0,
      message: "Couldn't reach the lab — check your connection and try again.",
    };
  }

  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      kind: "rejected",
      message:
        body?.error ??
        "That take was too short or had no clear speech — let's try again.",
    };
  }
  if (!res.ok) {
    return {
      kind: "error",
      status: res.status,
      message: `Analysis failed (HTTP ${res.status}). Try again in a moment.`,
    };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return { kind: "error", status: res.status, message: "Empty response from the lab." };
  }

  // BE A2 (verified live): 201 = { status, session_id, recording_id, state,
  // session_context, readout:{ snippets[] } }. Snippets sit at readout.snippets;
  // state defaults to readout_ready per the BE note.
  const readoutObj =
    body.readout && typeof body.readout === "object" ? body.readout : {};
  return {
    kind: "ok",
    sessionId: typeof body.session_id === "string" ? body.session_id : null,
    state: typeof body.state === "string" ? body.state : "readout_ready",
    readout: mapReadoutPayload(readoutObj),
  };
}
