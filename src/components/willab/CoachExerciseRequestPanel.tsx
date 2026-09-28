"use client";

/* -------------------------------------------------------------------------- */
/*  A moment no exercise fitted — what the coach does about it                */
/*  (backend 2026-09-28, contract 35b / 35f; founder split: the backend owns  */
/*  the matching, this surface owns where it shows and how it reads).         */
/*                                                                            */
/*  BLIND COACH. The panel renders nothing and asks the server nothing until  */
/*  the coach's own Yes/No on this moment is saved (`enabled`). That no       */
/*  exercise fitted, and what was spotted, would anchor their judgment — so   */
/*  not even a badge saying a request exists appears before it. The server    */
/*  enforces the same gate (409 BLIND_RATING_REQUIRED) independently.         */
/*                                                                            */
/*  ONE ANSWER. The coach picks a library exercise, writes a new one, or says */
/*  nothing safe fits, once. Sharing with the speaker is a separate tick and  */
/*  can be added later by sending the same answer again.                     */
/*                                                                            */
/*  No numbers anywhere (AC-9): the library arrives best match first and is   */
/*  shown in that order without a rank, a distance or a fit type.             */
/*                                                                            */
/*  Every sentence lives in EXERCISE_REQUEST_COPY for founder sign-off.       */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import {
  answerCoachExerciseRequest,
  fetchCoachExerciseRequest,
  type CoachExerciseRequest,
  type ExerciseRequestAnswer,
  type ExerciseRequestExercise,
} from "@/services/api/coachExerciseRequest";
import type { CoachPracticeExercise } from "@/services/api/coachConfidencePractice";
import { uploadCoachVideo } from "@/services/api/coachReview";
import {
  newUploadKey,
  readVideoDurationSec,
  videoProvenance,
} from "@/services/api/coachVideoMeta";
import {
  AddToLibraryDoor,
  ExercisePickList,
  NOT_YET_PUBLISHED,
  usePendingAttach,
} from "./coachExercisePicking";

/** Every NEW sentence on this panel, in one place for founder sign-off. */
export const EXERCISE_REQUEST_COPY = {
  eyebrow: "No exercise fitted · after blind rating",
  nothingSpotted: "Nothing specific was spotted in this moment.",
  nothingTargets: (labels: string) =>
    `Spotted: ${labels}. No exercise in the library treats it yet.`,
  choose: "Pick from the library",
  write: "Write a new one",
  noSafeMatch: "No safe match",
  noSafeMatchHelp: "Nothing suitable exists for this moment. The speaker gets no exercise.",
  buildInLane: "Build it in the exercise lane",
  title: "Exercise title",
  instruction: "Short instruction (optional)",
  video: "Exercise video",
  upload: "Upload video",
  uploading: "Uploading…",
  pasteVideo: "Or paste a reviewed video URL",
  writeHelp: "It goes into the library, so any speaker whose clip shows the same problem can get it.",
  share: "Share with the speaker",
  once: "You answer once for this moment. You can still share it later.",
  submit: "Save my answer",
  saving: "Saving…",
  answered: {
    exercise_chosen: (title: string) => `You chose “${title}”.`,
    exercise_authored: (title: string) => `You wrote “${title}”.`,
    no_safe_match: "You said nothing safe fits this moment.",
  },
  shared: "Shared with the speaker.",
  shareNow: "Share it with the speaker",
  offeredSince:
    "The library has since matched this moment and the speaker already got that exercise, so sharing from here won’t reach them.",
  uploadFailed: "Couldn’t upload the exercise video. Try again.",
} as const;

type Mode = "chosen" | "authored" | "none";

const CHIP_ON = "border-primary bg-primary text-primary-foreground";
const CHIP_OFF = "border-border bg-background text-foreground";
const FIELD =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary";

/** The picking list's own shape; these exercises are never one-offs. */
function asPickable(items: ExerciseRequestExercise[]): CoachPracticeExercise[] {
  return items.map((item) => ({ ...item, isCustom: false }));
}

/** What the request says about the moment, in words. */
export function requestReasonLine(request: CoachExerciseRequest): string {
  if (request.reason === "nothing_targets_it" && request.spotted.length > 0) {
    return EXERCISE_REQUEST_COPY.nothingTargets(
      request.spotted.map((item) => item.label).join(", "),
    );
  }
  return EXERCISE_REQUEST_COPY.nothingSpotted;
}

/** The answer already on record, read back. */
export function answeredLine(request: CoachExerciseRequest): string | null {
  if (!request.resolution) return null;
  if (request.resolution === "no_safe_match") {
    return EXERCISE_REQUEST_COPY.answered.no_safe_match;
  }
  const found = request.availableExercises.find(
    (item) => item.exerciseId === request.resolvedExerciseId,
  );
  const title = found?.title ?? request.resolvedExerciseId ?? "";
  return EXERCISE_REQUEST_COPY.answered[request.resolution](title);
}

/** The same answer again, now shared. Null when there is nothing to share —
 *  no exercise, already shared, or the speaker already has another one. An
 *  authored exercise is resent from its library row, so the share still works
 *  after a reload. */
export function shareAgainAnswer(
  request: CoachExerciseRequest,
): ExerciseRequestAnswer | null {
  if (
    !request.resolution || request.resolution === "no_safe_match" ||
    request.shared || request.offeredSince || !request.resolvedExerciseId
  ) return null;
  if (request.resolution === "exercise_chosen") {
    return { resolution: "exercise_chosen", exerciseId: request.resolvedExerciseId, share: true };
  }
  const row = request.availableExercises.find(
    (item) => item.exerciseId === request.resolvedExerciseId,
  );
  if (!row?.explanationVideoRef) return null;
  return {
    resolution: "exercise_authored",
    custom: {
      title: row.title,
      instruction: row.instruction,
      explanationVideoUrl: row.explanationVideoRef,
    },
    share: true,
  };
}

function useExerciseRequest(sessionId: string, snippetId: string, enabled: boolean) {
  const [request, setRequest] = useState<CoachExerciseRequest | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    void fetchCoachExerciseRequest(sessionId, snippetId).then((value) => {
      if (!alive) return;
      setLoading(false);
      setRequest(value);
    });
    return () => { alive = false; };
  }, [enabled, sessionId, snippetId]);
  return { request, setRequest, loading };
}

export default function CoachExerciseRequestPanel({
  sessionId,
  snippetId,
  enabled,
  onBuildExercise,
}: {
  sessionId: string;
  snippetId: string;
  /** True only once the coach's own Yes/No on this moment is saved. */
  enabled: boolean;
  /** The review's hand-off to the CMS, which returns to THIS moment. */
  onBuildExercise?: (snippetId: string) => void;
}) {
  const { request, setRequest, loading } = useExerciseRequest(sessionId, snippetId, enabled);
  if (!enabled || (!loading && !request)) return null;
  return (
    <section
      data-testid="coach-exercise-request"
      className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
        {EXERCISE_REQUEST_COPY.eyebrow}
      </p>
      {request ? (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-foreground">
            {requestReasonLine(request)}
          </p>
          {request.resolution ? (
            <AnsweredRequest
              sessionId={sessionId}
              snippetId={snippetId}
              request={request}
              onRequest={setRequest}
            />
          ) : (
            <RequestAnswerForm
              sessionId={sessionId}
              snippetId={snippetId}
              request={request}
              onRequest={setRequest}
              onBuildExercise={onBuildExercise}
            />
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        </div>
      )}
    </section>
  );
}

function AnsweredRequest({
  sessionId,
  snippetId,
  request,
  onRequest,
}: {
  sessionId: string;
  snippetId: string;
  request: CoachExerciseRequest;
  onRequest: (next: CoachExerciseRequest) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const again = shareAgainAnswer(request);

  async function share() {
    if (!again || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await answerCoachExerciseRequest(sessionId, snippetId, again);
    setBusy(false);
    if (result.ok) onRequest(result.request);
    else setProblem(result.message);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-medium text-foreground">{answeredLine(request)}</p>
      {request.shared ? (
        <p className="text-[12.5px] text-success">{EXERCISE_REQUEST_COPY.shared}</p>
      ) : null}
      {request.offeredSince && request.resolution !== "no_safe_match" ? (
        <p role="status" className="text-[12.5px] leading-snug text-muted-foreground">
          {EXERCISE_REQUEST_COPY.offeredSince}
        </p>
      ) : null}
      {again ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void share()}
          className="self-start rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-50"
        >
          {busy ? EXERCISE_REQUEST_COPY.saving : EXERCISE_REQUEST_COPY.shareNow}
        </button>
      ) : null}
      {problem ? (
        <p role="alert" className="text-[12.5px] leading-snug text-destructive">{problem}</p>
      ) : null}
    </div>
  );
}

function RequestAnswerForm({
  sessionId,
  snippetId,
  request,
  onRequest,
  onBuildExercise,
}: {
  sessionId: string;
  snippetId: string;
  request: CoachExerciseRequest;
  onRequest: (next: CoachExerciseRequest) => void;
  onBuildExercise?: (snippetId: string) => void;
}) {
  const pickable = useMemo(() => asPickable(request.availableExercises), [request]);
  const [mode, setMode] = useState<Mode>(pickable.length > 0 ? "chosen" : "authored");
  const [exerciseId, setExerciseId] = useState("");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The CMS lane hands a new exercise back for THIS moment: preselect it,
  // never save it. One missing from the list says why, like the practice sheet.
  const found = useCallback((item: CoachPracticeExercise) => {
    setMode("chosen");
    setExerciseId(item.exerciseId);
  }, []);
  const missing = useCallback(
    () => setProblem(NOT_YET_PUBLISHED),
    [],
  );
  usePendingAttach(snippetId, pickable, found, missing);

  const answer: ExerciseRequestAnswer | null =
    mode === "none"
      ? { resolution: "no_safe_match" }
      : mode === "chosen"
        ? exerciseId ? { resolution: "exercise_chosen", exerciseId, share } : null
        : title.trim() && videoUrl.trim()
          ? {
              resolution: "exercise_authored",
              custom: {
                title: title.trim(),
                instruction: instruction.trim() || undefined,
                explanationVideoUrl: videoUrl.trim(),
              },
              share,
            }
          : null;

  async function submit() {
    if (!answer || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await answerCoachExerciseRequest(sessionId, snippetId, answer);
    setBusy(false);
    if (result.ok) onRequest(result.request);
    else setProblem(result.message);
  }

  return (
    <div className="flex flex-col gap-3">
      <ModeChips
        mode={mode}
        hasLibrary={pickable.length > 0}
        onMode={setMode}
        door={
          <AddToLibraryDoor href="/cms/new/exercise/1" snippetId={snippetId} onBuild={onBuildExercise}>
            {EXERCISE_REQUEST_COPY.buildInLane}
          </AddToLibraryDoor>
        }
      />
      {mode === "chosen" ? (
        <ExercisePickList
          exercises={pickable}
          selectedId={exerciseId}
          onPick={(item) => setExerciseId(item.exerciseId)}
          notice={null}
        />
      ) : mode === "authored" ? (
        <AuthorFields
          sessionId={sessionId}
          title={title}
          instruction={instruction}
          videoUrl={videoUrl}
          onTitle={setTitle}
          onInstruction={setInstruction}
          onVideo={setVideoUrl}
          onProblem={setProblem}
        />
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {EXERCISE_REQUEST_COPY.noSafeMatchHelp}
        </p>
      )}
      {mode !== "none" ? (
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={share} onChange={(event) => setShare(event.target.checked)} />
          {EXERCISE_REQUEST_COPY.share}
        </label>
      ) : null}
      <p className="text-[12px] text-muted-foreground">{EXERCISE_REQUEST_COPY.once}</p>
      <button
        type="button"
        disabled={!answer || busy}
        onClick={() => void submit()}
        className="self-start rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-50"
      >
        {busy ? EXERCISE_REQUEST_COPY.saving : EXERCISE_REQUEST_COPY.submit}
      </button>
      {problem ? (
        <p role="alert" className="text-[12.5px] leading-snug text-destructive">{problem}</p>
      ) : null}
    </div>
  );
}

function ModeChips({
  mode,
  hasLibrary,
  onMode,
  door,
}: {
  mode: Mode;
  hasLibrary: boolean;
  onMode: (mode: Mode) => void;
  door: React.ReactNode;
}) {
  const chips: [Mode, string][] = [
    ...(hasLibrary ? [["chosen", EXERCISE_REQUEST_COPY.choose] as [Mode, string]] : []),
    ["authored", EXERCISE_REQUEST_COPY.write],
    ["none", EXERCISE_REQUEST_COPY.noSafeMatch],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onMode(value)}
          className={`rounded-full border px-4 py-2 text-[13px] font-medium ${mode === value ? CHIP_ON : CHIP_OFF}`}
        >
          {label}
        </button>
      ))}
      {door}
    </div>
  );
}

function AuthorFields({
  sessionId,
  title,
  instruction,
  videoUrl,
  onTitle,
  onInstruction,
  onVideo,
  onProblem,
}: {
  sessionId: string;
  title: string;
  instruction: string;
  videoUrl: string;
  onTitle: (value: string) => void;
  onInstruction: (value: string) => void;
  onVideo: (value: string) => void;
  onProblem: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    onProblem(null);
    const durationSec = await readVideoDurationSec(file);
    const provenance = videoProvenance("coach-exercise-upload");
    const ref = await uploadCoachVideo(sessionId, file, {
      idempotencyKey: newUploadKey(),
      device: provenance.device,
      source: provenance.source,
      durationSec,
    });
    setUploading(false);
    if (ref) onVideo(ref);
    else onProblem(EXERCISE_REQUEST_COPY.uploadFailed);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        {EXERCISE_REQUEST_COPY.writeHelp}
      </p>
      <label className="text-[13px] font-medium text-foreground">
        {EXERCISE_REQUEST_COPY.title}
        <input type="text" maxLength={120} value={title} onChange={(event) => onTitle(event.target.value)} className={FIELD} />
      </label>
      <label className="text-[13px] font-medium text-foreground">
        {EXERCISE_REQUEST_COPY.instruction}
        <textarea maxLength={1000} rows={3} value={instruction} onChange={(event) => onInstruction(event.target.value)} className={`${FIELD} resize-y`} />
      </label>
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-[13px] font-semibold text-foreground">{EXERCISE_REQUEST_COPY.video}</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
          className="sr-only"
          onChange={(event) => {
            void upload(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-foreground disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {uploading ? EXERCISE_REQUEST_COPY.uploading : EXERCISE_REQUEST_COPY.upload}
        </button>
        <label className="mt-3 block text-[12px] font-medium text-muted-foreground">
          {EXERCISE_REQUEST_COPY.pasteVideo}
          <input type="url" value={videoUrl} onChange={(event) => onVideo(event.target.value)} placeholder="https://…" className={`${FIELD} text-foreground`} />
        </label>
      </div>
    </div>
  );
}
