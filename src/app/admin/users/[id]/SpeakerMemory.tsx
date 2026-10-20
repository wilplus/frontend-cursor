"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Will's note on one speaker (WIL-74, founder 2026-10-20).                   */
/*                                                                            */
/*  Founder only: the backend answers 403 to any other admin, and then this    */
/*  section is not drawn at all. The note is what Will has learned about this */
/*  speaker (backend services/speaker_memory.py): at most five lines, never   */
/*  shown to the speaker or a coach. The founder can correct it; the AI keeps */
/*  building on the corrected note. A note with a number is refused (AC-9).   */
/* -------------------------------------------------------------------------- */

interface Memory {
  note: string;
  written_by: "ai" | "founder" | null;
  updated_at: string | null;
  events: number;
}

const url = (id: string) => `/api/v2/admin/people/${encodeURIComponent(id)}/speaker-memory`;

export default function SpeakerMemory({ id }: { id: string }) {
  const [data, setData] = useState<Memory | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(url(id), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Memory | null) => live && setData(body && typeof body.note === "string" ? body : null))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (!data) return null;

  async function save() {
    setError(null);
    const res = await fetch(url(id), {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: draft }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setError("Not saved. The note can't hold numbers.");
      return;
    }
    setData((await res.json()) as Memory);
    setEditing(false);
  }

  const by = data.written_by === "founder" ? "you" : "Will";
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Will&apos;s note</h2>
      <div className="rounded-2xl border border-border px-4 py-3">
        {editing ? (
          <div className="grid gap-2">
            <textarea
              id="speaker-memory-note"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={save} className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-border px-4 py-1.5 text-sm">Cancel</button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="whitespace-pre-wrap text-sm">{data.note || "Nothing learned yet."}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {data.updated_at ? `Last written by ${by}` : ""}
              </span>
              <button type="button" onClick={() => { setDraft(data.note); setEditing(true); }} className="text-sm underline">Edit</button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Only you see this. Will reads it before it chats with this speaker and before it writes their summary.
      </p>
    </section>
  );
}
