"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import MainTargetPicker, { keptMainTarget } from "@/app/cms/MainTargetPicker";
import {
  draftExerciseScript,
  suggestExerciseId,
  type CoachExerciseDraft,
} from "@/services/api/coachExercises";
import type { SpeakingError } from "@/services/api/speakingErrors";

/* -------------------------------------------------------------------------- */
/*  THE AUTHORING FORM (founder 2026-09-29, decision 4)                        */
/*                                                                            */
/*  The CMS editor's fields, in the coach's own panel: the id, the name, the   */
/*  speaking errors it treats (only the DETECTED ones can be picked — an       */
/*  exercise tagged with a merely-named error matches nothing, and the         */
/*  backend refuses it), the one main target, the script, the video.          */
/*                                                                            */
/*  THE SCRIPT DRAFT IS A CANDIDATE. "Draft a script" asks the backend for a   */
/*  first script from the library's own past finals; it is shown here, and    */
/*  only reaches the exercise when the coach takes it into the script field   */
/*  and edits it. The draft rides beside the coach's final on the version row  */
/*  (0395) and is served nowhere.                                             */
/*                                                                            */
/*  A NEW EXERCISE NEEDS ITS VIDEO. The library refuses an exercise without   */
/*  one, so the first save carries the file; an existing exercise keeps its    */
/*  video unless a new one is chosen.                                         */
/* -------------------------------------------------------------------------- */

/** Every sentence on this form, in one place. Coach-facing wording; founder
 *  sign-off pending (accepted design, 2026-09-29). */
export const FORM_COPY = {
  newHeading: "New exercise",
  editHeading: (title: string) => `Edit “${title}”`,
  id: "Exercise id",
  idNew: "Creates a new exercise.",
  title: "Title",
  fixes: "What it fixes",
  noDetected: "No detectable errors in the library yet.",
  namedOnly: "Named only — no detector yet, so these cannot be picked",
  beingTested: "being tested",
  allTags: "Claim all of them and this is never picked over another exercise.",
  script: "Script",
  scriptHelp:
    "What you say in the video, written for the speaker. It goes into the library as the exercise's instruction.",
  draft: "Draft a script",
  drafting: "Drafting…",
  draftNeedsError: "Pick a speaking error first.",
  draftHeading: "Draft",
  draftHelp: "A first script from the library's own exercises for these errors. Edit every word; nothing is saved until you do.",
  useDraft: "Use this draft",
  intro: "Introduction (optional)",
  video: "Video",
  currentVideo: "Current video",
  replaceVideo: "Replace the video",
  videoHelp: "Transcribed when it is uploaded, under your own processing authorization.",
  active: "Live: the matcher may offer it",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
} as const;

const INPUT =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30";
const LABEL = "block text-xs font-medium text-foreground";
const HELP = "mt-1 block text-[11px] font-normal text-muted-foreground";

export interface ExerciseFormProps {
  draft: CoachExerciseDraft;
  onDraft: (next: CoachExerciseDraft) => void;
  errors: SpeakingError[];
  isNew: boolean;
  videoFile: File | null;
  onVideoFile: (file: File | null) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  problem: string | null;
}

function TagChips({
  draft,
  onDraft,
  errors,
}: Pick<ExerciseFormProps, "draft" | "onDraft" | "errors">) {
  const detected = errors.filter((e) => e.status === "detected");
  const namedOnly = errors.filter((e) => e.status !== "detected");
  const labels = new Map(errors.map((e) => [e.errorId, e.label]));

  function toggle(errorId: string) {
    const on = draft.acousticProblemTags.includes(errorId);
    const tags = on
      ? draft.acousticProblemTags.filter((t) => t !== errorId)
      : [...draft.acousticProblemTags, errorId];
    onDraft({ ...draft, acousticProblemTags: tags, mainTarget: keptMainTarget(tags, draft.mainTarget) });
  }

  return (
    <div className={LABEL}>
      {FORM_COPY.fixes}
      <div className="mt-2 flex flex-wrap gap-2">
        {detected.map((item) => {
          const on = draft.acousticProblemTags.includes(item.errorId);
          return (
            <button
              key={item.errorId}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.errorId)}
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
          <span className="text-[11px] font-normal text-muted-foreground">{FORM_COPY.noDetected}</span>
        ) : null}
      </div>
      {namedOnly.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-normal text-muted-foreground">{FORM_COPY.namedOnly}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {namedOnly.map((item) => (
              <span
                key={item.errorId}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-[12px] font-normal text-muted-foreground opacity-60"
              >
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {item.label}{item.status === "shadow" ? ` · ${FORM_COPY.beingTested}` : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <p className={HELP}>{FORM_COPY.allTags}</p>
      <MainTargetPicker
        tags={draft.acousticProblemTags}
        labels={labels}
        value={draft.mainTarget}
        onChange={(next) => onDraft({ ...draft, mainTarget: next })}
      />
    </div>
  );
}

function ScriptField({ draft, onDraft }: Pick<ExerciseFormProps, "draft" | "onDraft">) {
  const [drafting, setDrafting] = useState(false);
  const [scriptDraft, setScriptDraft] = useState<{ text: string; model: string | null } | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  async function ask() {
    if (drafting) return;
    if (draft.acousticProblemTags.length === 0) {
      setSaid(FORM_COPY.draftNeedsError);
      return;
    }
    setDrafting(true);
    setSaid(null);
    const result = await draftExerciseScript({
      errorIds: draft.acousticProblemTags,
      title: draft.title,
    });
    setDrafting(false);
    if (!result.ok) {
      setSaid(result.message);
      return;
    }
    setScriptDraft({ text: result.data.draft, model: result.data.modelVersion });
  }

  function useDraft() {
    if (!scriptDraft) return;
    onDraft({
      ...draft,
      instruction: scriptDraft.text,
      aiDraftText: scriptDraft.text,
      aiDraftModelVersion: scriptDraft.model,
    });
  }

  return (
    <div>
      <label className={LABEL}>
        {FORM_COPY.script}
        <textarea
          rows={6}
          value={draft.instruction}
          placeholder={FORM_COPY.script}
          onChange={(event) => onDraft({ ...draft, instruction: event.target.value })}
          className={INPUT}
        />
        <span className={HELP}>{FORM_COPY.scriptHelp}</span>
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void ask()}
          disabled={drafting}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground disabled:opacity-50"
        >
          {drafting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
          {drafting ? FORM_COPY.drafting : FORM_COPY.draft}
        </button>
        {said ? <span className="text-[11px] text-destructive">{said}</span> : null}
      </div>
      {scriptDraft ? (
        <section className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {FORM_COPY.draftHeading}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
            {scriptDraft.text}
          </p>
          <p className={HELP}>{FORM_COPY.draftHelp}</p>
          <button
            type="button"
            onClick={useDraft}
            className="mt-2 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground"
          >
            {FORM_COPY.useDraft}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function VideoField({
  draft,
  isNew,
  videoFile,
  onVideoFile,
}: Pick<ExerciseFormProps, "draft" | "isNew" | "videoFile" | "onVideoFile">) {
  return (
    <div className={LABEL}>
      {FORM_COPY.video}
      {!isNew && draft.explanationVideoUrl ? (
        <p className="mt-1 text-[11px] font-normal text-muted-foreground">
          {FORM_COPY.currentVideo}:{" "}
          <a href={draft.explanationVideoUrl} target="_blank" rel="noreferrer" className="underline">
            {draft.explanationVideoUrl}
          </a>
        </p>
      ) : null}
      <label className="mt-2 block text-[12px] font-normal text-foreground">
        {isNew ? FORM_COPY.video : FORM_COPY.replaceVideo}
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
          aria-label={FORM_COPY.video}
          onChange={(event) => onVideoFile(event.target.files?.[0] ?? null)}
          className="mt-1 block text-[12px]"
        />
      </label>
      {videoFile ? (
        <p className="mt-1 text-[11px] font-normal text-muted-foreground">{videoFile.name}</p>
      ) : null}
      <p className={HELP}>{FORM_COPY.videoHelp}</p>
    </div>
  );
}

export default function ExerciseForm(props: ExerciseFormProps) {
  const { draft, onDraft, isNew, onSave, onCancel, saving, problem } = props;
  return (
    <section className="mt-6 rounded-xl border border-border bg-muted/20 p-4">
      <h2 className="text-sm font-semibold text-foreground">
        {isNew ? FORM_COPY.newHeading : FORM_COPY.editHeading(draft.title || draft.exerciseId)}
      </h2>
      <div className="mt-4 grid gap-4">
        <label className={LABEL}>
          {FORM_COPY.title}
          <input
            type="text"
            maxLength={120}
            value={draft.title}
            placeholder={FORM_COPY.title}
            onChange={(event) =>
              onDraft({
                ...draft,
                title: event.target.value,
                exerciseId: isNew && (!draft.exerciseId || draft.exerciseId === suggestExerciseId(draft.title))
                  ? suggestExerciseId(event.target.value)
                  : draft.exerciseId,
              })
            }
            className={INPUT}
          />
        </label>
        {isNew ? (
          <label className={LABEL}>
            {FORM_COPY.id}
            <input
              type="text"
              value={draft.exerciseId}
              placeholder="land-the-ending"
              onChange={(event) => onDraft({ ...draft, exerciseId: event.target.value })}
              className={`${INPUT} font-mono`}
            />
            <span className={HELP}>{FORM_COPY.idNew}</span>
          </label>
        ) : null}
        <TagChips draft={draft} onDraft={onDraft} errors={props.errors} />
        <ScriptField draft={draft} onDraft={onDraft} />
        <label className={LABEL}>
          {FORM_COPY.intro}
          <textarea
            rows={3}
            value={draft.introductionCopy}
            placeholder={FORM_COPY.intro}
            onChange={(event) => onDraft({ ...draft, introductionCopy: event.target.value })}
            className={INPUT}
          />
        </label>
        <VideoField
          draft={draft}
          isNew={isNew}
          videoFile={props.videoFile}
          onVideoFile={props.onVideoFile}
        />
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => onDraft({ ...draft, active: event.target.checked })}
          />
          {FORM_COPY.active}
        </label>
      </div>
      {problem ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
          {saving ? FORM_COPY.saving : FORM_COPY.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-border bg-background px-4 py-2 text-[13px] font-medium text-foreground disabled:opacity-50"
        >
          {FORM_COPY.cancel}
        </button>
      </div>
    </section>
  );
}
