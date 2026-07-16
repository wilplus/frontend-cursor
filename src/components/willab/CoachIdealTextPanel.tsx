"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishArc } from "@/services/api/arcBatch";
import {
  approveIdealText,
  fetchCoachIdealText,
  saveCoachIdealText,
} from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  CoachIdealTextPanel — the coach's ONE-BLOCK ideal-text flow (delivery      */
/*  layer). Replaces the per-slide MarkerEditor + the R4-10 publish strip.     */
/*                                                                            */
/*  The coach reviews the auto-assembled block in the same minimalist editor   */
/*  the user sees, then:                                                       */
/*    Save                            → PUT the edit (draft, nothing sent)     */
/*    Save and Publish full analysis  → PUT → approve → arc publish, which     */
/*      delivers the 4 bubbles (BE requires all 3 takes saved + approval and   */
/*      409s otherwise — surfaced verbatim here).                              */
/* -------------------------------------------------------------------------- */

export default function CoachIdealTextPanel({ arcId }: { arcId: string }) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [approved, setApproved] = useState(false);
  // FE-A — the observable assembler: "pending" = fewer than 3 spoken takes
  // (show the counts), "ready" = the persisted draft opens instantly,
  // "failed" = the fetch itself broke. Older payloads (no assembly_state)
  // infer: text present → ready, absent → pending without counts.
  const [phase, setPhase] = useState<"pending" | "ready" | "failed">("pending");
  const [takesDone, setTakesDone] = useState<number | null>(null);
  const [takesTarget, setTakesTarget] = useState<number | null>(null);
  // FP-1 — provenance ("machine" = auto-assembled, untouched; "coach" = edited).
  const [source, setSource] = useState<"machine" | "coach" | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.5))}px`;
  }, [draft, loading]);

  useEffect(() => {
    let active = true;
    void fetchCoachIdealText(arcId).then((r) => {
      if (!active) return;
      if (r) {
        setDraft(r.text);
        setApproved(r.approved);
        setTakesDone(r.takesDone);
        setTakesTarget(r.takesTarget);
        setSource(r.source);
        const ready =
          r.assemblyState === "ready" ||
          (r.assemblyState === null && r.text.length > 0);
        setPhase(ready ? "ready" : "pending");
      } else {
        setPhase("failed");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  async function save(): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setError(null);
    const ok = await saveCoachIdealText(arcId, draft);
    setSaving(false);
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } else {
      setError("Couldn't save the ideal text. Try again.");
    }
    return ok;
  }

  async function saveAndPublish() {
    if (publishing || published) return;
    setPublishing(true);
    setError(null);
    // Save → approve → publish, stopping at the first failure.
    const savedOk = await saveCoachIdealText(arcId, draft);
    if (!savedOk) {
      setPublishing(false);
      setError("Couldn't save the ideal text. Try again.");
      return;
    }
    if (!approved) {
      const approvedOk = await approveIdealText(arcId);
      if (!approvedOk) {
        setPublishing(false);
        setError("Couldn't approve the ideal text. Try again.");
        return;
      }
      setApproved(true);
    }
    const r = await publishArc(arcId);
    setPublishing(false);
    if (r.kind === "ok") {
      setPublished(true);
    } else if (r.kind === "ideal_text_incomplete") {
      setError("The ideal text needs finishing before the publish.");
    } else {
      // Includes the BE's "not all takes saved" 409 — surfaced verbatim.
      setError(r.message);
    }
  }

  if (loading) {
    return (
      <div className="shrink-0 border-b border-border bg-primary/5 px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading the ideal text…
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="shrink-0 border-b border-border bg-primary/5 px-4 py-3">
        <p className="mx-auto w-full max-w-2xl text-[12px] text-muted-foreground">
          Couldn&apos;t load the ideal text just now. Reopen this view to try
          again.
        </p>
      </div>
    );
  }

  if (phase === "pending") {
    return (
      <div className="shrink-0 border-b border-border bg-primary/5 px-4 py-3">
        <p className="mx-auto w-full max-w-2xl text-[12px] text-muted-foreground">
          Ideal text assembles after take 3
          {takesDone !== null
            ? `. ${takesDone} of ${takesTarget ?? 3} takes recorded so far.`
            : "."}
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-border bg-primary/5 px-4 py-3">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            Coach: review the ideal text, then publish the full analysis
            {/* FP-1 — provenance so the coach knows if it's still the raw
                auto-assembly or something they've already edited. */}
            {source ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                {source === "coach" ? "Coach-edited" : "Auto-assembled draft"}
              </span>
            ) : null}
          </span>
          {approved ? (
            <span className="flex items-center gap-1 text-[12px] font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Approved
            </span>
          ) : (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
              Ready to review
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="w-full resize-none overflow-y-auto rounded-xl border border-border bg-background px-3.5 py-3 text-[16px] leading-relaxed outline-none focus:border-primary"
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void save()}
            disabled={saving || publishing}
            className="h-9 rounded-full px-5 text-[13px]"
          >
            {saving ? "Saving…" : savedFlash ? "Saved" : "Save"}
          </Button>
          <Button
            type="button"
            onClick={() => void saveAndPublish()}
            disabled={publishing || published}
            className="h-9 rounded-full bg-foreground px-5 text-[13px] text-background hover:bg-foreground/90"
          >
            {publishing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            {published ? "Published" : "Save and Publish full analysis"}
          </Button>
        </div>

        {published ? (
          <p className="text-[12px] text-success">
            Delivered: 3 feedback bubbles + the ideal text.
          </p>
        ) : null}
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
