"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRender } from "./pdfSlides";
import { MarkerToolbar, RichText } from "./RichText";
import {
  approveIdealText,
  fetchCoachIdealText,
  saveCoachIdealText,
} from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  CoachIdealTextPanel — the coach's ideal-text review + edit (redesign)      */
/*                                                                            */
/*  Founder redesign: the same visual language as the recording / feedback     */
/*  screens — a slide on top, then the full ideal text below, split into        */
/*  paragraphs. Each paragraph reads with the assembler's key phrases in bold   */
/*  (one font step bigger) and turns into an editable field on tap. Nothing     */
/*  else: no playback, no counts clutter, no student sections. Minimalistic.    */
/*                                                                            */
/*  Actions: Save (PUT the block) and Approve (PUT + approve, marking the       */
/*  ideal text reviewed). PUBLISH lives on the wrap-up screen now (FE-2), so    */
/*  it only enables once this panel's Approve has run (ideal.approved).         */
/*                                                                            */
/*  Assembly states (FE-3): pending (before take 3 — show the counts), empty    */
/*  (takes are in but nothing to assemble — mark key moments first), ready       */
/*  (the editor opens), failed (a soft error — reopen to retry).               */
/* -------------------------------------------------------------------------- */

/** Split the block into editable paragraphs on blank lines; a soft (single)
 *  newline inside a paragraph stays a soft break. Always at least one entry. */
function splitParagraphs(text: string): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+$/g, ""))
    .filter((p) => p.trim().length > 0);
  return parts.length > 0 ? parts : [""];
}

export default function CoachIdealTextPanel({
  arcId,
  presentationRef = null,
}: {
  arcId: string;
  /** The arc's deck (for the cover slide); null → a blank slide placeholder. */
  presentationRef?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"pending" | "empty" | "ready" | "failed">(
    "pending"
  );
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [takesDone, setTakesDone] = useState<number | null>(null);
  const [takesTarget, setTakesTarget] = useState<number | null>(null);
  const [source, setSource] = useState<"machine" | "coach" | null>(null);
  // The deck for the cover slide: the caller's ref (present when the student
  // view is ready) wins; otherwise whatever the coach lane echoed.
  const [fetchedRef, setFetchedRef] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCoachIdealText(arcId).then((r) => {
      if (!active) return;
      if (!r) {
        setPhase("failed");
        setLoading(false);
        return;
      }
      setApproved(r.approved);
      setTakesDone(r.takesDone);
      setTakesTarget(r.takesTarget);
      setSource(r.source);
      setFetchedRef(r.presentationRef);
      if (r.assemblyState === "ready") {
        setParagraphs(splitParagraphs(r.text));
        setPhase("ready");
      } else if (r.assemblyState === "empty") {
        setPhase("empty");
      } else if (r.assemblyState === "pending") {
        setPhase("pending");
      } else {
        // Legacy payloads (no assembly_state): a real draft still opens; an
        // absent state with no text is a soft error now (FE-3 — never invent
        // "pending", which would mislead with 3 of 3 takes recorded).
        if (r.text.length > 0) {
          setParagraphs(splitParagraphs(r.text));
          setPhase("ready");
        } else {
          setPhase("failed");
        }
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  function joined(): string {
    return paragraphs.join("\n\n");
  }

  async function save(): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setError(null);
    const ok = await saveCoachIdealText(arcId, joined());
    setSaving(false);
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } else {
      setError("Couldn't save the ideal text. Try again.");
    }
    return ok;
  }

  async function approve() {
    if (approving || saving) return;
    setApproving(true);
    setError(null);
    const savedOk = await saveCoachIdealText(arcId, joined());
    if (!savedOk) {
      setApproving(false);
      setError("Couldn't save the ideal text. Try again.");
      return;
    }
    const ok = await approveIdealText(arcId);
    setApproving(false);
    if (ok) {
      setApproved(true);
      // A coach edit + approve makes this a coach-edited draft, not the raw
      // machine assembly.
      setSource("coach");
    } else {
      setError("Couldn't approve the ideal text. Try again.");
    }
  }

  if (loading) {
    return (
      <PanelShell>
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading the ideal text…
        </div>
      </PanelShell>
    );
  }

  if (phase === "failed") {
    return (
      <PanelShell>
        <p className="px-4 py-16 text-center text-[14px] text-muted-foreground">
          Couldn&apos;t load the ideal text just now. Close and reopen this view
          to try again.
        </p>
      </PanelShell>
    );
  }

  if (phase === "pending") {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          <p className="text-[15px] font-medium text-foreground">
            The ideal text assembles after take 3
          </p>
          {takesDone !== null ? (
            <p className="text-[13px] text-muted-foreground">
              {takesDone} of {takesTarget ?? 3} takes recorded so far.
            </p>
          ) : null}
        </div>
      </PanelShell>
    );
  }

  if (phase === "empty") {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          <p className="text-[15px] font-medium text-foreground">
            Nothing to assemble yet
          </p>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Mark some key moments in the takes first, then the ideal text will
            assemble from them here.
          </p>
        </div>
      </PanelShell>
    );
  }

  // ready — the slide + editable paragraphs editor
  return (
    <PanelShell>
      <div className="mx-auto w-full max-w-2xl">
        {/* Cover slide (deck first page; a blank card when there's no deck). */}
        <div className="w-full bg-muted">
          <SlideRender
            presentationRef={presentationRef ?? fetchedRef}
            pageIndex={0}
            title=""
            body=""
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-4 px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">
              Ideal text
            </span>
            {source ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                {source === "coach" ? "Coach-edited" : "Auto-assembled draft"}
              </span>
            ) : null}
          </div>

          {/* Paragraphs — read with bold key phrases (font one step bigger),
              tap any to edit it in place. */}
          {paragraphs.map((p, i) =>
            editingIndex === i ? (
              <ParagraphEditor
                key={i}
                value={p}
                onChange={(v) =>
                  setParagraphs((prev) => prev.map((q, j) => (j === i ? v : q)))
                }
                onDone={() => setEditingIndex(null)}
              />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setEditingIndex(i)}
                className="w-full rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50"
              >
                <RichParagraph text={p} />
              </button>
            )
          )}

          <div className="mt-1 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void save()}
              disabled={saving || approving}
              className="h-9 rounded-full px-5 text-[13px]"
            >
              {saving ? "Saving…" : savedFlash ? "Saved" : "Save"}
            </Button>
            {approved ? (
              <span className="flex items-center gap-1 text-[13px] font-medium text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Approved
              </span>
            ) : (
              <Button
                type="button"
                onClick={() => void approve()}
                disabled={saving || approving}
                className="h-9 rounded-full bg-foreground px-5 text-[13px] text-background hover:bg-foreground/90"
              >
                {approving ? (
                  <Loader2
                    className="mr-1.5 h-3.5 w-3.5 animate-spin"
                    aria-hidden
                  />
                ) : null}
                Approve
              </Button>
            )}
          </div>
          {approved ? (
            <p className="text-[12px] text-muted-foreground">
              Approved. Publish the full analysis from the wrap-up screen.
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        </div>
      </div>
    </PanelShell>
  );
}

/** A scroll container so the panel fills its host (BestPresentationOverlay). */
function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto">{children}</div>;
}

/** One paragraph rendered read-only with the shared marker renderer (bold key
 *  phrases, italics, orange accents, moment links), one font step bigger than
 *  the readout. */
function RichParagraph({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line text-[17px] leading-relaxed text-foreground">
      <RichText text={text} />
    </p>
  );
}

/** The in-place editor for a single paragraph: the FE-9 formatting bar (the
 *  same options the student gets) over an auto-growing textarea that focuses
 *  on mount and returns to the read view on blur. The toolbar wraps the
 *  selection in the pinned markers; its buttons act on mousedown so they
 *  don't blur (= close) the editor. */
function ParagraphEditor({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Caret at the end so a tap-to-edit lands ready to type.
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <div className="flex flex-col gap-1.5">
      <MarkerToolbar textareaRef={ref} value={value} onChange={onChange} />
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onDone}
        rows={1}
        className="w-full resize-none overflow-hidden rounded-lg border border-primary bg-background px-3 py-2 text-[17px] leading-relaxed outline-none"
      />
    </div>
  );
}
