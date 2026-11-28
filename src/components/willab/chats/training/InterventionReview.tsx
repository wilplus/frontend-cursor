"use client";

import { useState } from "react";
import { casePath, patternRequest, type CaseLink } from "./speakingPatterns";
import { useRecorder } from "./ShapeFix";
import { Bubble, choiceBubble } from "./ui";

type Heard = { audio: string; content_type: string; kept_by: "generated" | "voice" };

/** Approve, reject or replace the intervention just heard (backend N713). */
export function InterventionReview({ clip, pattern, line, heard }: {
  clip: CaseLink; pattern: string; line: string; heard: Heard | null;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [kept, setKept] = useState("");
  const [file, setFile] = useState<Blob | null>(null);
  const [open, setOpen] = useState(false);
  const mic = useRecorder(180, (blob) => setFile(blob));

  async function send(decision: string, audio: string | null, contentType: string, keptBy: string) {
    setBusy(true); setNotice("");
    try {
      const got = await patternRequest<{ status?: string }>(`${casePath(clip)}/intervention`, "POST", {
        decision, pattern, line, reason, audio, content_type: contentType, kept_by: keptBy, score: 1,
      });
      setKept(got.status || decision);
    } catch (caught) {
      setNotice(caught instanceof Error && caught.message ? caught.message : "Couldn’t open or save the pattern library. Try again.");
    } finally { setBusy(false); }
  }

  async function encoded(blob: Blob) {
    const raw = new Uint8Array(await blob.arrayBuffer());
    let text = "";
    raw.forEach((byte) => { text += String.fromCharCode(byte); });
    return btoa(text);
  }

  return <div data-review={kept || "open"} className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={choiceBubble(true)} disabled={busy || !heard}
        onClick={() => heard && void send("approve", heard.audio, heard.content_type, heard.kept_by)}>Approve</button>
      <button type="button" className={choiceBubble(false)} disabled={busy}
        onClick={() => void send("reject", null, "", heard?.kept_by || "generated")}>Reject</button>
      <button type="button" className={choiceBubble(false)} disabled={busy} onClick={() => setOpen(true)}>Correct</button>
    </div>
    <label className="flex flex-col gap-1 text-[15px]">Reason
      <input value={reason} onChange={(event) => setReason(event.target.value)} className="rounded border px-2 py-1" />
    </label>
    {open ? <div className="flex flex-wrap gap-2">
      {mic.recording
        ? <button type="button" className={choiceBubble(true)} onClick={mic.stop}>Stop</button>
        : <button type="button" className={choiceBubble(false)} onClick={() => void mic.start()}>Record it the right way</button>}
      <label className={choiceBubble(false)}>Import audio
        <input type="file" accept="audio/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>
      <button type="button" className={choiceBubble(true)} disabled={busy || !file || mic.recording}
        onClick={() => file && void encoded(file).then((audio) => send("correct", audio, file.type || "audio/webm", "corrected"))}>Keep</button>
    </div> : null}
    {mic.denied ? <Bubble role="alert">Allow microphone access, then try again.</Bubble> : null}
    {notice ? <Bubble role="status">{notice}</Bubble> : null}
  </div>;
}
