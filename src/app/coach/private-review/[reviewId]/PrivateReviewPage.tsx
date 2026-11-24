"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import Logo from "@/components/Logo";
import { PdfPage } from "@/components/willab/pdfSlides";
import WalkPlayer from "@/components/willab/walk/WalkPlayer";
import { RichText } from "@/components/willab/RichText";
import {
  HumanCoachError, readPrivateCoachReview, sendPrivateCoachFeedback, type PrivateReview,
} from "@/services/api/humanCoach";

export default function PrivateReviewPage({ reviewId }: { reviewId: string }) {
  const [review, setReview] = useState<PrivateReview | null>(null);
  const [problem, setProblem] = useState<HumanCoachError | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void readPrivateCoachReview(reviewId).then(
      (data) => { if (active) { setReview(data); setLoading(false); } },
      (error) => {
        if (!active) return;
        setProblem(error instanceof HumanCoachError ? error : new HumanCoachError("ERROR", "Couldn’t open this Take."));
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [reviewId, revision]);

  return <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6 text-foreground sm:px-8">
    <div className="flex items-center justify-between gap-3">
      <Link href="/chat" aria-label="WillpowerLab chat"><Logo /></Link>
      <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <LockKeyhole className="size-3.5" aria-hidden />Private Take review
      </p>
    </div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Opening Take…</p> : null}
    {problem && <div className="space-y-2" role="alert">
      <p>{problem.code === "NOT_FOUND" ? "This Take isn’t available to this account." : problem.message}</p>
      {problem.code === "UNAUTHORIZED" ? <Link className="underline" href={"/login?redirectTo=" + encodeURIComponent("/coach/private-review/" + reviewId)}>Sign in</Link> :
        problem.code !== "NOT_FOUND" && <button className="min-h-11 underline" type="button"
          onClick={() => { setProblem(null); setLoading(true); setRevision((n) => n + 1); }}>Try again</button>}
    </div>}
    {review && <ReviewContent review={review} reviewId={reviewId} />}
  </main>;
}

function ReviewContent({ review, reviewId }: { review: PrivateReview; reviewId: string }) {
  return <>
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{review.project_title || "Take"}</h1>
      {review.take_index !== null && <p className="text-sm text-muted-foreground">Take {review.take_index}</p>}
    </header>
    {review.note && <section className="rounded-2xl bg-muted p-4">
      <h2 className="mb-1 text-sm font-medium">Message from the speaker</h2>
      <p className="whitespace-pre-wrap break-words">{review.note}</p>
    </section>}
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Full recording</h2>
      {review.audio_url ? <audio controls preload="metadata" className="w-full" src={review.audio_url} aria-label="Full recording" /> :
        <p className="text-sm text-muted-foreground">Recording unavailable.</p>}
    </section>
    <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Feedback walk</h2>
      <div className="flex flex-col gap-2.5">
        {review.walk.map((row) => <article key={row.id} className={"max-w-[90%] rounded-[18px] px-4 py-3 text-[15px] leading-relaxed " + (row.role === "user" ? "self-end bg-[#f6efe7] text-[#171615]" : "self-start bg-muted")}>
          {row.body && <p className="whitespace-pre-wrap break-words"><RichText text={row.body} /></p>}
          {row.clip?.src && <WalkPlayer look="bare" seed={row.id} src={row.clip.src} label="Recording"
            startOffsetMs={row.clip.start_ms ?? null} durationMs={row.clip.duration_ms ?? null} />}
        </article>)}
      </div>
    </section>
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Ideal Text</h2>
      {review.ideal_text.sections.map(({ text, slide_index: slide }, index) => <div key={index} className="space-y-2">
        {slide !== null && <>
          {review.ideal_text.presentation_ref && <PdfPage url={review.ideal_text.presentation_ref} pageIndex={slide} className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border" />}
          <h3 className="text-sm font-medium">{review.ideal_text.slide_titles[slide] || "Slide " + (slide + 1)}</h3>
        </>}
        <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed"><RichText text={text} /></p>
      </div>)}
    </section>
    <FeedbackForm reviewId={reviewId} existing={review.feedback} />
  </>;
}

function FeedbackForm({ reviewId, existing }: { reviewId: string; existing: string | null }) {
  const [feedback, setFeedback] = useState("");
  const [published, setPublished] = useState(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    if (!feedback.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const row = await sendPrivateCoachFeedback(reviewId, feedback);
      setPublished(row.feedback);
    } catch (error) {
      setError(error instanceof HumanCoachError ? error.message : "Couldn’t send this feedback. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="space-y-3 border-t border-border pt-6">
    <h2 className="text-lg font-semibold">Your feedback</h2>
    {published ? <div className="rounded-2xl bg-muted p-4" role="status">
      <p className="mb-2 text-sm text-muted-foreground">Sent to the speaker’s project chat.</p>
      <p className="whitespace-pre-wrap break-words">{published}</p>
    </div> : <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label className="block">
        <span className="mb-2 block text-sm text-muted-foreground">Your feedback goes to the speaker’s project chat.</span>
        <textarea className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base" rows={5}
          maxLength={6000} required disabled={busy} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button className="min-h-11 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        type="submit" disabled={busy || !feedback.trim()}>{busy ? "Sending…" : "Send feedback"}</button>
    </form>}
  </section>;
}
