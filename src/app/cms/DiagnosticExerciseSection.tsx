"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  adminListDiagnosticExercises,
  adminSaveDiagnosticExercise,
} from "@/services/api/journalAdmin";

const EXERCISE_ID = "hear-every-word-v1";
const DEFAULT_TITLE = "Hear every word";
const DEFAULT_INSTRUCTION =
  "Read the same text again, slightly more slowly. Give every word enough space to be heard clearly without forcing your voice.";
const DEFAULT_INTRO =
  "You’re close to a confident delivery here. Your pace is carrying energy, but some words become compressed. Try the same text again while giving each word enough space.";
const DEFAULT_CONFIDENT_INTRO =
  "Your original already carries confident energy. This is an optional refinement: try the same text again while giving each word enough space.";

const INPUT =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30";

/** Explicit opt-in bridge between one published journal post and the narrow
 * diagnostic library. Merely publishing a post never touches this mapping. */
export default function DiagnosticExerciseSection({
  password,
  postId,
  postStatus,
}: {
  password: string;
  postId: string | null;
  postStatus: "draft" | "published";
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkedPostId, setLinkedPostId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION);
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [confidentIntro, setConfidentIntro] = useState(DEFAULT_CONFIDENT_INTRO);
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || !password) return;
    let alive = true;
    setLoading(true);
    setError(null);
    void adminListDiagnosticExercises(password).then((result) => {
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const exercise = result.data.find((item) => item.exerciseId === EXERCISE_ID);
      if (!exercise) return;
      setLinkedPostId(exercise.journalPostId);
      setActive(exercise.active && exercise.journalPostId === postId);
      setTitle(exercise.title || DEFAULT_TITLE);
      setInstruction(exercise.instruction || DEFAULT_INSTRUCTION);
      setIntro(exercise.introductionCopy || DEFAULT_INTRO);
      setConfidentIntro(
        exercise.confidentIntroductionCopy || DEFAULT_CONFIDENT_INTRO,
      );
      setVideoUrl(exercise.explanationVideoUrl || "");
    });
    return () => { alive = false; };
  }, [password, postId]);

  useEffect(() => {
    if (postStatus !== "published") setActive(false);
  }, [postStatus]);

  async function save() {
    if (!postId || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await adminSaveDiagnosticExercise(password, {
      journalPostId: postId,
      title: title.trim(),
      instruction: instruction.trim(),
      introductionCopy: intro.trim(),
      confidentIntroductionCopy: confidentIntro.trim(),
      explanationVideoUrl: videoUrl.trim(),
      active,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "The exercise mapping was not returned." : result.message);
      return;
    }
    setLinkedPostId(result.data.journalPostId);
    setActive(result.data.active);
    setMessage(result.data.active ? "Diagnostic exercise active." : "Mapping saved inactive.");
  }

  if (!postId) {
    return (
      <section className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Confident Voice exercise
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Save this post before linking it to a diagnostic exercise.
        </p>
      </section>
    );
  }

  const linkedElsewhere = linkedPostId !== null && linkedPostId !== postId;
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Confident Voice exercise
          </p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">Hear every word</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Publishing this post does not add it automatically. Saving here is the explicit diagnostic mapping.
          </p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {linkedElsewhere ? (
        <p className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This exercise is currently linked to another post. Saving here moves the mapping to this post.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        <label className="text-xs font-medium text-foreground">
          Exercise title
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Short instruction
          <textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} className={`${INPUT} resize-y`} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Near-confident introduction
          <textarea rows={3} value={intro} onChange={(event) => setIntro(event.target.value)} className={`${INPUT} resize-y`} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Already-confident introduction
          <textarea rows={3} value={confidentIntro} onChange={(event) => setConfidentIntro(event.target.value)} className={`${INPUT} resize-y`} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Short explanation video URL
          <input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://…" className={INPUT} />
        </label>
        <label className="flex items-start gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={active}
            disabled={postStatus !== "published"}
            onChange={(event) => setActive(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Active for matching Confident Voice moments
            {postStatus !== "published" ? (
              <span className="block text-muted-foreground">Publish the post before activating it.</span>
            ) : null}
          </span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !title.trim() || !instruction.trim() || !intro.trim() || !videoUrl.trim()}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save exercise mapping
        </button>
        {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
