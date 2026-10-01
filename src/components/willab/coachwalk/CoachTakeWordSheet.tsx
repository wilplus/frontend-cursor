"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 7 · A word for this Take (founder 2026-09-30, B3; build plan P2-12). */
/*                                                                            */
/*  After the last moment: one optional message and one optional video for    */
/*  the whole Take. The speaker reads it as "Your coach" before the moments.  */
/*  Skip returns to the queue. The video goes through the session video seam  */
/*  that exists, which returns the ref the word carries.                       */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import CoachVideoRecorder from "../CoachVideoRecorder";
import { uploadCoachVideo } from "@/services/api/coachReview";
import { newUploadKey, videoProvenance } from "@/services/api/coachVideoMeta";
import { fetchTakeWord, saveTakeWord } from "@/services/api/coachWalk";
import { draftTakeWord, type CoachWordDraft } from "@/services/api/coachPanel";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

export default function CoachTakeWordSheet({
  sessionId,
  pseudonym,
  takeIndex,
  pager,
  onClose,
  onSkip,
  onSent,
}: {
  sessionId: string;
  pseudonym: string;
  takeIndex: number | null;
  pager: Pager;
  onClose: () => void;
  onSkip: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [videoRef, setVideoRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CoachWordDraft | null>(null);
  const [blank, setBlank] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTakeWord(sessionId).then(async (word) => {
      if (cancelled) return;
      if (word?.text) setText(word.text);
      if (word?.videoRef) setVideoRef(word.videoRef);
      if (word?.text) return;
      // Phase 7 (C5-a): a draft from the transcript, only once every moment
      // is judged and only while the backend serves it; the coach edits
      // every word, and "Start from blank" is the way out.
      const next = await draftTakeWord(sessionId);
      if (cancelled || !next) return;
      setDraft(next);
      setText((current) => (current === "" ? next.text : current));
    });
    return () => { cancelled = true; };
  }, [sessionId]);

  async function attach(file: File): Promise<void> {
    setUploading(true);
    setError(null);
    const ref = await uploadCoachVideo(sessionId, file, {
      idempotencyKey: newUploadKey(), ...videoProvenance("coach-walk"), durationSec: null,
    });
    setUploading(false);
    if (!ref) {
      setError("Couldn’t upload the video.");
      return;
    }
    setVideoRef(ref);
  }

  async function send(): Promise<void> {
    if (busy || (!text.trim() && !videoRef)) return;
    setBusy(true);
    setError(null);
    const result = await saveTakeWord(sessionId, { text: text.trim(), videoRef, share: true });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSent();
  }

  return (
    <SheetFrame
      title={COPY.takeWordTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
      footer={
        <div className="flex flex-col gap-0.5">
          <button type="button" className={PILL} disabled={busy || uploading || (!text.trim() && !videoRef)}
            onClick={() => void send()} data-testid="coach-word-send">
            {COPY.pillSendWord(pseudonym)}
          </button>
          <button type="button" className={LINK} disabled={busy} onClick={onSkip}>{COPY.linkSkipWord}</button>
          {error ? <p role="alert" className="text-center text-[13px] text-destructive">{error}</p> : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="coach-word-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
          {COPY.takeWordEyebrow(pseudonym, takeIndex)}
        </span>
        <p className="text-[13px] text-muted-foreground">{COPY.takeWordHint}</p>
        {draft ? (
          <div className="flex items-center justify-between gap-2" data-testid="coach-word-draft">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {blank ? COPY.wordsEyebrowBlank : draft.label ?? COPY.wordsEyebrowDrafted}
            </span>
            {blank ? (
              <button type="button" className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => { setBlank(false); setText(draft.text); }}>
                {COPY.linkUseDraft}
              </button>
            ) : (
              <button type="button" className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => { setBlank(true); setText(""); }}>
                {COPY.linkStartBlank}
              </button>
            )}
          </div>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={COPY.takeWordPlaceholder}
          rows={5}
          data-testid="coach-word-field"
          className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] leading-[1.5] text-foreground outline-none focus:border-foreground/40"
        />
        {videoRef ? (
          <video src={videoRef} controls playsInline className="w-full rounded-xl bg-foreground" />
        ) : uploading ? (
          <p className="text-[13px] text-muted-foreground">{COPY.videoUploading}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <CoachVideoRecorder onRecorded={(file) => void attach(file)} disabled={uploading} label={COPY.takeWordVideo} />
            <button type="button" className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => fileRef.current?.click()}>
              {COPY.linkUploadInstead}
            </button>
            <input ref={fileRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); }} />
          </div>
        )}
      </div>
    </SheetFrame>
  );
}
