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
  const [available, setAvailable] = useState(false);
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
        setAvailable(true);
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

  if (!available) {
    return (
      <div className="shrink-0 border-b border-border bg-primary/5 px-4 py-3">
        <p className="mx-auto w-full max-w-2xl text-[12px] text-muted-foreground">
          Coach: the assembled ideal text isn&apos;t ready yet (it builds after
          the third take).
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-border bg-primary/5 px-4 py-3">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted-foreground">
            Coach: review the ideal text, then publish the full analysis
          </span>
          {approved ? (
            <span className="flex items-center gap-1 text-[12px] font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Approved
            </span>
          ) : null}
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
