"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchCoachConfidencePractice,
  saveCoachConfidencePractice,
  type CoachConfidencePractice,
} from "@/services/api/coachConfidencePractice";

export default function CoachConfidencePracticeReview({
  sessionId,
  snippetId,
  enabled,
}: {
  sessionId: string;
  snippetId: string;
  enabled: boolean;
}) {
  const [practice, setPractice] = useState<CoachConfidencePractice | null>(null);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<"yes" | "no" | "refine">("refine");
  const [selectedAttemptDecision, setSelectedAttemptDecision] = useState<
    "yes" | "no" | null
  >(null);
  const [exerciseMode, setExerciseMode] = useState<"library" | "custom">("library");
  const [exerciseId, setExerciseId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState<"private" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    void fetchCoachConfidencePractice(sessionId, snippetId).then((value) => {
      if (!alive) return;
      setLoading(false);
      setPractice(value);
      if (value?.professionalCoachDecision) {
        setDecision(value.professionalCoachDecision);
      }
      const selected = value?.attempts.find((attempt) => attempt.isSelected);
      setSelectedAttemptDecision(selected?.coachConfidenceDecision ?? null);
      if (value?.exercise.isCustom) {
        setExerciseMode("custom");
        setCustomTitle(value.exercise.title);
        setCustomInstruction(value.exercise.instruction);
      } else if (value) {
        setExerciseMode("library");
        setExerciseId(value.exercise.exerciseId);
      }
      if (value?.exercise.explanationVideoRef) {
        setVideoUrl(value.exercise.explanationVideoRef);
      }
    });
    return () => { alive = false; };
  }, [enabled, sessionId, snippetId]);

  async function save(share: boolean) {
    if (!practice || saving) return;
    setSaving(share ? "share" : "private");
    setError(null);
    const updated = await saveCoachConfidencePractice(
      sessionId,
      snippetId,
      decision,
      selectedAttemptDecision,
      share,
      exerciseMode === "custom"
        ? {
            kind: "custom",
            title: customTitle.trim(),
            instruction: customInstruction.trim(),
            explanationVideoUrl: videoUrl.trim() || undefined,
          }
        : {
            kind: "library",
            exerciseId: exerciseId || practice.exercise.exerciseId,
            explanationVideoUrl: videoUrl.trim() || undefined,
          },
    );
    setSaving(null);
    if (!updated) {
      setError("Couldn't save the exercise review. Try again.");
      return;
    }
    setPractice(updated);
  }

  // The endpoint deliberately returns nothing until the blind Yes/No answer
  // is saved. A 404 means this snippet had no practice, so no empty card.
  if (!enabled || (!loading && !practice)) return null;

  return (
    <section className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
        Practice review · after blind rating
      </p>
      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading practice…
        </div>
      ) : practice ? (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <h3 className="text-[16px] font-semibold text-foreground">
              {practice.exercise.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {practice.exercise.instruction}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Exact passage
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-foreground">
              {practice.exactPassage}
            </p>
          </div>
          {practice.originalAudioRef ? (
            <div>
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                Original · user answered {practice.originalUserAnswer ?? "not yet"}
              </p>
              <MediaPlayer
                src={practice.originalAudioRef}
                startOffsetMs={practice.originalStartOffsetMs}
                durationMs={practice.originalDurationMs}
              />
            </div>
          ) : null}
          {practice.attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-xl border border-border bg-background p-3">
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                Attempt {attempt.attemptIndex}
                {attempt.isStrongest ? " · acoustically strongest" : ""}
                {attempt.isSelected ? " · selected by user" : ""}
                {attempt.kept ? ` · kept (${attempt.userAnswer ?? "unanswered"})` : ""}
              </p>
              <MediaPlayer src={attempt.audioRef} startOffsetMs={0} durationMs={attempt.durationMs} />
              {attempt.assessment ? (
                <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                  {attempt.assessment}
                </p>
              ) : null}
            </div>
          ))}

          {practice.attempts.some((attempt) => attempt.isSelected) ? (
            <div className="rounded-xl border border-primary/30 bg-background p-3">
              <p className="text-[13px] font-semibold text-foreground">
                Does the selected practice recording sound confident?
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Judge this new recording itself. The original clip’s rating does not apply here.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["yes", "no"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedAttemptDecision(value)}
                    className={`rounded-full border px-4 py-2 text-[13px] font-medium ${
                      selectedAttemptDecision === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {value === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-[13px] font-semibold text-foreground">Professional decision</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["yes", "no", "refine"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDecision(value)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium ${
                    decision === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  {value === "yes" ? "Yes" : value === "no" ? "No" : "Refine"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Follow-up exercise</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExerciseMode("library")}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium ${
                  exerciseMode === "library"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground"
                }`}
              >
                Existing exercise
              </button>
              <button
                type="button"
                onClick={() => setExerciseMode("custom")}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium ${
                  exerciseMode === "custom"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground"
                }`}
              >
                Create new exercise
              </button>
            </div>
          </div>
          {exerciseMode === "library" ? (
            <label className="text-[13px] font-medium text-foreground">
              Reviewed exercise
              <select
                value={exerciseId || practice.exercise.exerciseId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setExerciseId(nextId);
                  const next = practice.availableExercises.find(
                    (item) => item.exerciseId === nextId,
                  );
                  if (next?.explanationVideoRef) setVideoUrl(next.explanationVideoRef);
                }}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
              >
                {practice.availableExercises.map((item) => (
                  <option key={item.exerciseId} value={item.exerciseId}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-foreground">
                Exercise title
                <input
                  type="text"
                  maxLength={120}
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="text-[13px] font-medium text-foreground">
                Short instruction
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={customInstruction}
                  onChange={(event) => setCustomInstruction(event.target.value)}
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
          <label className="text-[13px] font-medium text-foreground">
            Explanation video URL
            <input
              type="url"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
              placeholder="https://…"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving !== null || (practice.attempts.some((attempt) => attempt.isSelected) && !selectedAttemptDecision) || (exerciseMode === "custom" && (!customTitle.trim() || !customInstruction.trim()))}
              onClick={() => void save(false)}
              className="rounded-full border border-border bg-background px-5 py-2.5 text-[13px] font-medium text-foreground disabled:opacity-50"
            >
              {saving === "private" ? "Saving…" : "Save review privately"}
            </button>
            <button
              type="button"
              disabled={saving !== null || !videoUrl.trim() || (practice.attempts.some((attempt) => attempt.isSelected) && !selectedAttemptDecision) || (exerciseMode === "custom" && (!customTitle.trim() || !customInstruction.trim()))}
              onClick={() => void save(true)}
              className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-50"
            >
              {saving === "share" ? "Sharing…" : "Share with user"}
            </button>
          </div>
          {practice.coachShared ? (
            <p className="text-[12px] text-success">Shared with the user.</p>
          ) : null}
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
