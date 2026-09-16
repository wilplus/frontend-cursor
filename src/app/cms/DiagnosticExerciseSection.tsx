"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  adminListDiagnosticExercises,
  adminListSpeakingErrors,
  adminSaveDiagnosticExercise,
  type AdminSpeakingError,
} from "@/services/api/journalAdmin";

const INPUT =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30";

/** The shape the backend enforces. Mirrored so an author gets a sentence
 *  rather than a constraint violation. */
const ID_SHAPE = /^[a-z][a-z0-9_-]{1,62}$/;

function suggestId(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .replace(/-+$/, "")
    .slice(0, 59);
}

/** Explicit opt-in bridge between one published journal post and the exercise
 *  catalogue. Publishing a post never adds it automatically.
 *
 *  Until 2026-09-16 this saved one hardcoded exercise — `hear-every-word-v1`,
 *  always claiming all three problem tags. A second exercise could not exist,
 *  and if one had, both would have claimed everything: tag overlap would score
 *  them identically and matching would rank without choosing anything. The id
 *  and the tags are now the author's. */
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
  const [exerciseId, setExerciseId] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  const [errors, setErrors] = useState<AdminSpeakingError[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [intro, setIntro] = useState("");
  const [confidentIntro, setConfidentIntro] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || !password) return;
    let alive = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      adminListDiagnosticExercises(password),
      adminListSpeakingErrors(password),
    ]).then(([list, library]) => {
      if (!alive) return;
      setLoading(false);
      if (library.ok) setErrors(library.data);
      if (!list.ok) {
        setError(list.message);
        return;
      }
      setKnown(list.data.map((item) => item.exerciseId));
      const mine = list.data.find((item) => item.journalPostId === postId);
      if (!mine) return;
      setExerciseId(mine.exerciseId);
      setActive(mine.active);
      setTitle(mine.title);
      setInstruction(mine.instruction);
      setIntro(mine.introductionCopy);
      setConfidentIntro(mine.confidentIntroductionCopy || "");
      setVideoUrl(mine.explanationVideoUrl || "");
      setTags(mine.acousticProblemTags);
    });
    return () => { alive = false; };
  }, [password, postId]);

  useEffect(() => {
    if (postStatus !== "published") setActive(false);
  }, [postStatus]);

  function problem(): string | null {
    if (!ID_SHAPE.test(exerciseId.trim())) {
      return "Id: lower-case letters, digits, hyphens and underscores only, starting with a letter.";
    }
    if (!title.trim() || !instruction.trim() || !intro.trim()) {
      return "Give it a name, an instruction and an opening line.";
    }
    if (!videoUrl.trim()) return "An exercise needs an explanation video.";
    if (tags.length === 0) {
      return "Pick at least one error this exercise treats — an exercise that treats nothing is never offered.";
    }
    return null;
  }

  async function save() {
    if (!postId || saving) return;
    const said = problem();
    if (said) {
      setError(said);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await adminSaveDiagnosticExercise(password, {
      exerciseId: exerciseId.trim(),
      journalPostId: postId,
      title: title.trim(),
      instruction: instruction.trim(),
      introductionCopy: intro.trim(),
      confidentIntroductionCopy: confidentIntro.trim(),
      explanationVideoUrl: videoUrl.trim(),
      acousticProblemTags: tags,
      active,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "The exercise was not returned." : result.message);
      return;
    }
    setActive(result.data.active);
    setMessage(result.data.active ? "Exercise is live." : "Saved, not live.");
  }

  if (!postId) {
    return (
      <section className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Confident Voice exercise
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Save this post before making it an exercise.
        </p>
      </section>
    );
  }

  const detected = errors.filter((e) => e.detected);
  const namedOnly = errors.filter((e) => !e.detected);
  const isNew = !known.includes(exerciseId.trim());

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Confident Voice exercise
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Publishing this post does not add it automatically.
          </p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="text-xs font-medium text-foreground">
          Name
          <input
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              const tracking = exerciseId === suggestId(title);
              setTitle(next);
              if (tracking || !exerciseId) setExerciseId(suggestId(next));
            }}
            placeholder="Land the ending"
            className={INPUT}
          />
        </label>
        <label className="text-xs font-medium text-foreground">
          Id
          <input
            value={exerciseId}
            onChange={(event) => setExerciseId(event.target.value)}
            placeholder="land-the-ending-v1"
            className={`${INPUT} font-mono`}
          />
          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
            {exerciseId.trim() && !isNew ? "Updates the existing exercise." : "Creates a new exercise."}
          </span>
        </label>

        <div className="text-xs font-medium text-foreground">
          What it fixes
          <div className="mt-2 flex flex-wrap gap-2">
            {detected.map((item) => {
              const on = tags.includes(item.errorId);
              return (
                <button
                  key={item.errorId}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTags((prev) =>
                      on ? prev.filter((t) => t !== item.errorId) : [...prev, item.errorId],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-normal ${
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            {detected.length === 0 ? (
              <span className="text-[11px] font-normal text-muted-foreground">
                No detectable errors in the library yet.
              </span>
            ) : null}
          </div>
          {namedOnly.length ? (
            <div className="mt-3">
              <p className="text-[11px] font-normal text-muted-foreground">
                Named only — no detector yet, so these cannot be picked
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {namedOnly.map((item) => (
                  <span
                    key={item.errorId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-[12px] font-normal text-muted-foreground opacity-60"
                  >
                    <Lock className="h-2.5 w-2.5" aria-hidden />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] font-normal text-muted-foreground">
            Claim all of them and this is never picked over another exercise.
          </p>
        </div>

        <label className="text-xs font-medium text-foreground">
          Short instruction
          <textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} className={`${INPUT} resize-y`} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Opening line
          <textarea rows={3} value={intro} onChange={(event) => setIntro(event.target.value)} className={`${INPUT} resize-y`} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Opening line — already confident
          <textarea rows={2} value={confidentIntro} onChange={(event) => setConfidentIntro(event.target.value)} className={`${INPUT} resize-y`} />
        </label>
        <label className="text-xs font-medium text-foreground">
          Explanation video URL
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
            Offer this to speakers
            {postStatus !== "published" ? (
              <span className="block text-muted-foreground">Publish the post first.</span>
            ) : null}
          </span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save exercise
        </button>
        {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      </div>
      {error ? <p className="mt-2 text-xs leading-relaxed text-destructive">{error}</p> : null}
    </section>
  );
}
