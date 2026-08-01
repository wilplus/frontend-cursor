"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { EMPTY, STATUS, STRATEGY } from "@/lib/life/copy";
import {
  applyStrategyDiff,
  downloadStrategy,
  extensionForContentType,
  fetchStrategy,
  uploadStrategy,
} from "@/services/api/life";
import type { LifeStrategyDiff } from "@/lib/life/types";
import { EmptyState, Eyebrow, PanelCard, Resource, usePanelResource } from "./primitives";

/* -------------------------------------------------------------------------- */
/*  Strategy — read, download, re-upload (FE-4 lower half, FE-9)               */
/*                                                                            */
/*  RE-UPLOAD PRODUCES A DIFF YOU APPROVE, NEVER A SILENT OVERWRITE. That is   */
/*  not caution for its own sake: arbitrary word-processor formatting will not */
/*  round-trip cleanly back into structured sections, so the diff is the       */
/*  safety net that catches what the parse got wrong before it lands.          */
/*                                                                            */
/*  Whatever the upload wanted to do to the immutable core (Section I, the     */
/*  rank of the bets) is dropped by the backend and named in `blockedSections` */
/*  so the drop is visible rather than silent (L-2a).                          */
/*                                                                            */
/*  Upload is plain text or markdown. A .docx is a zip archive, so reading it  */
/*  in the browser would produce mojibake, not a document. See the open        */
/*  question in the spec: markdown is materially safer and is what this        */
/*  accepts today.                                                            */
/* -------------------------------------------------------------------------- */

export default function StrategyPanel({ compact = false }: { compact?: boolean }) {
  const load = useCallback(() => fetchStrategy(), []);
  const resource = usePanelResource("strategy", load);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [diff, setDiff] = useState<LifeStrategyDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /** FE-11 — ask the server to render the file and save what comes back.
   *
   *  The extension is derived from the RESPONSE Content-Type, never from the
   *  format we asked for. The endpoint degrades to markdown with a 200 when a
   *  renderer is unavailable, so naming the file .pdf because we requested pdf
   *  would save markdown inside a .pdf — a file the user's reader refuses to
   *  open, with nothing anywhere to explain why. When the server sends a
   *  filename we use it verbatim and derive nothing at all. */
  async function download(format: "pdf" | "docx", version: number) {
    setBusy(true);
    setFailed(false);
    try {
      const file = await downloadStrategy(format);
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        file.filename ??
        `strategy-v${version}${extensionForContentType(file.contentType)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setBusy(true);
    setFailed(false);
    try {
      const text = await file.text();
      setDiff(await uploadStrategy(text));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!diff) return;
    setBusy(true);
    try {
      await applyStrategyDiff(diff);
      setDiff(null);
      resource.reload();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Resource resource={resource}>
      {(strategy) => {
        if (!strategy) return <EmptyState>{EMPTY.strategy}</EmptyState>;
        return (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Eyebrow>
                Strategy, version {strategy.version}
                {strategy.reviewedOn ? ` · reviewed ${strategy.reviewedOn}` : ""}
              </Eyebrow>
              <div className="flex gap-2">
                {/* Two explicit formats rather than one "Download": the
                    founder asked for an editable Word file alongside the PDF,
                    and a single button cannot offer both without a menu. */}
                <button
                  type="button"
                  onClick={() => void download("pdf", strategy.version)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  {STRATEGY.downloadPdfLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void download("docx", strategy.version)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  {STRATEGY.downloadDocxLabel}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {STRATEGY.uploadLabel}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onFile(file);
                  }}
                />
              </div>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {STRATEGY.uploadNote}
            </p>

            {failed ? (
              <p className="mt-3 text-sm text-muted-foreground">{STATUS.error}</p>
            ) : null}

            {diff ? (
              <div className="mt-4">
                <StrategyDiffReview
                  diff={diff}
                  busy={busy}
                  onApply={() => void apply()}
                  onCancel={() => setDiff(null)}
                />
              </div>
            ) : null}

            <article
              className={`mt-5 whitespace-pre-wrap rounded-2xl border border-border bg-background p-4 text-[15px] leading-[1.7] text-foreground/90 ${
                compact ? "max-h-96 overflow-y-auto" : ""
              }`}
            >
              {strategy.body}
            </article>
          </section>
        );
      }}
    </Resource>
  );
}

function StrategyDiffReview({
  diff,
  busy,
  onApply,
  onCancel,
}: {
  diff: LifeStrategyDiff;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const changed = diff.lines.filter((l) => l.op !== "keep");
  return (
    <PanelCard className="border-dashed">
      <Eyebrow>What this upload would change</Eyebrow>

      {diff.blockedSections.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm text-foreground">{STRATEGY.blockedNote}</p>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {diff.blockedSections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {changed.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing in that file is different from what is already here.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-background">
          <pre className="min-w-full p-3 text-[13px] leading-[1.6]">
            {diff.lines.map((line, i) => (
              <span
                key={i}
                className={
                  line.op === "add"
                    ? "block bg-emerald-50 text-emerald-900"
                    : line.op === "remove"
                      ? "block bg-rose-50 text-rose-900 line-through"
                      : "block text-foreground/70"
                }
              >
                {line.op === "add" ? "+ " : line.op === "remove" ? "- " : "  "}
                {line.text}
              </span>
            ))}
          </pre>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={busy || changed.length === 0}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {STRATEGY.applyLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground disabled:opacity-40"
        >
          {STRATEGY.cancelLabel}
        </button>
      </div>
    </PanelCard>
  );
}
