"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import PaywallPanel from "./PaywallPanel";
import FeedbackOverlay from "./FeedbackOverlay";
import { useBackDismiss } from "./useBackDismiss";
import {
  fetchIdealText,
  saveIdealNotes,
  segmentIdealText,
  type IdealKeyMomentLink,
  type IdealText,
} from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  IdealTextOverlay — the user's ideal-text NOTEBOOK (delivery layer)         */
/*                                                                            */
/*  The purple bubble's destination: the coach-approved one-block ideal text   */
/*  in a big, clean reading view. Bolded openings (coach key phrases),         */
/*  underlined key moments — tapping one asks "Go to this moment?" and         */
/*  deep-links into the feedback page anchored at that moment. Copy + Edit;    */
/*  edits save to the user's PERSONAL copy (never the coach canonical — L1).   */
/*  Paywalled: locked (402) renders the unlock panel; pending = coach still    */
/*  working.                                                                   */
/* -------------------------------------------------------------------------- */

export default function IdealTextOverlay({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  // D-3 invariant — the device Back gesture closes THIS overlay (LIFO with the
  // nested FeedbackOverlay, which pushes its own entry on top).
  useBackDismiss(onClose);
  const [status, setStatus] = useState<
    "loading" | "ready" | "locked" | "pending" | "error"
  >("loading");
  const [ideal, setIdeal] = useState<IdealText | null>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);

  // Notebook state: the personal copy wins for display once saved.
  const [notes, setNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // The tapped key moment awaiting "Go to this moment?" confirmation.
  const [momentAsk, setMomentAsk] = useState<IdealKeyMomentLink | null>(null);
  // The open feedback deep-link (stacked over this overlay).
  const [feedbackTarget, setFeedbackTarget] =
    useState<IdealKeyMomentLink | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchIdealText(arcId).then((r) => {
      if (!active) return;
      if (r.kind === "ready") {
        setIdeal(r.ideal);
        setNotes(r.ideal.notes);
        setStatus("ready");
      } else {
        setStatus(r.kind);
      }
    });
    return () => {
      active = false;
    };
  }, [arcId, refetchNonce]);

  const displayText = notes ?? ideal?.text ?? "";

  function copyText() {
    void navigator.clipboard?.writeText(displayText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">
          Your ideal text
        </span>
        <div className="flex items-center gap-1.5">
          {status === "ready" && !editing ? (
            <>
              <button
                type="button"
                onClick={copyText}
                aria-label={copied ? "Copied" : "Copy the text"}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit your copy"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PencilLine className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : null}
          <OverlayCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
          {status === "loading" ? (
            <LoadingState />
          ) : status === "locked" ? (
            <PaywallPanel
              arcId={arcId}
              onUnlocked={() => setRefetchNonce((n) => n + 1)}
            />
          ) : status === "pending" ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Your coach is still shaping your ideal text. It lands here the
              moment it&apos;s approved.
            </p>
          ) : status === "error" ? (
            <p className="py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
              Couldn&apos;t load your ideal text. Try again in a moment.
            </p>
          ) : editing && ideal ? (
            <NotebookEditor
              arcId={arcId}
              initial={displayText}
              onSaved={(text) => {
                setNotes(text);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : ideal ? (
            <NotebookText
              text={displayText}
              ideal={ideal}
              onMomentTap={setMomentAsk}
            />
          ) : null}
        </div>
      </div>

      {/* "Go to this moment?" — the small confirm bubble for a tapped moment. */}
      {momentAsk ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
            <p className="text-[14px] text-foreground">Go to this moment?</p>
            <Button
              type="button"
              onClick={() => {
                setFeedbackTarget(momentAsk);
                setMomentAsk(null);
              }}
              className="h-8 rounded-full bg-foreground px-4 text-[13px] text-background hover:bg-foreground/90"
            >
              Go
            </Button>
            <button
              type="button"
              onClick={() => setMomentAsk(null)}
              className="text-[13px] text-muted-foreground hover:text-foreground"
            >
              Stay
            </button>
          </div>
        </div>
      ) : null}

      {/* The deep-linked feedback page, stacked over the notebook. */}
      {feedbackTarget ? (
        <FeedbackOverlay
          arcId={arcId}
          takeSessionId={feedbackTarget.takeSessionId || null}
          anchorSnippetId={feedbackTarget.snippetId}
          onClose={() => setFeedbackTarget(null)}
          topLayer
        />
      ) : null}
    </div>
  );
}

/** The big, clean reading view: bold key phrases, underlined tappable key
 *  moments. A1-size type, no playback, no chrome. */
function NotebookText({
  text,
  ideal,
  onMomentTap,
}: {
  text: string;
  ideal: IdealText;
  onMomentTap: (m: IdealKeyMomentLink) => void;
}) {
  const segments = segmentIdealText(text, ideal.keyPhrases, ideal.keyMoments);
  return (
    <p className="whitespace-pre-line text-[24px] leading-relaxed text-foreground">
      {segments.map((s, i) =>
        s.moment ? (
          <button
            key={i}
            type="button"
            onClick={() => onMomentTap(s.moment!)}
            className="inline underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:text-primary"
          >
            {s.text}
          </button>
        ) : s.bold ? (
          <strong key={i} className="font-semibold">
            {s.text}
          </strong>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </p>
  );
}

/** The minimalist notebook editor — saves to the user's PERSONAL copy via the
 *  notes PUT; the coach-approved canonical is never touched (L1/A6). */
function NotebookEditor({
  arcId,
  initial,
  onSaved,
  onCancel,
}: {
  arcId: string;
  initial: string;
  onSaved: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // An emptied draft can't save: the mapper reads an empty stored copy as
  // "no personal copy" on the next load, so it would silently revert to the
  // canonical — blocking it here keeps what you see and what persists aligned.
  const empty = draft.trim() === "";

  async function save() {
    if (saving || empty) return;
    setSaving(true);
    setError(null);
    const ok = await saveIdealNotes(arcId, draft);
    setSaving(false);
    if (ok) onSaved(draft);
    else setError("Couldn't save. Try again.");
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[50vh] w-full flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-4 text-[18px] leading-relaxed outline-none focus:border-primary"
      />
      <p className="text-[12px] text-muted-foreground">
        This is your personal copy. The coach-approved original stays unchanged.
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || empty}
          className="h-10 rounded-full bg-foreground px-6 text-[14px] text-background hover:bg-foreground/90"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 rounded-full px-6 text-[14px]"
        >
          Cancel
        </Button>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
