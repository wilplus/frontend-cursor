"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  publishWillabSession,
  type Direction,
} from "@/services/api/publishWillabSession";
import {
  buildPublishPayload,
  publishGate,
  type SnippetAuthor,
} from "./coachPublish";
import type { ReadoutPayload, ReadoutSnippet } from "./readout";

/* -------------------------------------------------------------------------- */
/*  CoachAuthoring — the human-in-the-loop surface (§14)                       */
/*                                                                            */
/*  Per snippet, two split-sink zones that never cross:                       */
/*    Training (private)  → direction-v1 label (threat|ambiguous|challenge) →  */
/*                          classifier store only; NEVER user-visible (AC-9).  */
/*    User                → coach note + strong/to-work-on tag → Insights +     */
/*                          library. The tag is NEVER auto-derived from the     */
/*                          label (leak guard).                               */
/*  Publish floor: every snippet labeled AND ≥1 snippet with a note + tag      */
/*  (human-presence + library floor). Overall message optional. Reuses the     */
/*  Readout's snippet view (MediaPlayer + transcript + hero data).            */
/* -------------------------------------------------------------------------- */

const DIRECTIONS: Direction[] = ["threat", "ambiguous", "challenge"];

export default function CoachAuthoring({
  sessionId,
  readout,
  onPublished,
}: {
  sessionId: string;
  readout: ReadoutPayload;
  onPublished: () => void;
}) {
  const snippets = readout.snippets;
  const [authors, setAuthors] = useState<Record<string, SnippetAuthor>>(() =>
    Object.fromEntries(
      snippets.map((s) => [
        s.id,
        { label: null, note: "", tag: null, when: "", examples: "" },
      ])
    )
  );
  const [overall, setOverall] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, patch: Partial<SnippetAuthor>) {
    setAuthors((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  }

  const snippetIds = snippets.map((s) => s.id);
  const gate = publishGate(snippetIds, authors);
  const canPublish = gate.canPublish && !publishing;

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    const { labels, notes, overallMessage } = buildPublishPayload(
      snippetIds,
      authors,
      overall
    );
    const r = await publishWillabSession({ sessionId, overallMessage, notes, labels });
    setPublishing(false);
    if (r.ok) onPublished();
    else setError(r.message);
  }

  if (snippets.length === 0) {
    return (
      <p className="text-[15px] text-muted-foreground">
        No analyzable snippets in this session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-foreground">
          Overall message to the user{" "}
          <span className="text-muted-foreground">(optional)</span>
        </span>
        <textarea
          value={overall}
          onChange={(e) => setOverall(e.target.value)}
          rows={2}
          placeholder="A warm, specific opener…"
          className="resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
        />
      </label>

      {snippets.map((s, i) => (
        <CoachSnippet
          key={s.id || i}
          snippet={s}
          index={i}
          total={snippets.length}
          author={authors[s.id]!}
          onUpdate={(patch) => update(s.id, patch)}
        />
      ))}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          {error ? (
            <p className="mb-2 text-center text-[13px] text-destructive">{error}</p>
          ) : !canPublish && !publishing ? (
            <p className="mb-2 text-center text-[12px] text-muted-foreground">
              {!gate.allLabeled
                ? "Label every snippet"
                : "Add at least one coach note + tag"}{" "}
              to publish.
            </p>
          ) : null}
          <Button
            onClick={publish}
            disabled={!canPublish}
            className="w-full rounded-full"
          >
            {publishing ? "Publishing…" : "Publish to user"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CoachSnippet({
  snippet,
  index,
  total,
  author,
  onUpdate,
}: {
  snippet: ReadoutSnippet;
  index: number;
  total: number;
  author: SnippetAuthor;
  onUpdate: (patch: Partial<SnippetAuthor>) => void;
}) {
  const f = snippet.features;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 text-[12px] text-muted-foreground">
        Snippet {index + 1} of {total}
      </div>
      <MediaPlayer
        src={snippet.audioRef}
        startOffsetMs={snippet.startOffsetMs}
        durationMs={snippet.durationMs}
      />
      {snippet.transcript ? (
        <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 text-[15px] italic leading-relaxed text-foreground">
          {snippet.transcript}
        </blockquote>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted-foreground">
        <span>
          speech rate{" "}
          {f.speechRate != null ? `${Math.round(f.speechRate)} wpm` : "—"}
        </span>
        <span>
          pause ratio{" "}
          {f.pauseRatio != null ? `${Math.round(f.pauseRatio * 100)}%` : "—"}
        </span>
        {snippet.stickiness.comment ? (
          <span className="italic">“{snippet.stickiness.comment}”</span>
        ) : null}
      </div>

      {/* Training zone — private, never user-visible */}
      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Training — not visible to user
        </p>
        <div className="mt-2 flex gap-2">
          {DIRECTIONS.map((d) => {
            const active = author.label === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onUpdate({ label: d })}
                className={`rounded-full border px-3 py-1.5 text-[13px] capitalize transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* User zone — note + tag (independent of the label) */}
      <div className="mt-3">
        <textarea
          value={author.note}
          onChange={(e) => onUpdate({ note: e.target.value })}
          rows={2}
          placeholder="Note to the user (optional)…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
        />
        <div className="mt-2 flex gap-2">
          {(["strong", "to_work_on"] as const).map((t) => {
            const active = author.tag === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onUpdate({ tag: active ? null : t })}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {t === "strong" ? "Strong" : "To work on"}
              </button>
            );
          })}
        </div>
        <textarea
          value={author.when}
          onChange={(e) => onUpdate({ when: e.target.value })}
          rows={2}
          placeholder="When / how to use this — coaching, not a rule (optional)…"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
        />
        <textarea
          value={author.examples}
          onChange={(e) => onUpdate({ examples: e.target.value })}
          rows={2}
          placeholder="Examples, one per line (optional)…"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}
